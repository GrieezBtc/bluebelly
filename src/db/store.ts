import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { and, desc, eq, gt, inArray, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  blocks,
  conversationMembers,
  conversations,
  follows,
  mediaAssets,
  commentReactions,
  messageReactions,
  messageViews,
  messages,
  momentComments,
  momentLikes,
  momentShares,
  moments,
  mutes,
  notifications,
  reports,
  searchHistory,
  supportTickets,
  users,
  type MemberState,
  type MessagePermission,
  type MomentAudience,
  type MomentKind,
  type NotificationPrefs,
} from "@/db/schema";
import type {
  CommentView,
  ConversationDetail,
  ConversationSummary,
  FeedPage,
  MessageView,
  MomentView,
  NotificationView,
  PublicUser,
  RelationState,
  SearchResults,
  SessionUser,
  UserSummary,
} from "@/lib/types";
import {
  EXPIRY_COPY,
  MESSAGE_EXPIRY,
  DISAPPEAR_SECONDS,
  INSTANT_GRACE_SEC,
  describeDisappearing,
  canMessage,
  canViewMoment,
  effectiveAudience,
  messagePermissionBlockCopy,
  type Relation,
} from "@/lib/privacy";
import { deleteAsset, ownedMediaId } from "@/lib/storage";
import { timeLeftLabel } from "@/lib/utils";
import { sendPushToUser } from "@/lib/push";
import { isAdminUser } from "@/lib/admin";
import { generateShareCode, isValidShareCode } from "@/lib/share";
import { sendNotificationEmail } from "@/lib/email";
import { commentReactionInfo, isCommentReaction, normalizeEmoji, type CommentReaction } from "@/lib/reactions";
import type { AuthUser } from "@/lib/auth";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  push: true,
  email: true,
  messages: true,
  social: true,
  requests: true,
};

export function normalizePrefs(prefs: NotificationPrefs | null): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs ?? {}) };
}

type PublicUserSource = {
  id: number;
  username: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  accent: string;
  verified: boolean;
  isOfficial?: boolean;
  profilePrivacy: "public" | "private";
};

export function toPublicUser(user: PublicUserSource): PublicUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    accent: user.accent,
    verified: user.verified,
    official: user.isOfficial ?? false,
    profilePrivacy: user.profilePrivacy,
  };
}

const PUBLIC_USER_COLUMNS = {
  id: users.id,
  username: users.username,
  name: users.name,
  bio: users.bio,
  avatarUrl: users.avatarUrl,
  accent: users.accent,
  verified: users.verified,
  isOfficial: users.isOfficial,
  profilePrivacy: users.profilePrivacy,
};

/* ------------------------------------------------------------------ *
 * Social graph
 * ------------------------------------------------------------------ */

export async function getRelation(viewerId: number | null, targetId: number): Promise<Relation> {
  const empty: Relation = {
    viewerFollows: false,
    viewerRequested: false,
    targetFollows: false,
    viewerBlockedTarget: false,
    targetBlockedViewer: false,
  };
  if (viewerId === null || viewerId === targetId) return empty;
  const [followRows, blockRows] = await Promise.all([
    db
      .select({ followerId: follows.followerId, state: follows.state })
      .from(follows)
      .where(
        or(
          and(eq(follows.followerId, viewerId), eq(follows.followingId, targetId)),
          and(eq(follows.followerId, targetId), eq(follows.followingId, viewerId)),
        ),
      ),
    db
      .select({ blockerId: blocks.blockerId })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, targetId)),
          and(eq(blocks.blockerId, targetId), eq(blocks.blockedId, viewerId)),
        ),
      ),
  ]);
  const viewerEdge = followRows.find((r) => r.followerId === viewerId);
  const targetEdge = followRows.find((r) => r.followerId === targetId);
  return {
    viewerFollows: viewerEdge?.state === "accepted",
    viewerRequested: viewerEdge?.state === "pending",
    targetFollows: targetEdge?.state === "accepted",
    viewerBlockedTarget: blockRows.some((b) => b.blockerId === viewerId),
    targetBlockedViewer: blockRows.some((b) => b.blockerId === targetId),
  };
}

export async function acceptedFollowingIds(userId: number) {
  const rows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.state, "accepted")));
  return rows.map((r) => r.id);
}

export async function viewerExclusions(userId: number) {
  const [blockRows, mutedRows] = await Promise.all([
    db
      .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
      .from(blocks)
      .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId))),
    db.select({ id: mutes.mutedId }).from(mutes).where(eq(mutes.userId, userId)),
  ]);
  const blockedIds = Array.from(
    new Set(blockRows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId))),
  );
  return { blockedIds, mutedIds: mutedRows.map((r) => r.id) };
}

export type FollowActionResult = {
  relation: RelationState;
  message: string;
};

export async function applyFollowAction(
  viewer: AuthUser,
  targetUsername: string,
  action:
    | "follow"
    | "unfollow"
    | "accept"
    | "decline"
    | "remove_follower"
    | "block"
    | "unblock"
    | "mute"
    | "unmute",
): Promise<FollowActionResult> {
  const [target] = await db.select().from(users).where(eq(users.username, targetUsername.toLowerCase())).limit(1);
  if (!target) throw new Error("not_found");
  if (target.id === viewer.id) throw new Error("self");

  switch (action) {
    case "follow": {
      const isPrivate = target.profilePrivacy === "private";
      await db
        .insert(follows)
        .values({ followerId: viewer.id, followingId: target.id, state: isPrivate ? "pending" : "accepted" })
        .onConflictDoUpdate({
          target: [follows.followerId, follows.followingId],
          set: { state: isPrivate ? "pending" : "accepted", createdAt: new Date() },
        });
      // Following unblocks in one tap, mirroring common social-app expectations.
      await db.delete(blocks).where(and(eq(blocks.blockerId, viewer.id), eq(blocks.blockedId, target.id)));
      await createNotification({
        userId: target.id,
        type: isPrivate ? "follow_request" : "follow",
        actorId: viewer.id,
        entityType: "user",
        entityId: viewer.id,
        preview: isPrivate ? "Requested to follow you" : "Started following you",
      });
      return {
        relation: isPrivate ? "requested" : "following",
        message: isPrivate ? `Follow request sent to @${target.username}.` : `You now follow @${target.username}.`,
      };
    }
    case "unfollow": {
      await db.delete(follows).where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, target.id)));
      return { relation: "follow", message: `You unfollowed @${target.username}.` };
    }
    case "accept": {
      await db
        .update(follows)
        .set({ state: "accepted" })
        .where(and(eq(follows.followerId, target.id), eq(follows.followingId, viewer.id)));
      await createNotification({
        userId: target.id,
        type: "follow_accepted",
        actorId: viewer.id,
        entityType: "user",
        entityId: viewer.id,
        preview: "Approved your follow request",
      });
      return { relation: "following", message: `@${target.username} can now see your follower-only Moments.` };
    }
    case "decline": {
      await db.delete(follows).where(and(eq(follows.followerId, target.id), eq(follows.followingId, viewer.id)));
      return { relation: "follow", message: `Follow request from @${target.username} declined.` };
    }
    case "remove_follower": {
      await db.delete(follows).where(and(eq(follows.followerId, target.id), eq(follows.followingId, viewer.id)));
      return { relation: "follow", message: `@${target.username} was removed from your followers.` };
    }
    case "block": {
      await db
        .insert(blocks)
        .values({ blockerId: viewer.id, blockedId: target.id })
        .onConflictDoNothing();
      await db
        .delete(follows)
        .where(
          or(
            and(eq(follows.followerId, viewer.id), eq(follows.followingId, target.id)),
            and(eq(follows.followerId, target.id), eq(follows.followingId, viewer.id)),
          ),
        );
      return { relation: "blocked", message: `@${target.username} is blocked. They can no longer find or message you.` };
    }
    case "unblock": {
      await db.delete(blocks).where(and(eq(blocks.blockerId, viewer.id), eq(blocks.blockedId, target.id)));
      return { relation: "follow", message: `@${target.username} is unblocked.` };
    }
    case "mute": {
      await db.insert(mutes).values({ userId: viewer.id, mutedId: target.id }).onConflictDoNothing();
      return { relation: "following", message: `You muted @${target.username}. They can still message you.` };
    }
    case "unmute": {
      await db.delete(mutes).where(and(eq(mutes.userId, viewer.id), eq(mutes.mutedId, target.id)));
      return { relation: "following", message: `Unmuted @${target.username}.` };
    }
    default:
      throw new Error("unknown_action");
  }
}

/* ------------------------------------------------------------------ *
 * Moments
 * ------------------------------------------------------------------ */

const momentSelect = (viewerId: number) => ({
  id: moments.id,
  shareCode: moments.shareCode,
  kind: moments.kind,
  body: moments.body,
  mediaUrl: moments.mediaUrl,
  posterUrl: moments.posterUrl,
  mediaWidth: moments.mediaWidth,
  mediaHeight: moments.mediaHeight,
  audience: moments.audience,
  audienceLocked: moments.audienceLocked,
  createdAt: moments.createdAt,
  authorId: moments.authorId,
  authorUsername: users.username,
  authorName: users.name,
  authorBio: users.bio,
  authorAvatar: users.avatarUrl,
  authorAccent: users.accent,
  authorVerified: users.verified,
  authorPrivacy: users.profilePrivacy,
  likeCount: sql<number>`(select count(*)::int from ${momentLikes} where ${momentLikes.momentId} = ${moments.id})`,
  commentCount: sql<number>`(select count(*)::int from ${momentComments} where ${momentComments.momentId} = ${moments.id})`,
  shareCount: sql<number>`(select count(*)::int from ${momentShares} where ${momentShares.momentId} = ${moments.id})`,
  likedByMe: sql<boolean>`exists(select 1 from ${momentLikes} where ${momentLikes.momentId} = ${moments.id} and ${momentLikes.userId} = ${viewerId})`,
});

type MomentRow = {
  id: number;
  shareCode: string | null;
  kind: MomentKind;
  body: string;
  mediaUrl: string | null;
  posterUrl: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  audience: MomentAudience;
  audienceLocked: boolean;
  createdAt: Date;
  authorId: number;
  authorUsername: string;
  authorName: string;
  authorBio: string;
  authorAvatar: string | null;
  authorAccent: string;
  authorVerified: boolean;
  authorPrivacy: "public" | "private";
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
};

