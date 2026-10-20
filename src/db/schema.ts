import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Bemblo data model.
 *
 * The three privacy systems are intentionally separate:
 *  1. Account privacy   -> users.profilePrivacy
 *  2. Moment audience   -> moments.audience (+ moments.audienceLocked)
 *  3. Message permission -> users.messagePermission
 */

export type ProfilePrivacy = "public" | "private";
export type MessagePermission = "everyone" | "followers" | "following" | "nobody";
export type MomentAudience = "public" | "followers" | "only_me";
export type MomentKind = "text" | "photo" | "video";
export type FollowState = "pending" | "accepted";
export type ConversationKind = "direct" | "group";
export type MemberState = "active" | "requested" | "declined" | "left" | "removed";
export type MessageKind = "text" | "voice" | "image" | "video" | "document" | "system";
export type NotificationType =
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "like"
  | "comment"
  | "reply"
  | "mention"
  | "message_request"
  | "message"
  | "system";

export type NotificationPrefs = {
  push: boolean;
  email: boolean;
  messages: boolean;
  social: boolean;
  requests: boolean;
};

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    bio: text("bio").default("").notNull(),
    avatarUrl: text("avatar_url"),
    accent: text("accent").default("violet").notNull(),
    // System 1: account / profile privacy
    profilePrivacy: text("profile_privacy").$type<ProfilePrivacy>().default("public").notNull(),
    // System 3: messaging permissions
    messagePermission: text("message_permission").$type<MessagePermission>().default("everyone").notNull(),
    sensitiveContent: text("sensitive_content").$type<"show" | "warn" | "hide">().default("warn").notNull(),
    notificationPrefs: jsonb("notification_prefs").$type<NotificationPrefs>(),
    verified: boolean("verified").default(false).notNull(),
    // Bemblo's own announcement account: followable, but never messageable.
    isOfficial: boolean("is_official").default(false).notNull(),
    // Can open the admin inbox (reports + support requests).
    isAdmin: boolean("is_admin").default(false).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    rememberUnviewedMessages: boolean("retain_unviewed_messages").default(false).notNull(),
    lastEmailNotifiedAt: timestamp("last_email_notified_at", { withTimezone: true }),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("users_username_unique").on(t.username), unique("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: integer("user_id").notNull(),
    platform: text("platform").default("web").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [unique("sessions_token_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").$type<"password_reset" | "email_verify" | "phone_verify">().notNull(),
  token: text("token").notNull(),
  destination: text("destination"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Follow graph: pending rows represent follower requests on private accounts. */
export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id").notNull(),
    followingId: integer("following_id").notNull(),
    state: text("state").$type<FollowState>().default("accepted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("follows_pair_unique").on(t.followerId, t.followingId),
    index("follows_following_idx").on(t.followingId),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: integer("blocker_id").notNull(),
    blockedId: integer("blocked_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("blocks_pair_unique").on(t.blockerId, t.blockedId)],
);

export const mutes = pgTable(
  "mutes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    mutedId: integer("muted_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("mutes_pair_unique").on(t.userId, t.mutedId)],
);

export const moments = pgTable(
  "moments",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull(),
    kind: text("kind").$type<MomentKind>().notNull(),
    body: text("body").default("").notNull(),
    mediaUrl: text("media_url"),
    mediaId: integer("media_id"),
    mediaWidth: integer("media_width"),
    mediaHeight: integer("media_height"),
    posterUrl: text("poster_url"),
    // System 2: per-Moment audience. `audienceLocked` means the user explicitly
    // chose an audience that profile-privacy changes must never override.
    audience: text("audience").$type<MomentAudience>().default("public").notNull(),
    audienceLocked: boolean("audience_locked").default(false).notNull(),
    archived: boolean("archived").default(false).notNull(),
    // Short public share code used in links: /moment/p/<shareCode>
    shareCode: text("share_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("moments_author_idx").on(t.authorId),
    index("moments_created_idx").on(t.createdAt),
    uniqueIndex("moments_share_code_unique").on(t.shareCode),
  ],
);

export const momentLikes = pgTable(
  "moment_likes",
  {
    id: serial("id").primaryKey(),
    momentId: integer("moment_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("moment_likes_unique").on(t.momentId, t.userId)],
);

export const momentComments = pgTable(
  "moment_comments",
  {
    id: serial("id").primaryKey(),
    momentId: integer("moment_id").notNull(),
    userId: integer("user_id").notNull(),
    body: text("body").notNull(),
    // The comment this one replies to (null for top-level comments).
    parentCommentId: integer("parent_comment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("moment_comments_moment_idx").on(t.momentId)],
);

export const momentShares = pgTable("moment_shares", {
  id: serial("id").primaryKey(),
  momentId: integer("moment_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").$type<ConversationKind>().notNull(),
    title: text("title"),
    imageUrl: text("image_url"),
    createdById: integer("created_by_id").notNull(),
    directKey: text("direct_key"),
    membersMuted: boolean("members_muted").default(false).notNull(),
    inviteToken: text("invite_token"),
    // Disappearing messages: null = off, 0 = right after viewing (1:1 only), otherwise seconds.
    disappearAfterSec: integer("disappear_after_sec"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("conversations_invite_token_unique").on(t.inviteToken)],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    userId: integer("user_id").notNull(),
    role: text("role").$type<"member" | "admin">().default("member").notNull(),
    state: text("state").$type<MemberState>().default("active").notNull(),
    muted: boolean("muted").default(false).notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("conversation_members_unique").on(t.conversationId, t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    senderId: integer("sender_id").notNull(),
    kind: text("kind").$type<MessageKind>().default("text").notNull(),
    body: text("body").default("").notNull(),
    mediaUrl: text("media_url"),
    mediaId: integer("media_id"),
    durationSec: integer("duration_sec"),
    // System message rows are retained as conversation events (not temp content).
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Expiry is enforced server-side. Null => countdown has not started.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Hard ceiling for unviewed messages (retention policy hook).
    maxRetentionAt: timestamp("max_retention_at", { withTimezone: true }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    // Edit / delete support. A deleted message keeps its row as a tombstone but loses its content.
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: integer("deleted_by_id"),
    // The message this one replies to (same conversation).
    replyToId: integer("reply_to_id"),
    // The disappearing setting this message was sent under (same encoding as the conversation). Null = never expires.
    ttlSec: integer("ttl_sec"),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId),
    index("messages_expiry_idx").on(t.expiresAt),
  ],
);

export const messageViews = pgTable(
  "message_views",
  {
    id: serial("id").primaryKey(),
    messageId: integer("message_id").notNull(),
    userId: integer("user_id").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("message_views_unique").on(t.messageId, t.userId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    type: text("type").$type<NotificationType>().notNull(),
    actorId: integer("actor_id"),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    preview: text("preview"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

/** Web Push subscriptions: one row per browser/device a user enabled alerts on. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("push_subscriptions_endpoint_unique").on(t.endpoint), index("push_subscriptions_user_idx").on(t.userId)],
);

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull(),
  targetType: text("target_type").$type<"user" | "moment" | "message" | "comment">().notNull(),
  targetId: integer("target_id"),
  targetLabel: text("target_label"),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").$type<"open" | "reviewing" | "closed" | "resolved" | "dismissed">().default("open").notNull(),
  resolutionNote: text("resolution_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedById: integer("resolved_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").$type<"open" | "waiting" | "resolved">().default("open").notNull(),
  adminNote: text("admin_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id"),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").default(0).notNull(),
  kind: text("kind").$type<"image" | "video" | "audio" | "document">().notNull(),
  width: integer("width"),
  height: integer("height"),
  durationSec: integer("duration_sec"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  query: text("query").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
