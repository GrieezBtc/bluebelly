import { and, eq, isNull, notInArray, or } from "drizzle-orm";
import { db } from "@/db";
import { conversationMembers, conversations, messages, mediaAssets, moments, users } from "@/db/schema";
import { fail, notFound } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getRelation } from "@/db/store";
import { canViewMoment } from "@/lib/privacy";
import { readMedia } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/media?id=12 — streams uploaded media.
 *
 * Media is never public merely because the asset ID is known. Access is
 * authorized against the resource that owns the asset (Moment or message),
 * with the uploader retaining access to their own asset.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) throw notFound("Media not found.");

    const mediaLink = `/api/media?id=${id}`;
    const viewer = await getCurrentUser(request);
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
      .limit(1);
    if (!asset) throw notFound("Media not found.");

    // The uploader can always access their own asset. This also allows a
    // freshly uploaded asset to be previewed before it is attached to a
    // Moment/message.
    let authorized = viewer?.id != null && viewer.id === asset.ownerId;

    if (!authorized) {
      // Moment media inherits the exact Moment/profile privacy rules.
      const momentRows = await db
        .select({
          authorId: moments.authorId,
          audience: moments.audience,
          profilePrivacy: users.profilePrivacy,
          archived: moments.archived,
        })
        .from(moments)
        .innerJoin(users, eq(users.id, moments.authorId))
        // Match by asset id, or by the stored link — but only when the uploader is the author,
        // so nobody can expose someone else's file by pasting its link.
        .where(
          or(
            eq(moments.mediaId, id),
            asset.ownerId != null ? and(eq(moments.mediaUrl, mediaLink), eq(moments.authorId, asset.ownerId)) : undefined,
          ),
        );

      if (viewer && momentRows.length) {
        for (const moment of momentRows) {
          if (moment.archived) continue;
          const relation = await getRelation(viewer.id, moment.authorId);
          if (
            canViewMoment(
              viewer.id,
              { audience: moment.audience },
              { id: moment.authorId, profilePrivacy: moment.profilePrivacy },
              relation,
            )
          ) {
            authorized = true;
            break;
          }
        }
      } else if (!viewer && momentRows.length) {
        // Anonymous viewers can only receive genuinely public Moments.
        authorized = momentRows.some(
          (moment) =>
            !moment.archived &&
            moment.profilePrivacy === "public" &&
            moment.audience === "public",
        );
      }
    }

    if (!authorized && asset.ownerId != null) {
      // Profile photos are visible wherever the profile shows (feed, chats, share pages), and only
      // when the account itself chose this file.
      const [owner] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, asset.ownerId), eq(users.avatarUrl, mediaLink)))
        .limit(1);
      if (owner) authorized = true;
    }

    if (!authorized && viewer && asset.ownerId != null) {
      // Group photos: visible to members of that group.
      const groups = await db
        .select({ id: conversations.id })
        .from(conversations)
        .innerJoin(conversationMembers, eq(conversationMembers.conversationId, conversations.id))
        .where(
          and(
            eq(conversations.imageUrl, mediaLink),
            eq(conversations.createdById, asset.ownerId),
            eq(conversationMembers.userId, viewer.id),
            notInArray(conversationMembers.state, ["declined", "left", "removed"]),
          ),
        )
        .limit(1);
      if (groups[0]) authorized = true;
    }

    if (!authorized && viewer) {
      // Message media is available only to members of the conversation and
      // only while the message itself is still active.
      const now = new Date();
      const messageRows = await db
        .select({
          conversationId: messages.conversationId,
          expiresAt: messages.expiresAt,
          maxRetentionAt: messages.maxRetentionAt,
          expiredAt: messages.expiredAt,
          isSystem: messages.isSystem,
        })
        .from(messages)
        .where(
          and(
            eq(messages.isSystem, false),
            or(
              eq(messages.mediaId, id),
              asset.ownerId != null ? and(eq(messages.mediaUrl, mediaLink), eq(messages.senderId, asset.ownerId)) : undefined,
            ),
          ),
        );

      for (const message of messageRows) {
        if (message.expiredAt) continue;
        if (message.expiresAt && message.expiresAt <= now) continue;
        if (message.maxRetentionAt && message.maxRetentionAt <= now) continue;

        const [membership] = await db
          .select({ id: conversationMembers.id })
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, message.conversationId),
              eq(conversationMembers.userId, viewer.id),
              notInArray(conversationMembers.state, ["declined", "left", "removed"]),
            ),
          )
          .limit(1);

        if (membership) {
          authorized = true;
          break;
        }
      }
    }

    // Do not reveal whether an inaccessible asset exists. This also reduces
    // the usefulness of sequential media IDs for enumeration.
    if (!authorized) throw notFound("Media not found.");

    const found = await readMedia(id);
    if (!found) throw notFound("Media not found.");

    const { asset: storedAsset, body, size } = found;
    const expired = storedAsset.expiresAt ? storedAsset.expiresAt.getTime() <= Date.now() : false;
    if (expired) throw new Response(JSON.stringify({ ok: false, error: { code: "media_expired", message: "This attachment has expired." } }), { status: 410, headers: { "Content-Type": "application/json" } });

    return new Response(body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": storedAsset.mimeType,
        "Content-Length": String(size),
        // Private response: browsers may cache it briefly, but shared caches
        // must never store authenticated/private media.
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Accept-Ranges": "none",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return fail(error);
  }
}