function mapMoment(row: MomentRow, viewerId: number | null): MomentView {
  return {
    id: row.id,
    shareCode: row.shareCode,
    kind: row.kind,
    body: row.body,
    mediaUrl: row.mediaUrl,
    posterUrl: row.posterUrl,
    mediaWidth: row.mediaWidth,
    mediaHeight: row.mediaHeight,
    audience: row.audience,
    audienceLocked: row.audienceLocked,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.authorId,
      username: row.authorUsername,
      name: row.authorName,
      bio: row.authorBio,
      avatarUrl: row.authorAvatar,
      accent: row.authorAccent,
      verified: row.authorVerified,
      profilePrivacy: row.authorPrivacy,
    },
    likeCount: Number(row.likeCount),
    commentCount: Number(row.commentCount),
    shareCount: Number(row.shareCount),
    likedByMe: Boolean(row.likedByMe),
    isMine: viewerId === row.authorId,
    effectiveAudience: effectiveAudience({ audience: row.audience, authorId: row.authorId }, row.authorPrivacy, viewerId),
  };
}

function discoveryWhere(viewerId: number, followingIds: number[], blockedIds: number[], mutedIds: number[]) {
  return and(
    notInArray(moments.authorId, getExclusionList(viewerId, blockedIds, mutedIds)),
    ne(moments.audience, "only_me"),
    or(
      and(eq(users.profilePrivacy, "public"), eq(moments.audience, "public")),
      followingIds.length ? inArray(moments.authorId, followingIds) : sql`false`,
    ),
  );
}

function getExclusionList(viewerId: number, blockedIds: number[], mutedIds: number[]) {
  const list = new Set<number>([...blockedIds, ...mutedIds]);
  list.delete(viewerId);
  return list.size ? Array.from(list) : [-1];
}

export async function listFeed(
  viewer: AuthUser,
  opts: { limit: number; cursor?: string; authorId?: number },
): Promise<FeedPage> {
  const followingIds = await acceptedFollowingIds(viewer.id);
  const { blockedIds, mutedIds } = await viewerExclusions(viewer.id);
  const cursorDate = opts.cursor ? new Date(opts.cursor) : null;

  // Your own Moments always include Only Me entries; other people's content is
  // filtered through the discovery rules (audience AND profile privacy).
  const scope = opts.authorId
    ? opts.authorId === viewer.id
      ? eq(moments.authorId, viewer.id)
      : and(discoveryWhere(viewer.id, followingIds, blockedIds, mutedIds), eq(moments.authorId, opts.authorId))
    : discoveryWhere(viewer.id, followingIds, blockedIds, mutedIds);

  const rows = (await db
    .select(momentSelect(viewer.id))
    .from(moments)
    .innerJoin(users, eq(users.id, moments.authorId))
    .where(
      and(
        scope,
        cursorDate && !Number.isNaN(cursorDate.getTime()) ? lt(moments.createdAt, cursorDate) : undefined,
      ),
    )
    .orderBy(desc(moments.createdAt))
    .limit(opts.limit + 1)) as unknown as MomentRow[];

  const hasMore = rows.length > opts.limit;
  const items = rows.slice(0, opts.limit).map((row) => mapMoment(row, viewer.id));
  return { items, nextCursor: hasMore ? items[items.length - 1]?.createdAt ?? null : null };
}

export async function listAuthorMoments(
  viewerId: number | null,
  author: { id: number; profilePrivacy: "public" | "private" },
  opts: { limit: number; cursor?: string },
): Promise<FeedPage> {
  const isSelf = viewerId === author.id;
  const relation = await getRelation(viewerId, author.id);
  if (relation.viewerBlockedTarget || relation.targetBlockedViewer) return { items: [], nextCursor: null };
  if (!isSelf && author.profilePrivacy === "private" && !relation.viewerFollows) {
    return { items: [], nextCursor: null };
  }
  const audienceFilter = isSelf
    ? undefined
    : relation.viewerFollows
      ? inArray(moments.audience, ["public", "followers"] as MomentAudience[])
      : eq(moments.audience, "public");
  const cursorDate = opts.cursor ? new Date(opts.cursor) : null;

  const rows = (await db
    .select(momentSelect(viewerId ?? 0))
    .from(moments)
    .innerJoin(users, eq(users.id, moments.authorId))
    .where(
      and(
        eq(moments.authorId, author.id),
        audienceFilter,
        cursorDate && !Number.isNaN(cursorDate.getTime()) ? lt(moments.createdAt, cursorDate) : undefined,
      ),
    )
    .orderBy(desc(moments.createdAt))
    .limit(opts.limit + 1)) as unknown as MomentRow[];

  const hasMore = rows.length > opts.limit;
  const items = rows.slice(0, opts.limit).map((row) => mapMoment(row, viewerId));
  return { items, nextCursor: hasMore ? items[items.length - 1]?.createdAt ?? null : null };
}

export async function getMoment(viewerId: number | null, momentId: number) {
  const rows = (await db
    .select(momentSelect(viewerId ?? 0))
    .from(moments)
    .innerJoin(users, eq(users.id, moments.authorId))
    .where(eq(moments.id, momentId))
    .limit(1)) as unknown as MomentRow[];
  const row = rows[0];
  if (!row) return null;
  const relation = await getRelation(viewerId, row.authorId);
  const allowed = canViewMoment(
    viewerId,
    { audience: row.audience },
    { id: row.authorId, profilePrivacy: row.authorPrivacy },
    relation,
  );
  if (!allowed) return null;
  return { moment: mapMoment(row, viewerId), author: { id: row.authorId, profilePrivacy: row.authorPrivacy } };
}

function summarizeCommentReactions(rows: { userId: number; reaction: string }[], viewerId: number | null) {
  const counts = new Map<CommentReaction, number>();
  let myReaction: CommentReaction | null = null;
  for (const row of rows) {
    if (!isCommentReaction(row.reaction)) continue;
    counts.set(row.reaction, (counts.get(row.reaction) ?? 0) + 1);
    if (viewerId !== null && row.userId === viewerId) myReaction = row.reaction;
  }
  const reactions = Array.from(counts, ([reaction, count]) => ({ reaction, count })).sort((a, b) => b.count - a.count);
  return { reactions, myReaction };
}

/** Set, change or (with null / the same reaction) remove the viewer's reaction on a comment. */
export async function reactToComment(viewer: AuthUser, momentId: number, commentId: number, reaction: CommentReaction | null) {
  const found = await getMoment(viewer.id, momentId);
  if (!found) throw new Error("not_found");
  const [comment] = await db
    .select({ id: momentComments.id, userId: momentComments.userId, body: momentComments.body })
    .from(momentComments)
    .where(and(eq(momentComments.id, commentId), eq(momentComments.momentId, momentId)))
    .limit(1);
  if (!comment) throw new Error("not_found");

  const [existing] = await db
    .select({ id: commentReactions.id, reaction: commentReactions.reaction })
    .from(commentReactions)
    .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, viewer.id)))
    .limit(1);

  let applied: CommentReaction | null = reaction;
  if (!reaction || existing?.reaction === reaction) {
    applied = null;
    if (existing) await db.delete(commentReactions).where(eq(commentReactions.id, existing.id));
  } else {
    await db
      .insert(commentReactions)
      .values({ commentId, userId: viewer.id, reaction })
      .onConflictDoUpdate({ target: [commentReactions.commentId, commentReactions.userId], set: { reaction, createdAt: new Date() } });
    // The comment's author hears about it (never about their own reaction, and never about removals).
    const info = commentReactionInfo(reaction);
    await createNotification({
      userId: comment.userId,
      type: "reaction",
      actorId: viewer.id,
      entityType: "moment",
      entityId: momentId,
      preview: `Reacted ${info.emoji} ${info.label.toLowerCase()} to your comment: ${comment.body.slice(0, 70)}`,
    });
  }

  const rows = await db
    .select({ userId: commentReactions.userId, reaction: commentReactions.reaction })
    .from(commentReactions)
    .where(eq(commentReactions.commentId, commentId));
  return { commentId, ...summarizeCommentReactions(rows, viewer.id), applied };
}

export async function listComments(viewerId: number | null, momentId: number): Promise<CommentView[]> {
  const rows = await db
    .select({
      commentId: momentComments.id,
      body: momentComments.body,
      parentCommentId: momentComments.parentCommentId,
      createdAt: momentComments.createdAt,
      authorId: users.id,
      username: users.username,
      name: users.name,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      accent: users.accent,
      verified: users.verified,
      profilePrivacy: users.profilePrivacy,
    })
    .from(momentComments)
    .innerJoin(users, eq(users.id, momentComments.userId))
    .where(eq(momentComments.momentId, momentId))
    .orderBy(momentComments.createdAt);
  const byId = new Map(rows.map((row) => [row.commentId, row]));
  const reactionRows = rows.length
    ? await db
        .select({ commentId: commentReactions.commentId, userId: commentReactions.userId, reaction: commentReactions.reaction })
        .from(commentReactions)
        .where(inArray(commentReactions.commentId, rows.map((row) => row.commentId)))
    : [];
  return rows.map((row) => {
    const summary = summarizeCommentReactions(reactionRows.filter((r) => r.commentId === row.commentId), viewerId);
    const parent = row.parentCommentId ? byId.get(row.parentCommentId) : undefined;
    return {
      id: row.commentId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      isMine: viewerId === row.authorId,
      author: toPublicUser({ ...row, id: row.authorId }),
      reactions: summary.reactions,
      myReaction: summary.myReaction,
      replyTo: parent
        ? { id: parent.commentId, authorName: parent.name, authorUsername: parent.username, snippet: parent.body.slice(0, 80) }
        : null,
    };
  });
}

export async function createMomentRecord(input: {
  authorId: number;
  kind: MomentKind;
  body: string;
  mediaUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  audience: MomentAudience;
}) {
  const mediaId = await ownedMediaId(input.authorId, input.mediaUrl);
  const values = {
    authorId: input.authorId,
    kind: input.kind,
    body: input.body,
    mediaId,
    mediaUrl: input.mediaUrl ?? null,
    posterUrl: input.posterUrl ?? null,
    mediaWidth: input.mediaWidth ?? null,
    mediaHeight: input.mediaHeight ?? null,
    audience: input.audience,
    audienceLocked: input.audience === "only_me",
  };
  // Retry on the (very unlikely) chance of a share-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const inserted = await db
      .insert(moments)
      .values({ ...values, shareCode: generateShareCode() })
      .onConflictDoNothing({ target: moments.shareCode })
      .returning();
    if (inserted[0]) return inserted[0];
  }
  throw new Error("Could not allocate a share code.");
}

