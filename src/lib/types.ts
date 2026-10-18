/**
 * Shared API contracts. These types are the boundary between the Bemblo backend
 * and any client (web PWA today, native Android/iOS later).
 */
import type {
  ConversationKind,
  FollowState,
  MemberState,
  MessageKind,
  MessagePermission,
  MomentAudience,
  MomentKind,
  NotificationPrefs,
  ProfilePrivacy,
} from "@/db/schema";

export type { ConversationKind, FollowState, MemberState, MessageKind, MessagePermission, MomentAudience, MomentKind, NotificationPrefs, ProfilePrivacy };

export type ApiError = { ok: false; error: { code: string; message: string } };
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export type PublicUser = {
  id: number;
  username: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  accent: string;
  verified: boolean;
  profilePrivacy: ProfilePrivacy;
};

export type UserSummary = PublicUser & {
  isSelf: boolean;
  isFollowing: boolean;
  followsYou: boolean;
  isBlocked: boolean;
  isMuted: boolean;
  requested: boolean;
  canMessage: boolean;
  messageHint: string;
};

export type RelationState = "self" | "following" | "requested" | "blocked" | "follow" | "follow_back";

export type ProfileView = {
  user: PublicUser;
  relation: RelationState;
  restricted: boolean;
  restrictedReason?: "private" | "blocked" | "blocked_by";
  followerCount: number;
  followingCount: number;
  momentCount: number;
  messageAllowed: boolean;
  messageHint: string;
  isMuted: boolean;
  canViewFollowers: boolean;
};

export type MomentAuthor = PublicUser;

export type MomentView = {
  id: number;
  /** Short code for public links (/moment/p/<code>); null only for very old Moments. */
  shareCode: string | null;
  kind: MomentKind;
  body: string;
  mediaUrl: string | null;
  posterUrl: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  audience: MomentAudience;
  audienceLocked: boolean;
  createdAt: string;
  author: MomentAuthor;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
  isMine: boolean;
  /** Effective visibility after account privacy + audience + blocks are applied. */
  effectiveAudience: MomentAudience | "hidden";
};

export type CommentView = {
  id: number;
  body: string;
  createdAt: string;
  author: PublicUser;
  isMine: boolean;
};

export type FeedPage = {
  items: MomentView[];
  nextCursor: string | null;
};

export type ConversationSummary = {
  id: number;
  kind: ConversationKind;
  title: string;
  imageUrl: string | null;
  members: PublicUser[];
  memberCount: number;
  state: MemberState;
  isRequest: boolean;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  expiryLabel: string;
  lastMessageFromMe: boolean;
};

export type MessageView = {
  id: number;
  kind: MessageKind;
  body: string;
  mediaUrl: string | null;
  durationSec: number | null;
  isSystem: boolean;
  createdAt: string;
  sender: PublicUser | null;
  isMine: boolean;
  status: "sent" | "delivered" | "viewed";
  expiresAt: string | null;
  expiresLabel: string | null;
  notViewedYet: boolean;
  expired: boolean;
};

export type ConversationDetail = {
  conversation: {
    id: number;
    kind: ConversationKind;
    title: string;
    imageUrl: string | null;
    members: (PublicUser & { role: "member" | "admin"; state: MemberState })[];
    state: MemberState;
    createdAt: string;
    expiryLabel: string;
    expiryExplanation: string;
    messagePermissionBlocked: boolean;
    membersMuted: boolean;
  };
  messages: MessageView[];
};

export type NotificationView = {
  id: number;
  type: NotificationTypeWire;
  actor: PublicUser | null;
  preview: string | null;
  entityType: string | null;
  entityId: number | null;
  read: boolean;
  createdAt: string;
  href: string | null;
};

export type NotificationTypeWire =
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "like"
  | "comment"
  | "mention"
  | "message_request"
  | "message"
  | "system";

export type SearchResults = {
  query: string;
  users: (PublicUser & { isFollowing: boolean; followsYou: boolean; relation: RelationState })[];
  moments: MomentView[];
  recent: string[];
};

export type SessionUser = PublicUser & {
  email: string;
  emailVerifiedAt: string | null;
  phone: string | null;
  messagePermission: MessagePermission;
  notificationPrefs: NotificationPrefs;
  sensitiveContent: "show" | "warn" | "hide";
  onboarded: boolean;
  counts: { followers: number; following: number; moments: number; unreadNotifications: number; unreadMessages: number; requests: number };
};

export type FaqItem = { q: string; a: string; topic: string };
