import type { MessagePermission, MomentAudience, ProfilePrivacy } from "@/db/schema";

export const MESSAGE_EXPIRY = {
  /** 1-to-1: 24 hours after the receiver first views the message. */
  directViewedTtlMs: 24 * 60 * 60 * 1000,
  /** Group: 7 days after the message was sent, independent of views. */
  groupTtlMs: 7 * 24 * 60 * 60 * 1000,
  /** Retention ceiling for messages that are never viewed (policy hook). */
  maxUnviewedRetentionMs: 30 * 24 * 60 * 60 * 1000,
};

/** How long an "instant" message stays after it has been viewed (so voice notes and photos can still be opened). */
export const INSTANT_GRACE_SEC = 30;

export type DisappearChoice = "off" | "instant" | "24h" | "7d" | "30d";

export const DISAPPEAR_SECONDS: Record<Exclude<DisappearChoice, "off">, number> = {
  instant: 0,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
};

export const DISAPPEAR_LABELS: Record<DisappearChoice, string> = {
  off: "Off",
  instant: "Instant",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

export function disappearChoiceFromSeconds(sec: number | null): DisappearChoice {
  if (sec === null) return "off";
  if (sec === 0) return "instant";
  if (sec <= DISAPPEAR_SECONDS["24h"]) return "24h";
  if (sec <= DISAPPEAR_SECONDS["7d"]) return "7d";
  return "30d";
}

/** Short label + longer explanation for a conversation's disappearing setting. */
export function describeDisappearing(kind: "direct" | "group", sec: number | null) {
  const choice = disappearChoiceFromSeconds(sec);
  if (choice === "off") {
    return {
      label: "Disappearing messages off",
      explanation: "Messages in this conversation do not disappear on their own. You can still delete your own messages.",
    };
  }
  if (kind === "group") {
    const d = DISAPPEAR_LABELS[choice];
    return {
      label: `Disappears ${d} after sending`,
      explanation: `Every new message in this group is removed ${d} after it was sent, whether or not everyone has opened it.`,
    };
  }
  if (choice === "instant") {
    return {
      label: "Disappears right after viewing",
      explanation: "New messages disappear moments after the other person views them. Until then the countdown has not started.",
    };
  }
  const d = DISAPPEAR_LABELS[choice];
  return {
    label: `Disappears ${d} after viewing`,
    explanation: `New messages disappear ${d} after the other person views them. Until then the countdown has not started.`,
  };
}

export const EXPIRY_COPY = {
  direct: "Disappears 24h after viewing",
  directNotViewed: "Countdown starts when they view it",
  directViewed: "Viewed · disappears 24h after viewing",
  group: "Disappears 7 days after sending",
  maxRetention: "Unviewed messages are removed after 30 days",
  honestNote:
    "Messages disappear from Bemblo automatically. Expiring messages cannot stop screenshots or screen recording on other people's devices.",
};

export const AUDIENCE_COPY: Record<MomentAudience, { label: string; short: string; description: string; icon: string }> = {
  public: {
    label: "Public",
    short: "Public",
    description: "Anyone on Bemblo can see this Moment, including people who do not follow you.",
    icon: "globe",
  },
  followers: {
    label: "Followers",
    short: "Followers",
    description: "Only people whose follow request you approved can see this Moment.",
    icon: "users",
  },
  only_me: {
    label: "Only Me",
    short: "Only Me",
    description: "This Moment is private to you. It stays Only Me even if you change your profile privacy.",
    icon: "lock",
  },
};

export const PRIVACY_SWITCH_COPY = {
  toPrivate: [
    "Your profile becomes visible to approved followers only.",
    "Existing Public Moments become follower-only.",
    "Only Me Moments stay Only Me.",
    "Your Moments are never deleted automatically.",
  ],
  toPublic: [
    "Anyone can view your profile and Public Moments.",
    "Existing follower-only Moments become public.",
    "Only Me Moments stay Only Me.",
    "You can change a specific Moment's audience at any time.",
  ],
};

export type Relation = {
  /** viewer -> target accepted follow */
  viewerFollows: boolean;
  /** viewer -> target pending request */
  viewerRequested: boolean;
  /** target -> viewer accepted follow */
  targetFollows: boolean;
  viewerBlockedTarget: boolean;
  targetBlockedViewer: boolean;
};

/** System 1: profile visibility. Messaging permissions are handled separately. */
export function canViewProfile(
  viewerId: number | null,
  target: { id: number; profilePrivacy: ProfilePrivacy },
  relation: Relation,
): { allowed: boolean; reason?: "private" | "blocked" | "blocked_by"; restricted: boolean } {
  if (relation.viewerBlockedTarget || relation.targetBlockedViewer) {
    return { allowed: false, reason: relation.viewerBlockedTarget ? "blocked" : "blocked_by", restricted: true };
  }
  if (viewerId && viewerId === target.id) return { allowed: true, restricted: false };
  if (target.profilePrivacy === "public") return { allowed: true, restricted: false };
  if (relation.viewerFollows) return { allowed: true, restricted: false };
  return { allowed: true, reason: "private", restricted: true };
}

/**
 * System 2: Moment audience.
 *
 * effective = audience AND profile-privacy rules.
 *  - only_me is an absolute override: creator only, forever, regardless of profile privacy.
 *  - private account: public + followers Moments are visible to approved followers only.
 *  - public account: public Moments visible to everyone, followers Moments to followers only.
 */
export function canViewMoment(
  viewerId: number | null,
  moment: { audience: MomentAudience },
  target: { id: number; profilePrivacy: ProfilePrivacy },
  relation: Relation,
): boolean {
  if (relation.viewerBlockedTarget || relation.targetBlockedViewer) return false;
  if (moment.audience === "only_me") return viewerId !== null && viewerId === target.id;
  if (viewerId !== null && viewerId === target.id) return true;
  const followedByViewer = relation.viewerFollows;
  if (target.profilePrivacy === "private") return followedByViewer;
  if (moment.audience === "public") return true;
  return followedByViewer;
}

export function effectiveAudience(
  moment: { audience: MomentAudience; authorId: number },
  authorPrivacy: ProfilePrivacy,
  viewerId: number | null,
): MomentAudience | "hidden" {
  if (moment.audience === "only_me") return viewerId === moment.authorId ? "only_me" : "hidden";
  if (viewerId === moment.authorId) return moment.audience;
  if (authorPrivacy === "private") return "followers";
  return moment.audience;
}

/** System 3: messaging permissions (independent from the two systems above). */
export function canMessage(
  senderId: number,
  target: { id: number; messagePermission: MessagePermission; isOfficial?: boolean },
  relation: Relation,
): { allowed: boolean; reason: "allowed" | "nobody" | "followers" | "following" | "blocked" | "blocked_by" | "official"; shouldRequest: boolean } {
  // The official Bemblo account is announcements-only: it can be followed, never messaged.
  if (target.isOfficial) return { allowed: false, reason: "official", shouldRequest: false };
  if (relation.viewerBlockedTarget) return { allowed: false, reason: "blocked", shouldRequest: false };
  if (relation.targetBlockedViewer) return { allowed: false, reason: "blocked_by", shouldRequest: false };
  switch (target.messagePermission) {
    case "nobody":
      return { allowed: false, reason: "nobody", shouldRequest: false };
    case "followers":
      if (!relation.viewerFollows)
        return { allowed: false, reason: "followers", shouldRequest: relation.viewerRequested === false && false };
      break;
    case "following":
      if (!relation.targetFollows) return { allowed: false, reason: "following", shouldRequest: false };
      break;
    default:
      break;
  }
  // Messaging is allowed, but strangers land in Message Requests until the
  // conversation (or a 2-way follow) makes it a known contact.
  const isKnownContact = relation.viewerFollows && relation.targetFollows;
  return { allowed: true, reason: "allowed", shouldRequest: !isKnownContact };
}

export const MESSAGE_PERMISSION_COPY: Record<MessagePermission, { label: string; description: string }> = {
  everyone: { label: "Everyone", description: "Any Bemblo account can start a conversation with you. Strangers arrive as Message Requests." },
  followers: { label: "People who follow me", description: "Only approved followers can start a chat. Others are turned away." },
  following: { label: "People I follow", description: "Only people you follow can start a chat with you." },
  nobody: { label: "Nobody", description: "No one can start a private chat with you. Existing conversations keep working." },
};

export function messagePermissionBlockCopy(reason: string, name: string): string {
  switch (reason) {
    case "official":
      return `${name} is Bemblo's official account and is for announcements only. For help, use Help & Support.`;
    case "nobody":
      return `${name} is not accepting messages right now.`;
    case "followers":
      return `${name} only accepts messages from followers.`;
    case "following":
      return `${name} only accepts messages from people they follow.`;
    case "blocked":
      return `You blocked ${name}. Unblock to send messages.`;
    case "blocked_by":
      return `You cannot message ${name}.`;
    default:
      return `You cannot message ${name} right now.`;
  }
}

/**
 * Profile privacy switch behaviour. Only Me is never touched.
 * Returns the audience transformation applied to existing Moments.
 */
export function audienceAfterProfileSwitch(
  moment: { audience: MomentAudience; audienceLocked: boolean },
  next: ProfilePrivacy,
): MomentAudience {
  if (moment.audience === "only_me" || moment.audienceLocked) return moment.audience;
  // Public <-> Private never rewrites the stored audience. The audience scope and
  // the profile rule are combined at read time, so switching privacy instantly
  // changes what non-followers can see without destructive data migrations.
  void next;
  return moment.audience;
}