/** Look up a Moment by its public share code, applying the normal visibility rules. */
export async function getMomentByShareCode(viewerId: number | null, code: string) {
  if (!isValidShareCode(code)) return null;
  const [row] = await db.select({ id: moments.id }).from(moments).where(eq(moments.shareCode, code)).limit(1);
  return row ? getMoment(viewerId, row.id) : null;
}

export async function toggleLike(viewer: AuthUser, momentId: number, like: boolean) {
  const found = await getMoment(viewer.id, momentId);
  if (!found) throw new Error("not_found");
  if (like) {
    await db.insert(momentLikes).values({ momentId, userId: viewer.id }).onConflictDoNothing();
    await createNotification({
      userId: found.moment.author.id,
      type: "like",
      actorId: viewer.id,
      entityType: "moment",
      entityId: momentId,
      preview: "Liked your Moment",
    });
  } else {
    await db.delete(momentLikes).where(and(eq(momentLikes.momentId, momentId), eq(momentLikes.userId, viewer.id)));
  }
  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(momentLikes)
    .where(eq(momentLikes.momentId, momentId));
  const [mine] = await db
    .select({ id: momentLikes.id })
    .from(momentLikes)
    .where(and(eq(momentLikes.momentId, momentId), eq(momentLikes.userId, viewer.id)))
    .limit(1);
  return { likeCount: Number(count?.c ?? 0), likedByMe: Boolean(mine) };
}

export async function addComment(viewer: AuthUser, momentId: number, body: string, parentCommentId?: number | null) {
  const found = await getMoment(viewer.id, momentId);
  if (!found) throw new Error("not_found");

  let parent: { id: number; userId: number; body: string; name: string; username: string } | null = null;
  if (parentCommentId) {
    const [row] = await db
      .select({ id: momentComments.id, userId: momentComments.userId, body: momentComments.body, name: users.name, username: users.username })
      .from(momentComments)
      .innerJoin(users, eq(users.id, momentComments.userId))
      .where(and(eq(momentComments.id, parentCommentId), eq(momentComments.momentId, momentId)))
      .limit(1);
    if (!row) throw new Error("parent_not_found");
    parent = row;
  }

  const [created] = await db
    .insert(momentComments)
    .values({ momentId, userId: viewer.id, body, parentCommentId: parent?.id ?? null })
    .returning();

  // The person being replied to hears about the reply; the Moment's owner hears about the comment
  // (once — never twice if they are the same person).
  if (parent && parent.userId !== viewer.id) {
    await createNotification({
      userId: parent.userId,
      type: "reply",
      actorId: viewer.id,
      entityType: "moment",
      entityId: momentId,
      preview: `Replied to your comment: ${body.slice(0, 80)}`,
    });
  }
  if (!parent || parent.userId !== found.moment.author.id) {
    await createNotification({
      userId: found.moment.author.id,
      type: "comment",
      actorId: viewer.id,
      entityType: "moment",
      entityId: momentId,
      preview: body.slice(0, 90),
    });
  }
  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(momentComments)
    .where(eq(momentComments.momentId, momentId));
  return {
    comment: {
      id: created.id,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
      isMine: true,
      author: toPublicUser(viewer),
      reactions: [],
      myReaction: null,
      replyTo: parent
        ? { id: parent.id, authorName: parent.name, authorUsername: parent.username, snippet: parent.body.slice(0, 80) }
        : null,
    } satisfies CommentView,
    commentCount: Number(count?.c ?? 0),
  };
}

export async function shareMoment(viewer: AuthUser, momentId: number) {
  const found = await getMoment(viewer.id, momentId);
  if (!found) throw new Error("not_found");
  await db.insert(momentShares).values({ momentId, userId: viewer.id });
  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(momentShares)
    .where(eq(momentShares.momentId, momentId));
  await createNotification({
    userId: found.moment.author.id,
    type: "mention",
    actorId: viewer.id,
    entityType: "moment",
    entityId: momentId,
    preview: "Shared your Moment",
  });
  return { shareCount: Number(count?.c ?? 0) };
}

/* ------------------------------------------------------------------ *
 * Notifications
 * ------------------------------------------------------------------ */

export async function createNotification(input: {
  userId: number;
  type: NotificationView["type"];
  actorId?: number | null;
  entityType?: string | null;
  entityId?: number | null;
  preview?: string | null;
}) {
  if (input.actorId === input.userId) return;
  const rows = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, input.userId)).limit(1);
  const prefs = normalizePrefs(rows[0]?.prefs ?? null);
  if (input.type === "message" || input.type === "message_request" || ((input.type === "reply" || input.type === "reaction") && input.entityType === "conversation")) {
    if (!prefs.messages) return;
  } else if (input.type === "follow" || input.type === "follow_request" || input.type === "follow_accepted") {
    if (!prefs.requests) return;
  } else if (!prefs.social) {
    return;
  }
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    actorId: input.actorId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    preview: input.preview ?? null,
  });

  // "Viewed your message" receipts stay in-app only.
  if (input.preview === "Viewed your message") return;
  const delivery = deliverNotification(input, prefs).catch((error) => console.error("[bemblo:notify]", error));
  try {
    after(delivery); // keep the serverless function alive until push/email finish
  } catch {
    /* outside a request scope: the promise simply runs on its own */
  }
}

function notificationCopy(type: NotificationView["type"], actorName: string, preview: string | null) {
  switch (type) {
    case "message":
      return { title: actorName, body: preview || "Sent you a message" };
    case "message_request":
      return { title: actorName, body: preview || "Sent you a message request" };
    case "reaction":
      return { title: `${actorName} reacted`, body: preview || "Reacted to your message" };
    case "like":
      return { title: actorName, body: "Liked your Moment" };
    case "reply":
      return { title: `${actorName} replied to you`, body: preview || "Replied to you" };
    case "comment":
      return { title: `${actorName} commented`, body: preview || "Commented on your Moment" };
    case "mention":
      return { title: actorName, body: preview || "Shared your Moment" };
    case "follow":
      return { title: actorName, body: "Started following you" };
    case "follow_request":
      return { title: actorName, body: "Requested to follow you" };
    case "follow_accepted":
      return { title: actorName, body: "Approved your follow request" };
    default:
      return { title: "BlueBelly", body: preview || "You have new activity." };
  }
}

function notificationPath(input: { entityType?: string | null; entityId?: number | null }, actorUsername: string | null) {
  if (input.entityType === "conversation" && input.entityId) return `/messages/${input.entityId}`;
  if (input.entityType === "moment" && input.entityId) return `/moments/${input.entityId}`;
  if (input.entityType === "user" && actorUsername) return `/profile/${actorUsername}`;
  if (input.entityType === "admin") return "/admin";
  return "/notifications";
}

const EMAIL_COOLDOWN_MINUTES = 15;

async function deliverNotification(
  input: { userId: number; type: NotificationView["type"]; actorId?: number | null; entityType?: string | null; entityId?: number | null; preview?: string | null },
  prefs: NotificationPrefs,
) {
  const [actor] = input.actorId
    ? await db.select({ name: users.name, username: users.username }).from(users).where(eq(users.id, input.actorId)).limit(1)
    : [];
  const copy = notificationCopy(input.type, actor?.name ?? "Someone", input.preview ?? null);
  const path = notificationPath(input, actor?.username ?? null);

  if (prefs.push) {
    await sendPushToUser(input.userId, { ...copy, url: path, tag: `${input.type}-${input.entityType ?? "x"}-${input.entityId ?? 0}` });
  }

  // Email: skip likes (too noisy) and rate-limit to one email per cooldown window.
  if (prefs.email && input.type !== "like") {
    const claimed = await db
      .update(users)
      .set({ lastEmailNotifiedAt: new Date() })
      .where(
        and(
          eq(users.id, input.userId),
          sql`${users.emailVerifiedAt} is not null`,
          sql`(${users.lastEmailNotifiedAt} is null or ${users.lastEmailNotifiedAt} < now() - interval '${sql.raw(String(EMAIL_COOLDOWN_MINUTES))} minutes')`,
        ),
      )
      .returning({ email: users.email });
    if (claimed[0]) {
      const base = (process.env.BEMBLO_PUBLIC_URL ?? "").replace(/\/$/, "");
      await sendNotificationEmail({ to: claimed[0].email, title: copy.title === "BlueBelly" ? "New activity on BlueBelly" : `${copy.title} on BlueBelly`, body: copy.body, url: `${base}${path}` });
    }
  }
}

export async function listNotifications(viewer: AuthUser): Promise<NotificationView[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      preview: notifications.preview,
      entityType: notifications.entityType,
      entityId: notifications.entityId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorId: users.id,
      username: users.username,
      name: users.name,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      accent: users.accent,
      verified: users.verified,
      profilePrivacy: users.profilePrivacy,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, viewer.id))
    .orderBy(desc(notifications.createdAt))
    .limit(60);

  return rows.map((row) => {
    const actor = row.actorId
      ? toPublicUser({
          id: row.actorId,
          username: row.username ?? "",
          name: row.name ?? "",
          bio: row.bio ?? "",
          avatarUrl: row.avatarUrl,
          accent: row.accent ?? "violet",
          verified: row.verified ?? false,
          profilePrivacy: row.profilePrivacy ?? "public",
        })
      : null;
    let href: string | null = null;
    if (row.entityType === "moment" && row.entityId) href = `/moments/${row.entityId}`;
    if (row.entityType === "conversation" && row.entityId) href = `/messages/${row.entityId}`;
    if (row.entityType === "user" && actor) href = `/profile/${actor.username}`;
    if (row.entityType === "admin") href = "/admin";
    return {
      id: row.id,
      type: row.type,
      actor,
      preview: row.preview,
      entityType: row.entityType,
      entityId: row.entityId,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
      href,
    } satisfies NotificationView;
  });
}

export async function markNotificationsRead(
  viewer: AuthUser,
  id?: number,
  scope: "general" | "messages" | "all" = "all",
) {
  if (id) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, viewer.id), eq(notifications.id, id)));
    return;
  }

  const typeFilter =
    scope === "messages"
      ? inArray(notifications.type, ["message", "message_request"])
      : scope === "general"
        ? notInArray(notifications.type, ["message", "message_request"])
        : undefined;

  const conditions = [
    eq(notifications.userId, viewer.id),
    isNull(notifications.readAt),
  ];

  if (typeFilter) {
    conditions.push(typeFilter);
  }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conditions));
}

export async function sessionPayload(user: AuthUser): Promise<SessionUser> {
  const [counts] = await db
    .select({
      followers: sql<number>`(select count(*)::int from ${follows} where ${follows.followingId} = ${user.id} and ${follows.state} = 'accepted')`,
      following: sql<number>`(select count(*)::int from ${follows} where ${follows.followerId} = ${user.id} and ${follows.state} = 'accepted')`,
      moments: sql<number>`(select count(*)::int from ${moments} where ${moments.authorId} = ${user.id})`,
      unreadNotifications: sql<number>`(
        select count(*)::int
        from ${notifications}
        where ${notifications.userId} = ${user.id}
          and ${notifications.readAt} is null
          and ${notifications.type} not in ('message', 'message_request')
      )`,
      requests: sql<number>`(select count(*)::int from ${conversationMembers} where ${conversationMembers.userId} = ${user.id} and ${conversationMembers.state} = 'requested')`,
    })
    .from(users)
    .where(eq(users.id, user.id));

  const [unread] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(
      conversationMembers,
      and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, user.id)),
    )
    .where(
      and(
        eq(conversationMembers.state, "active"),
        ne(messages.senderId, user.id),
        eq(messages.isSystem, false),
        or(isNull(conversationMembers.lastReadAt), gt(messages.createdAt, conversationMembers.lastReadAt)),
        or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
      ),
    );

  return {
    ...toPublicUser(user),
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phone: user.phone,
    messagePermission: user.messagePermission,
    notificationPrefs: normalizePrefs(user.notificationPrefs),
    sensitiveContent: user.sensitiveContent,
    onboarded: user.onboardedAt !== null,
    isAdmin: isAdminUser(user),
    counts: {
      followers: Number(counts?.followers ?? 0),
      following: Number(counts?.following ?? 0),
      moments: Number(counts?.moments ?? 0),
      unreadNotifications: Number(counts?.unreadNotifications ?? 0),
      unreadMessages: Number(unread?.c ?? 0),
      requests: Number(counts?.requests ?? 0),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Messaging
 * ------------------------------------------------------------------ */

export function conversationExpiryLabel(kind: "direct" | "group", sec: number | null) {
  return describeDisappearing(kind, sec).label;
}

export function conversationExpiryExplanation(kind: "direct" | "group", sec: number | null) {
  return describeDisappearing(kind, sec).explanation;
}

export async function findDirectConversation(userA: number, userB: number) {
  const directKey = [userA, userB].sort((a, b) => a - b).join(":");
  const rows = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.directKey, directKey)).limit(1);
  return rows[0]?.id ?? null;
}

export async function ensureDirectConversation(viewer: AuthUser, targetUsername: string) {
  const [target] = await db.select().from(users).where(eq(users.username, targetUsername.toLowerCase())).limit(1);
  if (!target) return { error: "not_found" as const };
  if (target.id === viewer.id) return { error: "self" as const };
  const existing = await findDirectConversation(viewer.id, target.id);
  if (existing) return { conversationId: existing, created: false, requested: false };
  const relation = await getRelation(viewer.id, target.id);
  const permission = canMessage(viewer.id, { id: target.id, messagePermission: target.messagePermission, isOfficial: target.isOfficial }, relation);
  if (!permission.allowed) {
    return { error: "not_allowed" as const, message: messagePermissionBlockCopy(permission.reason, target.name) };
  }
  const state: MemberState = permission.shouldRequest ? "requested" : "active";
  const directKey = [viewer.id, target.id].sort((a, b) => a - b).join(":");
  const [conversation] = await db
    .insert(conversations)
    .values({ kind: "direct", createdById: viewer.id, directKey, disappearAfterSec: DISAPPEAR_SECONDS["24h"] })
    .returning();
  await db.insert(conversationMembers).values([
    { conversationId: conversation.id, userId: viewer.id, state: "active", role: "member" },
    { conversationId: conversation.id, userId: target.id, state, role: "member" },
  ]);
  if (state === "requested") {
    await createNotification({
      userId: target.id,
      type: "message_request",
      actorId: viewer.id,
      entityType: "conversation",
      entityId: conversation.id,
      preview: "Sent you a message request",
    });
  }
  return { conversationId: conversation.id, created: true, requested: state === "requested" };
}

export async function createGroupConversation(creator: AuthUser, memberUsernames: string[], title: string, imageUrl: string | null) {
  const rows = memberUsernames.length
    ? await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(and(inArray(users.username, memberUsernames.map((u) => u.toLowerCase())), eq(users.isOfficial, false)))
    : [];
  if (rows.length === 0) return null;
  const [conversation] = await db
    .insert(conversations)
    .values({ kind: "group", createdById: creator.id, title, imageUrl, disappearAfterSec: DISAPPEAR_SECONDS["7d"] })
    .returning();
  await db.insert(conversationMembers).values([
    { conversationId: conversation.id, userId: creator.id, role: "admin", state: "active" },
    ...rows.map((row) => ({ conversationId: conversation.id, userId: row.id, role: "member" as const, state: "active" as const })),
  ]);
  await db.insert(messages).values({
    conversationId: conversation.id,
    senderId: creator.id,
    kind: "system",
    isSystem: true,
    body: `${creator.name} created this group. Messages here disappear 7 days after sending.`,
  });
  for (const row of rows) {
    await createNotification({
      userId: row.id,
      type: "message",
      actorId: creator.id,
      entityType: "conversation",
      entityId: conversation.id,
      preview: `Added you to ${title}`,
    });
  }
  return conversation.id;
}

export async function listConversations(
  viewer: AuthUser,
  tab: "inbox" | "requests",
): Promise<ConversationSummary[]> {
  const memberships = await db
    .select({
      conversationId: conversationMembers.conversationId,
      state: conversationMembers.state,
      kind: conversations.kind,
      title: conversations.title,
      imageUrl: conversations.imageUrl,
      lastMessageAt: conversations.lastMessageAt,
      disappearAfterSec: conversations.disappearAfterSec,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(
      and(
        eq(conversationMembers.userId, viewer.id),
        tab === "requests" ? eq(conversationMembers.state, "requested") : eq(conversationMembers.state, "active"),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt));

  if (memberships.length === 0) return [];
  const ids = memberships.map((m) => m.conversationId);
  const now = new Date();

  const [memberRows, lastMessages, unreadRows] = await Promise.all([
    db
      .select({ conversationId: conversationMembers.conversationId, ...PUBLIC_USER_COLUMNS })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(inArray(conversationMembers.conversationId, ids)),
    db
      .select({
        conversationId: messages.conversationId,
        body: messages.body,
        kind: messages.kind,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
        isSystem: messages.isSystem,
        deletedAt: messages.deletedAt,
      })
      .from(messages)
      .where(and(inArray(messages.conversationId, ids), or(isNull(messages.expiresAt), gt(messages.expiresAt, now))))
      .orderBy(desc(messages.createdAt)),
    db
      .select({ conversationId: messages.conversationId, c: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(
        conversationMembers,
        and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, viewer.id)),
      )
      .where(
        and(
          inArray(messages.conversationId, ids),
          ne(messages.senderId, viewer.id),
          eq(messages.isSystem, false),
          or(isNull(conversationMembers.lastReadAt), gt(messages.createdAt, conversationMembers.lastReadAt)),
          or(isNull(messages.expiresAt), gt(messages.expiresAt, now)),
        ),
      )
      .groupBy(messages.conversationId),
  ]);

  const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, Number(r.c)]));
  const lastMap = new Map<number, (typeof lastMessages)[number]>();
  for (const msg of lastMessages) if (!lastMap.has(msg.conversationId)) lastMap.set(msg.conversationId, msg);

  return memberships.map((m) => {
    const members = memberRows.filter((r) => r.conversationId === m.conversationId).map((r) => toPublicUser(r));
    const others = members.filter((u) => u.id !== viewer.id);
    const last = lastMap.get(m.conversationId);
    const preview = last
      ? last.deletedAt
        ? "Message deleted"
        : last.isSystem
        ? last.body
        : last.kind === "text"
          ? last.body
          : last.kind === "voice"
            ? "Voice message"
            : last.kind === "image"
              ? "Photo"
              : "Video"
      : null;
    return {
      id: m.conversationId,
      kind: m.kind,
      title: m.kind === "group" ? m.title ?? "Group" : others[0]?.name ?? "Conversation",
      imageUrl: m.kind === "group" ? m.imageUrl : others[0]?.avatarUrl ?? null,
      members,
      memberCount: members.length,
      state: m.state,
      isRequest: m.state === "requested",
      lastMessagePreview: preview,
      lastMessageAt: (last?.createdAt ?? m.lastMessageAt).toISOString(),
      unreadCount: unreadMap.get(m.conversationId) ?? 0,
      expiryLabel: conversationExpiryLabel(m.kind, m.disappearAfterSec),
      lastMessageFromMe: last?.senderId === viewer.id,
    } satisfies ConversationSummary;
  });
}

function replyPreview(m: { kind: MessageView["kind"]; body: string; deletedAt: Date | null }) {
  if (m.deletedAt) return "Message deleted";
  if (m.kind === "voice") return "Voice message";
  if (m.kind === "image") return "Photo";
  if (m.kind === "video") return "Video";
  return m.body.slice(0, 80);
}

export async function getConversationDetail(viewer: AuthUser, conversationId: number): Promise<ConversationDetail | null> {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return null;
  const [membership] = await db
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)))
    .limit(1);
  if (!membership || membership.state === "declined" || membership.state === "left" || membership.state === "removed") return null;

  const memberRows = await db
    .select({
      ...PUBLIC_USER_COLUMNS,
      role: conversationMembers.role,
      state: conversationMembers.state,
      lastReadAt: conversationMembers.lastReadAt,
      lastActiveAt: users.lastActiveAt,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(eq(conversationMembers.conversationId, conversationId));

  const now = new Date();
  const messageRows = await db
    .select({
      id: messages.id,
      kind: messages.kind,
      body: messages.body,
      mediaUrl: messages.mediaUrl,
      durationSec: messages.durationSec,
      isSystem: messages.isSystem,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      expiresAt: messages.expiresAt,
      firstViewedAt: messages.firstViewedAt,
      editedAt: messages.editedAt,
      deletedAt: messages.deletedAt,
      deletedById: messages.deletedById,
      replyToId: messages.replyToId,
      ttlSec: messages.ttlSec,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        isNull(messages.expiredAt),
        or(isNull(messages.expiresAt), gt(messages.expiresAt, now)),
      ),
    )
    .orderBy(messages.createdAt)
    .limit(200);

  const senderMap = new Map(
    memberRows.map((m) => [
      m.id,
      toPublicUser(m),
    ]),
  );

  const others = memberRows.filter((m) => m.id !== viewer.id && m.state === "active");
  const rowById = new Map(messageRows.map((r) => [r.id, r]));
  const resolveReply = (replyToId: number | null): MessageView["replyTo"] => {
    if (!replyToId) return null;
    const target = rowById.get(replyToId);
    if (!target) return null;
    return {
      id: target.id,
      senderName: senderMap.get(target.senderId)?.name ?? "Someone",
      preview: replyPreview(target),
      deleted: target.deletedAt !== null,
    };
  };
  const reactionRows = messageRows.length
    ? await db
        .select({ messageId: messageReactions.messageId, userId: messageReactions.userId, emoji: messageReactions.emoji })
        .from(messageReactions)
        .where(inArray(messageReactions.messageId, messageRows.map((r) => r.id)))
        .orderBy(messageReactions.createdAt)
    : [];
  const reactionsByMessage = new Map<number, typeof reactionRows>();
  for (const row of reactionRows) reactionsByMessage.set(row.messageId, [...(reactionsByMessage.get(row.messageId) ?? []), row]);
  const messageViewsList: MessageView[] = messageRows.map((m) => {
    const isMine = m.senderId === viewer.id;
    const disappears = !m.isSystem && m.ttlSec !== null;
    const notViewedYet = conversation.kind === "direct" && disappears && m.firstViewedAt === null;
    const label = m.isSystem
      ? null
      : notViewedYet
        ? EXPIRY_COPY.directNotViewed
        : m.expiresAt
          ? timeLeftLabel(m.expiresAt.toISOString())
          : null;
    let status: MessageView["status"] = "sent";
    if (isMine && !m.isSystem && conversation.kind === "group") {
      const readByAll = others.every((other) => other.lastReadAt && other.lastReadAt >= m.createdAt);
      status = readByAll ? "viewed" : "sent";
    }
    if (isMine && !m.isSystem && conversation.kind === "direct") {
      status = m.firstViewedAt ? "viewed" : "sent";
    }
    const deleted = m.deletedAt !== null;
    const isAdminHere = conversation.kind === "group" && membership.role === "admin" && membership.state === "active";
    return {
      id: m.id,
      kind: m.kind,
      // Deleted messages never leave the server with their content.
      body: deleted ? "" : m.body,
      mediaUrl: deleted ? null : m.mediaUrl,
      durationSec: deleted ? null : m.durationSec,
      isSystem: m.isSystem,
      createdAt: m.createdAt.toISOString(),
      sender: senderMap.get(m.senderId) ?? null,
      isMine,
      status,
      expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
      expiresLabel: label,
      notViewedYet: deleted ? false : notViewedYet,
      expired: false,
      editedAt: m.editedAt ? m.editedAt.toISOString() : null,
      deleted,
      deletedBy: deleted ? (m.deletedById === m.senderId ? "sender" : "admin") : null,
      canEdit: !deleted && !m.isSystem && isMine && (m.kind === "text" || m.kind === "image" || m.kind === "video"),
      canDelete: !deleted && !m.isSystem && (isMine || isAdminHere),
      disappears,
      reactions: deleted ? [] : summarizeMessageReactions(reactionsByMessage.get(m.id) ?? [], viewer.id),
      replyTo: deleted ? null : resolveReply(m.replyToId),
    } satisfies MessageView;
  });

  const isAdminHere0 = conversation.kind === "group" && membership.role === "admin" && membership.state === "active";
  return {
    conversation: {
      id: conversation.id,
      kind: conversation.kind,
      title: conversation.kind === "group" ? conversation.title ?? "Group" : others[0]?.name ?? "Conversation",
      imageUrl: conversation.kind === "group" ? conversation.imageUrl : others[0]?.avatarUrl ?? null,
      members: memberRows.filter((m) => m.state === "active" || m.state === "requested").map((m) => ({ ...toPublicUser(m), role: m.role, state: m.state, lastActiveAt: m.lastActiveAt.toISOString() })),
      state: membership.state,
      createdAt: conversation.createdAt.toISOString(),
      expiryLabel: conversationExpiryLabel(conversation.kind, conversation.disappearAfterSec),
      expiryExplanation: conversationExpiryExplanation(conversation.kind, conversation.disappearAfterSec),
      disappearAfterSec: conversation.disappearAfterSec,
      canChangeDisappearing: conversation.kind === "group" ? isAdminHere0 : membership.state === "active",
      messagePermissionBlocked: false,
      membersMuted: conversation.kind === "group" ? conversation.membersMuted : false,
    },
    messages: messageViewsList,
  };
}

/** Marks messages as viewed by `viewer`, starting the 24h direct countdown. */
export async function markConversationRead(viewer: AuthUser, conversationId: number) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return;

  const [membership] = await db
    .select({ id: conversationMembers.id, state: conversationMembers.state })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, viewer.id),
      ),
    )
    .limit(1);

  if (!membership || membership.state === "left" || membership.state === "declined" || membership.state === "removed") {
    throw new Error("forbidden");
  }

  const now = new Date();
  const unread = await db
    .select({ id: messages.id, senderId: messages.senderId, ttlSec: messages.ttlSec, kind: messages.kind })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, viewer.id),
        isNull(messages.firstViewedAt),
        isNull(messages.deletedAt),
        isNull(messages.expiredAt),
      ),
    );
  if (unread.length) {
    const ids = unread.map((m) => m.id);
    await db.insert(messageViews).values(ids.map((id) => ({ messageId: id, userId: viewer.id }))).onConflictDoNothing();
    await db.update(messages).set({ firstViewedAt: now }).where(and(inArray(messages.id, ids), isNull(messages.firstViewedAt)));
    if (conversation.kind === "direct") {
      // Each message carries the timer it was sent under: start that countdown now.
      const byTtl = new Map<number, number[]>();
      for (const m of unread) {
        if (m.ttlSec === null) continue; // sent with disappearing messages off
        // Instant voice/video: the countdown starts when playback ends (see markPlaybackEnded).
        if (m.ttlSec === 0 && (m.kind === "voice" || m.kind === "video")) continue;
        byTtl.set(m.ttlSec, [...(byTtl.get(m.ttlSec) ?? []), m.id]);
      }
      for (const [ttl, messageIds] of byTtl) {
        const seconds = ttl === 0 ? INSTANT_GRACE_SEC : ttl;
        await db
          .update(messages)
          .set({ expiresAt: new Date(now.getTime() + seconds * 1000) })
          .where(inArray(messages.id, messageIds));
      }
    }
    const senderIds = Array.from(new Set(unread.map((m) => m.senderId)));
    for (const senderId of senderIds) {
      await createNotification({
        userId: senderId,
        type: "message",
        actorId: viewer.id,
        entityType: "conversation",
        entityId: conversationId,
        preview: "Viewed your message",
      });
    }
  }
  await db
    .update(conversationMembers)
    .set({ lastReadAt: now })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)));
}

/** Instant voice/video: start the countdown once the recipient has finished playing it. */
export async function markPlaybackEnded(viewer: AuthUser, conversationId: number, messageId: number) {
  const [row] = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      ttlSec: messages.ttlSec,
      expiresAt: messages.expiresAt,
      kind: messages.kind,
      conversationId: messages.conversationId,
      type: conversations.kind,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
    .limit(1);
  if (!row) throw new Error("not_found");
  if (row.senderId === viewer.id || row.type !== "direct" || row.ttlSec !== 0 || row.expiresAt) return;
  if (row.kind !== "voice" && row.kind !== "video") return;
  const [membership] = await db
    .select({ state: conversationMembers.state })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)))
    .limit(1);
  if (!membership || ["left", "declined", "removed"].includes(membership.state)) throw new Error("forbidden");
  await db
    .update(messages)
    .set({ expiresAt: new Date(Date.now() + INSTANT_GRACE_SEC * 1000) })
    .where(and(eq(messages.id, messageId), isNull(messages.expiresAt)));
}

export async function sendMessage(
  viewer: AuthUser,
  conversationId: number,
  input: { kind: MessageView["kind"]; body?: string; mediaUrl?: string | null; durationSec?: number | null; replyToId?: number | null },
): Promise<MessageView> {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) throw new Error("not_found");
  const [membership] = await db
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)))
    .limit(1);
  if (!membership || membership.state === "declined" || membership.state === "left" || membership.state === "removed") throw new Error("forbidden");

  if (conversation.kind === "group" && conversation.membersMuted && membership.role !== "admin") {
    throw new Error("group_muted");
  }

  // A reply must point at a live message in this same conversation.
  let replyTarget: { id: number; senderId: number; kind: MessageView["kind"]; body: string; deletedAt: Date | null } | null = null;
  if (input.replyToId) {
    const [target] = await db
      .select({ id: messages.id, senderId: messages.senderId, kind: messages.kind, body: messages.body, deletedAt: messages.deletedAt, isSystem: messages.isSystem })
      .from(messages)
      .where(and(eq(messages.id, input.replyToId), eq(messages.conversationId, conversationId)))
      .limit(1);
    if (!target || target.isSystem) throw new Error("reply_not_found");
    replyTarget = target;
  }

  const mediaId = await ownedMediaId(viewer.id, input.mediaUrl);
  const now = new Date();
  // The message is stamped with the conversation's current setting (null = disappearing messages are off).
  const ttlSec = conversation.disappearAfterSec;
  const expiresAt = conversation.kind === "group" && ttlSec !== null ? new Date(now.getTime() + ttlSec * 1000) : null;
  const [created] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId: viewer.id,
      kind: input.kind,
      body: input.body ?? "",
      mediaId,
      mediaUrl: input.mediaUrl ?? null,
      durationSec: input.durationSec ?? null,
      isSystem: false,
      replyToId: replyTarget?.id ?? null,
      ttlSec,
      expiresAt,
      maxRetentionAt: ttlSec === null ? null : new Date(now.getTime() + MESSAGE_EXPIRY.maxUnviewedRetentionMs),
    })
    .returning();
  await db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversationId));
  await db
    .update(conversationMembers)
    .set({ lastReadAt: now })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)));

  const others = await db
    .select({ userId: conversationMembers.userId, state: conversationMembers.state })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), ne(conversationMembers.userId, viewer.id)));
  const summary =
    input.kind === "text" ? (input.body ?? "").slice(0, 90) : `Sent you a ${input.kind === "voice" ? "voice message" : input.kind}`;
  for (const other of others) {
    // In a group, the person whose message was replied to gets a dedicated "reply" notification
    // (instead of the generic one) so they know it was aimed at them.
    const isRepliedTo =
      conversation.kind === "group" && replyTarget !== null && replyTarget.senderId === other.userId && other.state !== "requested";
    await createNotification({
      userId: other.userId,
      type: isRepliedTo ? "reply" : other.state === "requested" ? "message_request" : "message",
      actorId: viewer.id,
      entityType: "conversation",
      entityId: conversationId,
      preview: isRepliedTo ? `Replied to you: ${summary}` : summary,
    });
  }

  return {
    id: created.id,
    kind: created.kind,
    body: created.body,
    mediaUrl: created.mediaUrl,
    durationSec: created.durationSec,
    isSystem: false,
    createdAt: created.createdAt.toISOString(),
    sender: toPublicUser(viewer),
    isMine: true,
    status: "sent",
    expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
    expiresLabel:
      conversation.kind === "group" ? timeLeftLabel(created.expiresAt?.toISOString() ?? null) : EXPIRY_COPY.directNotViewed,
    notViewedYet: conversation.kind === "direct" && ttlSec !== null,
    disappears: ttlSec !== null,
    expired: false,
    editedAt: null,
    deleted: false,
    deletedBy: null,
    canEdit: created.kind === "text" || created.kind === "image" || created.kind === "video",
    canDelete: true,
    reactions: [],
    replyTo: replyTarget
      ? {
          id: replyTarget.id,
          senderName: replyTarget.senderId === viewer.id ? viewer.name : (await db.select({ name: users.name }).from(users).where(eq(users.id, replyTarget.senderId)).limit(1))[0]?.name ?? "Someone",
          preview: replyPreview(replyTarget),
          deleted: replyTarget.deletedAt !== null,
        }
      : null,
  };
}

/** Edit your own text message (1:1 or group). Admins can never edit other people's messages. */
export async function editMessage(viewer: AuthUser, conversationId: number, messageId: number, rawBody: string) {
  await requireActiveConversationMember(viewer, conversationId);
  const body = rawBody.trim();
  if (body.length > 4000) throw new Error("too_long");
  const now = new Date();
  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
    .limit(1);
  if (!message || message.isSystem || message.expiredAt || (message.expiresAt && message.expiresAt <= now)) throw new Error("not_found");
  if (message.deletedAt) throw new Error("message_deleted");
  if (message.senderId !== viewer.id) throw new Error("not_author");
  // Text messages and photo/video captions can be edited; a caption may be cleared, a text message may not.
  if (message.kind !== "text" && message.kind !== "image" && message.kind !== "video") throw new Error("not_text");
  if (message.kind === "text" && body.length === 0) throw new Error("empty");
  if (message.body === body) return { id: message.id, body: message.body, editedAt: message.editedAt?.toISOString() ?? null };
  const [updated] = await db.update(messages).set({ body, editedAt: now }).where(eq(messages.id, messageId)).returning();
  return { id: updated.id, body: updated.body, editedAt: now.toISOString() };
}

/**
 * Delete a message for everyone. Senders can delete their own messages anywhere;
 * in groups an admin can also delete anyone's message. The row stays as a tombstone, the content does not.
 */
export async function deleteMessage(viewer: AuthUser, conversationId: number, messageId: number) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) throw new Error("not_found");
  const membership = await requireActiveConversationMember(viewer, conversationId);
  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
    .limit(1);
  if (!message || message.isSystem) throw new Error("not_found");
  if (message.deletedAt) return { id: message.id, deleted: true };
  const isAuthor = message.senderId === viewer.id;
  const isGroupAdmin = conversation.kind === "group" && membership.role === "admin" && membership.state === "active";
  if (!isAuthor && !isGroupAdmin) throw new Error("not_author");

  const mediaId = message.mediaId ?? (await ownedMediaId(message.senderId, message.mediaUrl).catch(() => null));
  await db
    .update(messages)
    .set({ body: "", mediaUrl: null, mediaId: null, durationSec: null, deletedAt: new Date(), deletedById: viewer.id })
    .where(eq(messages.id, messageId));
  if (mediaId) await deleteAsset(mediaId);
  return { id: message.id, deleted: true };
}

function summarizeMessageReactions(rows: { userId: number; emoji: string }[], viewerId: number): MessageView["reactions"] {
  const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const row of rows) {
    const entry = byEmoji.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    entry.count += 1;
    if (row.userId === viewerId) entry.mine = true;
    byEmoji.set(row.emoji, entry);
  }
  return Array.from(byEmoji.values()).sort((a, b) => b.count - a.count);
}

function reactionTargetLabel(message: { kind: MessageView["kind"]; body: string }) {
  if (message.kind === "voice") return "your voice message";
  if (message.kind === "image") return "your photo";
  if (message.kind === "video") return "your video";
  return `your message: ${message.body.slice(0, 70)}`;
}

/** Set, change or (emoji null / the same emoji) remove the viewer's reaction. Any emoji is allowed. */
export async function reactToMessage(viewer: AuthUser, conversationId: number, messageId: number, emojiInput: string | null) {
  await requireActiveConversationMember(viewer, conversationId);
  const now = new Date();
  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
    .limit(1);
  if (!message || message.isSystem || message.expiredAt || (message.expiresAt && message.expiresAt <= now)) throw new Error("not_found");
  if (message.deletedAt) throw new Error("message_deleted");

  let emoji: string | null = null;
  if (emojiInput !== null && emojiInput !== "") {
    emoji = normalizeEmoji(emojiInput);
    if (!emoji) throw new Error("invalid_emoji");
  }

  const [existing] = await db
    .select({ id: messageReactions.id, emoji: messageReactions.emoji })
    .from(messageReactions)
    .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, viewer.id)))
    .limit(1);

  if (!emoji || existing?.emoji === emoji) {
    if (existing) await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
  } else {
    await db
      .insert(messageReactions)
      .values({ messageId, userId: viewer.id, emoji })
      .onConflictDoUpdate({ target: [messageReactions.messageId, messageReactions.userId], set: { emoji, createdAt: now } });
    // The message's author is told, in 1:1 chats and groups alike (never for their own reaction or a removal).
    await createNotification({
      userId: message.senderId,
      type: "reaction",
      actorId: viewer.id,
      entityType: "conversation",
      entityId: conversationId,
      preview: `Reacted ${emoji} to ${reactionTargetLabel(message)}`,
    });
  }

  const rows = await db
    .select({ userId: messageReactions.userId, emoji: messageReactions.emoji })
    .from(messageReactions)
    .where(eq(messageReactions.messageId, messageId))
    .orderBy(messageReactions.createdAt);
  return { messageId, reactions: summarizeMessageReactions(rows, viewer.id) };
}

async function requireActiveConversationMember(viewer: AuthUser, conversationId: number) {
  const [membership] = await db
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)))
    .limit(1);
  if (!membership || membership.state === "declined" || membership.state === "left" || membership.state === "removed") throw new Error("forbidden");
  return membership;
}

async function requireGroupAdmin(viewer: AuthUser, conversationId: number) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) throw new Error("not_found");
  const membership = await requireActiveConversationMember(viewer, conversationId);
  if (conversation.kind !== "group" || membership.role !== "admin") throw new Error("admin_required");
  return { conversation, membership };
}

export async function joinGroupByInvite(viewer: AuthUser, token: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.kind, "group"), eq(conversations.inviteToken, token)))
    .limit(1);
  if (!conversation) return { ok: false as const };

  const [existing] = await db
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversation.id), eq(conversationMembers.userId, viewer.id)))
    .limit(1);
  if (existing?.state === "active") return { ok: true as const, conversationId: conversation.id };
  // Removed by an admin: the old invite link must not be a way back in. An admin can add them again.
  if (existing?.state === "removed") throw new Error("removed");
  if (existing) {
    await db.update(conversationMembers).set({ state: "active", joinedAt: new Date() }).where(eq(conversationMembers.id, existing.id));
  } else {
    await db.insert(conversationMembers).values({ conversationId: conversation.id, userId: viewer.id, role: "member", state: "active" });
  }
  return { ok: true as const, conversationId: conversation.id };
}

export async function respondToConversation(
  viewer: AuthUser,
  conversationId: number,
  action: "accept" | "decline" | "leave" | "mute" | "unmute" | "rename" | "add-member" | "promote" | "remove-member" | "set-disappearing" | "mute-members" | "unmute-members" | "invite",
  value?: string,
) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation) return { ok: false as const };

  switch (action) {
    case "accept": {
      await db
        .update(conversationMembers)
        .set({ state: "active" })
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)));
      return { ok: true as const, message: "Message request accepted. The conversation is now in your inbox." };
    }
    case "decline": {
      await db
        .update(conversationMembers)
        .set({ state: "declined" })
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)));
      return { ok: true as const, message: "Request declined. They are not told about this." };
    }
    case "leave": {
      const membership = await requireActiveConversationMember(viewer, conversationId);
      if (conversation.kind === "group" && membership.role === "admin") {
        const admins = await db
          .select({ id: conversationMembers.id })
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, conversationId),
              eq(conversationMembers.role, "admin"),
              eq(conversationMembers.state, "active"),
            ),
          );
        if (admins.length <= 1) throw new Error("last_admin");
      }
      await db
        .update(conversationMembers)
        .set({ state: "left" })
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)));
      if (conversation.kind === "group") {
        await db.insert(messages).values({
          conversationId,
          senderId: viewer.id,
          kind: "system",
          isSystem: true,
          body: `${viewer.name} left the group.`,
        });
      }
      return { ok: true as const, message: "You left the group." };
    }
    case "mute":
    case "unmute": {
      await requireActiveConversationMember(viewer, conversationId);
      await db
        .update(conversationMembers)
        .set({ muted: action === "mute" })
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)));
      return { ok: true as const, message: action === "mute" ? "Notifications muted." : "Notifications on." };
    }
    case "rename": {
      if (!value) return { ok: false as const };
      await requireGroupAdmin(viewer, conversationId);
      await db.update(conversations).set({ title: value }).where(eq(conversations.id, conversationId));
      return { ok: true as const, message: "Group renamed." };
    }
    case "add-member": {
      await requireGroupAdmin(viewer, conversationId);
      const username = value?.trim().toLowerCase();
      if (!username) return { ok: false as const };
      const [target] = await db
        .select({ id: users.id, name: users.name, isOfficial: users.isOfficial })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      if (!target || target.isOfficial) throw new Error("user_not_found");
      if (target.id === viewer.id) throw new Error("self_member");
      const [existing] = await db
        .select()
        .from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, target.id)))
        .limit(1);
      if (existing?.state === "active" || existing?.state === "requested") throw new Error("already_member");
      if (existing) {
        await db.update(conversationMembers).set({ state: "active", role: "member", joinedAt: new Date() }).where(eq(conversationMembers.id, existing.id));
      } else {
        await db.insert(conversationMembers).values({ conversationId, userId: target.id, role: "member", state: "active" });
      }
      await createNotification({
        userId: target.id,
        type: "message",
        actorId: viewer.id,
        entityType: "conversation",
        entityId: conversationId,
        preview: `Added you to ${conversation.title ?? "a group"}`,
      });
      return { ok: true as const, message: `${target.name} was added to the group.` };
    }
    case "set-disappearing": {
      const options = ["off", "instant", "24h", "7d", "30d"] as const;
      const choice = options.find((option) => option === value);
      if (!choice) return { ok: false as const };
      const actor = viewer;
      if (conversation.kind === "group") {
        // Only admins control a group's timer, and "instant" only makes sense for 1:1 chats.
        await requireGroupAdmin(viewer, conversationId);
        if (choice === "instant") throw new Error("invalid_choice");
      } else {
        const membership = await requireActiveConversationMember(viewer, conversationId);
        if (membership.state !== "active") throw new Error("forbidden");
      }
      const seconds = choice === "off" ? null : DISAPPEAR_SECONDS[choice];
      await db.update(conversations).set({ disappearAfterSec: seconds }).where(eq(conversations.id, conversationId));
      const described = describeDisappearing(conversation.kind, seconds);
      await db.insert(messages).values({
        conversationId,
        senderId: actor.id,
        kind: "system",
        isSystem: true,
        body:
          seconds === null
            ? `${actor.name} turned off disappearing messages.`
            : `${actor.name} turned on disappearing messages. ${described.label}.`,
      });
      await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
      return {
        ok: true as const,
        message: seconds === null ? "Disappearing messages are off. New messages will stay." : `${described.label}. This applies to new messages.`,
      };
    }
    case "remove-member": {
      // Only admins can remove people. Regular members can only leave on their own.
      await requireGroupAdmin(viewer, conversationId);
      const username = value?.trim().toLowerCase();
      if (!username) return { ok: false as const };
      const [target] = await db
        .select({ id: conversationMembers.id, userId: users.id, name: users.name, state: conversationMembers.state })
        .from(conversationMembers)
        .innerJoin(users, eq(users.id, conversationMembers.userId))
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(users.username, username)))
        .limit(1);
      if (!target || (target.state !== "active" && target.state !== "requested")) throw new Error("member_not_found");
      if (target.userId === viewer.id) throw new Error("use_leave");
      await db.update(conversationMembers).set({ state: "removed", role: "member" }).where(eq(conversationMembers.id, target.id));
      await db.insert(messages).values({
        conversationId,
        senderId: viewer.id,
        kind: "system",
        isSystem: true,
        body: `${target.name} was removed from the group by ${viewer.name}.`,
      });
      await createNotification({
        userId: target.userId,
        type: "system",
        actorId: viewer.id,
        entityType: null,
        entityId: null,
        preview: `You were removed from ${conversation.title ?? "a group"}`,
      });
      return { ok: true as const, message: `${target.name} was removed from the group.` };
    }
    case "promote": {
      await requireGroupAdmin(viewer, conversationId);
      const username = value?.trim().toLowerCase();
      if (!username) return { ok: false as const };
      const [target] = await db
        .select({ id: conversationMembers.id, role: conversationMembers.role, state: conversationMembers.state })
        .from(conversationMembers)
        .innerJoin(users, eq(users.id, conversationMembers.userId))
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(users.username, username)))
        .limit(1);
      if (!target || target.state !== "active") throw new Error("member_not_found");
      if (target.role === "admin") return { ok: true as const, message: "That member is already an admin." };
      await db.update(conversationMembers).set({ role: "admin" }).where(eq(conversationMembers.id, target.id));
      return { ok: true as const, message: "Member promoted to admin." };
    }
    case "mute-members":
    case "unmute-members": {
      await requireGroupAdmin(viewer, conversationId);
      await db.update(conversations).set({ membersMuted: action === "mute-members" }).where(eq(conversations.id, conversationId));
      return { ok: true as const, message: action === "mute-members" ? "Members can no longer send messages. Admins can still send." : "Members can send messages again." };
    }
    case "invite": {
      await requireGroupAdmin(viewer, conversationId);
      let token = conversation.inviteToken;
      if (!token) {
        token = randomBytes(32).toString("base64url");
        await db.update(conversations).set({ inviteToken: token }).where(eq(conversations.id, conversationId));
      }
      return { ok: true as const, message: "Invitation link ready.", invitePath: `/messages/invite/${token}` };
    }
    default:
      return { ok: false as const };
  }
}

/** Server-side expiration enforcement + storage cleanup. Moments are never affected. */
export async function runExpirySweep() {
  const now = new Date();
  const expired = await db
    .select({ id: messages.id, mediaId: messages.mediaId })
    .from(messages)
    .where(and(eq(messages.isSystem, false), or(lt(messages.expiresAt, now), lt(messages.maxRetentionAt, now))));
  let removed = 0;
  if (expired.length) {
    const ids = expired.map((m) => m.id);
    await db.delete(messageViews).where(inArray(messageViews.messageId, ids));
    await db.delete(messages).where(inArray(messages.id, ids));
    removed = ids.length;
    const mediaIds = expired.map((m) => m.mediaId).filter((id): id is number => typeof id === "number");
    for (const id of mediaIds) await deleteAsset(id);
  }
  const orphanMedia = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(and(isNull(mediaAssets.deletedAt), lt(mediaAssets.expiresAt, now)));
  for (const asset of orphanMedia) await deleteAsset(asset.id);
  return { removed, mediaRemoved: orphanMedia.length };
}

let lastSweep = 0;
/** Cheap lazy sweeper so expiry is enforced even without an external scheduler. */
export async function sweepIfStale() {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  try {
    await runExpirySweep();
  } catch (error) {
    console.error("[bemblo:sweep]", error);
  }
}

/* ------------------------------------------------------------------ *
 * Search & profiles
 * ------------------------------------------------------------------ */

export async function searchAll(viewer: AuthUser, rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (query.length < 1) return { query, users: [], moments: [], recent: [] };
  const like = `%${query.replace(/[%_\\]/g, "")}%`;
  const { blockedIds, mutedIds } = await viewerExclusions(viewer.id);
  const exclusions = getExclusionList(viewer.id, blockedIds, mutedIds);
  const followingIds = await acceptedFollowingIds(viewer.id);

  const [userRows, momentRows, recentRows] = await Promise.all([
    db
      .select(PUBLIC_USER_COLUMNS)
      .from(users)
      .where(
        and(
          notInArray(users.id, [viewer.id, ...exclusions]),
          or(sql`${users.username} ilike ${like}`, sql`${users.name} ilike ${like}`),
        ),
      )
      .limit(12),
    db
      .select(momentSelect(viewer.id))
      .from(moments)
      .innerJoin(users, eq(users.id, moments.authorId))
      .where(and(discoveryWhere(viewer.id, followingIds, blockedIds, mutedIds), sql`${moments.body} ilike ${like}`))
      .orderBy(desc(moments.createdAt))
      .limit(12),
    db
      .select({ query: searchHistory.query })
      .from(searchHistory)
      .where(eq(searchHistory.userId, viewer.id))
      .orderBy(desc(searchHistory.createdAt))
      .limit(6),
  ]);

  const relations = await Promise.all(
    userRows.map(async (row) => ({ row, relation: await getRelation(viewer.id, row.id) })),
  );

  return {
    query,
    users: relations.map(({ row, relation }) => {
      const state: RelationState =
        relation.viewerBlockedTarget || relation.targetBlockedViewer
          ? "blocked"
          : relation.viewerFollows
            ? "following"
            : relation.viewerRequested
              ? "requested"
              : relation.targetFollows
                ? "follow_back"
                : "follow";
      return { ...toPublicUser(row), isFollowing: relation.viewerFollows, followsYou: relation.targetFollows, relation: state };
    }),
    moments: (momentRows as unknown as MomentRow[]).map((row) => mapMoment(row, viewer.id)),
    recent: recentRows.map((r) => r.query),
  };
}

export async function recordSearch(viewer: AuthUser, query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  await db.delete(searchHistory).where(and(eq(searchHistory.userId, viewer.id), eq(searchHistory.query, trimmed)));
  await db.insert(searchHistory).values({ userId: viewer.id, query: trimmed });
}

export async function userSummaryList(
  viewer: AuthUser,
  kind: "followers" | "following" | "pending" | "blocked" | "muted" | "suggestions" | "official",
): Promise<UserSummary[]> {
  let ids: number[] = [];
  if (kind === "official") {
    // Official accounts the viewer is not following yet (drives the "Follow BlueBelly" card).
    const following = await acceptedFollowingIds(viewer.id);
    const { blockedIds } = await viewerExclusions(viewer.id);
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isOfficial, true), notInArray(users.id, [viewer.id, ...following, ...blockedIds])))
      .limit(3);
    ids = rows.map((r) => r.id);
  } else if (kind === "suggestions") {
    const following = await acceptedFollowingIds(viewer.id);
    const { blockedIds } = await viewerExclusions(viewer.id);
    // The official BlueBelly account is always suggested first until the viewer follows it.
    const officialRows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isOfficial, true), notInArray(users.id, [viewer.id, ...following, ...blockedIds])))
      .limit(2);
    const officialIds = officialRows.map((r) => r.id);
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(notInArray(users.id, [viewer.id, ...following, ...blockedIds, ...officialIds]), eq(users.verified, true)))
      .orderBy(desc(users.lastActiveAt))
      .limit(6);
    ids = [...officialIds, ...rows.map((r) => r.id)];
    if (ids.length < 4) {
      const extra = await db
        .select({ id: users.id })
        .from(users)
        .where(notInArray(users.id, [viewer.id, ...following, ...blockedIds, ...ids]))
        .orderBy(desc(users.lastActiveAt))
        .limit(Math.max(6 - ids.length, 0));
      ids = [...ids, ...extra.map((r) => r.id)];
    }
  } else if (kind === "blocked") {
    const rows = await db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, viewer.id));
    ids = rows.map((r) => r.id);
  } else if (kind === "muted") {
    const rows = await db.select({ id: mutes.mutedId }).from(mutes).where(eq(mutes.userId, viewer.id));
    ids = rows.map((r) => r.id);
  } else if (kind === "pending") {
    const rows = await db
      .select({ id: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followingId, viewer.id), eq(follows.state, "pending")));
    ids = rows.map((r) => r.id);
  } else if (kind === "followers") {
    const rows = await db
      .select({ id: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followingId, viewer.id), eq(follows.state, "accepted")));
    ids = rows.map((r) => r.id);
  } else {
    const rows = await db
      .select({ id: follows.followingId })
      .from(follows)
      .where(and(eq(follows.followerId, viewer.id), eq(follows.state, "accepted")));
    ids = rows.map((r) => r.id);
  }

  if (ids.length === 0) return [];
  const userRows = (await db.select().from(users).where(inArray(users.id, ids))).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const mutedIds = kind === "muted" ? new Set(ids) : new Set<number>();
  return Promise.all(
    userRows.map(async (user) => {
      const relation = await getRelation(viewer.id, user.id);
      const permission = canMessage(viewer.id, { id: user.id, messagePermission: user.messagePermission, isOfficial: user.isOfficial }, relation);
      return {
        ...toPublicUser(user),
        isSelf: user.id === viewer.id,
        isFollowing: relation.viewerFollows,
        followsYou: relation.targetFollows,
        isBlocked: relation.viewerBlockedTarget,
        isMuted: mutedIds.has(user.id),
        requested: relation.viewerRequested,
        canMessage: permission.allowed,
        messageHint: permission.allowed
          ? permission.shouldRequest
            ? "Will arrive as a message request"
            : "You can message each other"
          : messagePermissionBlockCopy(permission.reason, user.name),
      } satisfies UserSummary;
    }),
  );
}

export async function listConnectionsOf(profileUserId: number, viewerId: number | null, kind: "followers" | "following") {
  const rows =
    kind === "followers"
      ? await db
          .select(PUBLIC_USER_COLUMNS)
          .from(follows)
          .innerJoin(users, eq(users.id, follows.followerId))
          .where(and(eq(follows.followingId, profileUserId), eq(follows.state, "accepted")))
      : await db
          .select(PUBLIC_USER_COLUMNS)
          .from(follows)
          .innerJoin(users, eq(users.id, follows.followingId))
          .where(and(eq(follows.followerId, profileUserId), eq(follows.state, "accepted")));

  return Promise.all(
    rows.map(async (row) => {
      const relation = viewerId ? await getRelation(viewerId, row.id) : null;
      const state: RelationState = !relation
        ? "follow"
        : viewerId === row.id
          ? "self"
          : relation.viewerBlockedTarget || relation.targetBlockedViewer
            ? "blocked"
            : relation.viewerFollows
              ? "following"
              : relation.viewerRequested
                ? "requested"
                : relation.targetFollows
                  ? "follow_back"
                  : "follow";
      return {
        ...toPublicUser(row),
        relation: state,
        followsYou: relation?.targetFollows ?? false,
        isFollowing: relation?.viewerFollows ?? false,
      };
    }),
  );
}

export async function profileCounts(userId: number) {
  const [row] = await db
    .select({
      followers: sql<number>`(select count(*)::int from ${follows} where ${follows.followingId} = ${userId} and ${follows.state} = 'accepted')`,
      following: sql<number>`(select count(*)::int from ${follows} where ${follows.followerId} = ${userId} and ${follows.state} = 'accepted')`,
      moments: sql<number>`(select count(*)::int from ${moments} where ${moments.authorId} = ${userId})`,
      pending: sql<number>`(select count(*)::int from ${follows} where ${follows.followingId} = ${userId} and ${follows.state} = 'pending')`,
    })
    .from(users)
    .where(eq(users.id, userId));
  return {
    followers: Number(row?.followers ?? 0),
    following: Number(row?.following ?? 0),
    moments: Number(row?.moments ?? 0),
    pending: Number(row?.pending ?? 0),
  };
}

export async function getPublicProfile(viewerId: number | null, username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  if (!user) return null;
  const relation = await getRelation(viewerId, user.id);
  const isSelf = viewerId === user.id;
  const blocked = relation.viewerBlockedTarget || relation.targetBlockedViewer;
  const restricted = !isSelf && !blocked && user.profilePrivacy === "private" && !relation.viewerFollows;
  const permission = viewerId
    ? canMessage(viewerId, { id: user.id, messagePermission: user.messagePermission, isOfficial: user.isOfficial }, relation)
    : ({ allowed: false, reason: "nobody", shouldRequest: false } as const);
  const counts = await profileCounts(user.id);
  const state: RelationState = isSelf
    ? "self"
    : blocked
      ? "blocked"
      : relation.viewerFollows
        ? "following"
        : relation.viewerRequested
          ? "requested"
          : relation.targetFollows
            ? "follow_back"
            : "follow";
  return {
    user: toPublicUser(user),
    isSelf,
    relation: state,
    restricted,
    restrictedReason: blocked ? (relation.viewerBlockedTarget ? "blocked" : "blocked_by") : restricted ? "private" : undefined,
    followerCount: counts.followers,
    followingCount: counts.following,
    momentCount: counts.moments,
    pendingRequests: isSelf ? counts.pending : 0,
    messageAllowed: permission.allowed,
    messageHint: permission.allowed
      ? permission.shouldRequest
        ? "Messaging allowed — your first message will arrive as a message request."
        : "You can message each other"
      : messagePermissionBlockCopy(permission.reason, user.name),
    isMuted: false,
    canViewFollowers: !restricted || isSelf,
    raw: user,
  };
}

export async function createSupportTicket(input: {
  userId: number | null;
  email: string;
  topic: string;
  subject: string;
  body: string;
}) {
  const [ticket] = await db.insert(supportTickets).values(input).returning();
  return ticket;
}

export async function listSupportTickets(userId: number) {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(20);
}

/* ------------------------------------------------------------------ *
 * Admin inbox: reports + support requests
 * ------------------------------------------------------------------ */

async function adminUserIds(): Promise<number[]> {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(emails.length ? or(eq(users.isAdmin, true), inArray(sql`lower(${users.email})`, emails)) : eq(users.isAdmin, true));
  return rows.map((row) => row.id);
}

/** Tell every admin that something new needs attention (in-app + push + email, via createNotification). */
export async function notifyAdmins(preview: string) {
  const ids = await adminUserIds();
  for (const id of ids) {
    await createNotification({ userId: id, type: "system", entityType: "admin", entityId: null, preview });
  }
}

export type AdminReportRow = {
  id: number;
  createdAt: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  reason: string;
  details: string | null;
  targetType: "user" | "moment" | "message" | "comment";
  targetId: number | null;
  targetLabel: string | null;
  targetHref: string | null;
  reporter: { username: string; name: string } | null;
  resolutionNote: string | null;
};

export type AdminTicketRow = {
  id: number;
  createdAt: string;
  status: "open" | "waiting" | "resolved";
  topic: string;
  subject: string;
  body: string;
  email: string;
  user: { username: string; name: string } | null;
  adminNote: string | null;
};

export async function getAdminInbox() {
  const reportRows = await db
    .select({
      id: reports.id,
      createdAt: reports.createdAt,
      status: reports.status,
      reason: reports.reason,
      details: reports.details,
      targetType: reports.targetType,
      targetId: reports.targetId,
      targetLabel: reports.targetLabel,
      resolutionNote: reports.resolutionNote,
      username: users.username,
      name: users.name,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterId))
    .orderBy(desc(reports.createdAt))
    .limit(200);
  const ticketRows = await db
    .select({
      id: supportTickets.id,
      createdAt: supportTickets.createdAt,
      status: supportTickets.status,
      topic: supportTickets.topic,
      subject: supportTickets.subject,
      body: supportTickets.body,
      email: supportTickets.email,
      adminNote: supportTickets.adminNote,
      username: users.username,
      name: users.name,
    })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.userId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(200);

  const reportItems: AdminReportRow[] = reportRows.map((row) => {
    let targetHref: string | null = null;
    if (row.targetType === "moment" && row.targetId) targetHref = `/moments/${row.targetId}`;
    if (row.targetType === "user" && row.targetLabel?.startsWith("@")) targetHref = `/profile/${row.targetLabel.slice(1)}`;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      // Older rows used "closed"; treat that as resolved.
      status: row.status === "closed" ? "resolved" : row.status,
      reason: row.reason,
      details: row.details,
      targetType: row.targetType,
      targetId: row.targetId,
      targetLabel: row.targetLabel,
      targetHref,
      reporter: row.username ? { username: row.username, name: row.name ?? row.username } : null,
      resolutionNote: row.resolutionNote,
    };
  });
  const ticketItems: AdminTicketRow[] = ticketRows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    topic: row.topic,
    subject: row.subject,
    body: row.body,
    email: row.email,
    user: row.username ? { username: row.username, name: row.name ?? row.username } : null,
    adminNote: row.adminNote,
  }));
  return { reports: reportItems, tickets: ticketItems };
}

export async function updateReportStatus(
  admin: AuthUser,
  reportId: number,
  status: "reviewing" | "resolved" | "dismissed",
  note: string,
) {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) throw new Error("not_found");
  const done = status === "resolved" || status === "dismissed";
  await db
    .update(reports)
    .set({
      status,
      resolutionNote: note || null,
      resolvedAt: done ? new Date() : null,
      resolvedById: done ? admin.id : null,
    })
    .where(eq(reports.id, reportId));
  // Let the reporter know we looked at it.
  if (done && report.reporterId > 0 && report.status !== status) {
    await createNotification({
      userId: report.reporterId,
      type: "system",
      entityType: null,
      entityId: null,
      preview: note
        ? `Update on your report: ${note.slice(0, 120)}`
        : "Thanks for your report. Our team reviewed it and took the appropriate action.",
    });
  }
  return { id: reportId, status };
}

export async function updateTicketStatus(
  admin: AuthUser,
  ticketId: number,
  status: "open" | "waiting" | "resolved",
  note: string,
) {
  void admin;
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) throw new Error("not_found");
  await db
    .update(supportTickets)
    .set({ status, adminNote: note || null, resolvedAt: status === "resolved" ? new Date() : null })
    .where(eq(supportTickets.id, ticketId));
  if (status === "resolved" && ticket.userId && ticket.status !== "resolved") {
    await createNotification({
      userId: ticket.userId,
      type: "system",
      entityType: null,
      entityId: null,
      preview: note
        ? `Support request #${ticketId} resolved: ${note.slice(0, 120)}`
        : `Your support request #${ticketId} was marked resolved.`,
    });
  }
  return { id: ticketId, status };
}

export type { MemberState, MessagePermission };
