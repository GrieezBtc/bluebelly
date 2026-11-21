import { and, eq, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { blocks, conversationMembers, conversations, follows, mediaAssets, moments, mutes, sessions, users } from "@/db/schema";
import { fail, ok, readJson, requireString, toInt } from "@/lib/api";
import { ownedMediaId } from "@/lib/storage";
import { requireVerifiedUser, setSessionCookie, createSession, hashToken, readToken } from "@/lib/auth";
import {
  normalizePrefs,
  profileCounts,
  sessionPayload,
  toPublicUser,
  userSummaryList,
} from "@/db/store";
import { deleteAsset } from "@/lib/storage";
import { ACCENTS, validateUsername, type Accent } from "@/lib/utils";
import type { MessagePermission } from "@/db/schema";

export const dynamic = "force-dynamic";

/** GET /api/me — profile + settings + counts for the signed-in account. */
export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const counts = await profileCounts(user.id);
    const pending = await userSummaryList(user, "pending");
    return ok({
      user: await sessionPayload(user),
      counts,
      pendingRequests: pending,
    });
  } catch (error) {
    return fail(error);
  }
}

/** PATCH /api/me — account, privacy, messaging permissions, notification prefs. */
export async function PATCH(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await readJson<{
      name?: string;
      username?: string;
      bio?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      accent?: string;
      profilePrivacy?: string;
      messagePermission?: MessagePermission;
      notificationPrefs?: Record<string, boolean>;
      sensitiveContent?: string;
      onboardingComplete?: boolean;
    }>(request);

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = requireString(body.name, "Name", { min: 2, max: 60 });
    if (body.bio !== undefined) updates.bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 200) : "";
    if (body.phone !== undefined) updates.phone = body.phone ? String(body.phone).slice(0, 40) : null;
    if (body.avatarUrl !== undefined) {
      const avatar = body.avatarUrl ? String(body.avatarUrl).slice(0, 600) : null;
      await ownedMediaId(user.id, avatar); // refuses links to files someone else uploaded
      updates.avatarUrl = avatar;
    }
    if (body.accent !== undefined && ACCENTS.includes(body.accent as Accent)) updates.accent = body.accent;
    if (body.username !== undefined) {
      const requested = requireString(body.username, "Username", { max: 24 }).trim().toLowerCase().replace(/^@/, "");
      // An unchanged username is never re-validated (the official account keeps its reserved name).
      const check = requested === user.username ? ({ ok: true, value: requested } as const) : validateUsername(requested);
      if (!check.ok) throw new Error(check.message);
      if (check.value !== user.username) {
        const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, check.value)).limit(1);
        if (taken.length) throw new Error("That username is already taken.");
        updates.username = check.value;
      }
    }

    let privacyExplanation: string[] | null = null;
    if (body.profilePrivacy === "public" || body.profilePrivacy === "private") {
      const changing = body.profilePrivacy !== user.profilePrivacy;
      updates.profilePrivacy = body.profilePrivacy;
      if (changing) {
        // Audience rows are never rewritten. Visibility is the combination of the
        // stored audience and the profile rule, evaluated server-side on read.
        privacyExplanation =
          body.profilePrivacy === "private"
            ? [
                "Your profile is now Private: only approved followers see your Public and Followers Moments.",
                "Your Only Me Moments stay Only Me.",
                "Nothing is deleted. You can switch back at any time.",
                `${await pendingFollowRequests(user.id)} pending follow request(s) now need your approval.`,
              ]
            : [
                "Your profile is now Public: everyone can see your profile and Public Moments.",
                "Moments you saved for Followers are now visible to anyone.",
                "Your Only Me Moments stay Only Me — this never changes automatically.",
                "Pending follow requests were approved automatically.",
              ];
        if (body.profilePrivacy === "public") {
          await db
            .update(follows)
            .set({ state: "accepted" })
            .where(and(eq(follows.followingId, user.id), eq(follows.state, "pending")));
        }
      }
    }
    if (
      body.messagePermission === "everyone" ||
      body.messagePermission === "followers" ||
      body.messagePermission === "following" ||
      body.messagePermission === "nobody"
    ) {
      updates.messagePermission = body.messagePermission;
    }
    if (body.notificationPrefs) {
      updates.notificationPrefs = normalizePrefs({ ...normalizePrefs(user.notificationPrefs), ...body.notificationPrefs });
    }
    if (body.sensitiveContent === "show" || body.sensitiveContent === "warn" || body.sensitiveContent === "hide") {
      updates.sensitiveContent = body.sensitiveContent;
    }
    if (body.onboardingComplete) updates.onboardedAt = new Date();

    const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning();
    return ok({ user: await sessionPayload(updated), privacyExplanation });
  } catch (error) {
    return fail(error);
  }
}

async function pendingFollowRequests(userId: number) {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followingId, userId), eq(follows.state, "pending")));
  return rows.length;
}

/** PUT /api/me — change password (keeps the current device signed in). */
export async function PUT(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await readJson(request);
    const current = requireString(body.currentPassword, "Current password", { max: 200 });
    const next = requireString(body.newPassword, "New password", { min: 8, max: 200 });
    const { verifyPassword, hashPassword } = await import("@/lib/auth");
    if (!verifyPassword(current, user.passwordHash)) {
      return ok({ error: "Your current password is incorrect." }, 400);
    }
    const currentToken = await readToken(request);
    const currentSession = currentToken
      ? (await db
          .select({ platform: sessions.platform })
          .from(sessions)
          .where(and(eq(sessions.tokenHash, hashToken(currentToken)), eq(sessions.userId, user.id)))
          .limit(1))[0]
      : null;

    await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, user.id));
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    const session = await createSession(user.id, currentSession?.platform === "native" ? "native" : "web");
    await setSessionCookie(session.token, session.expiresAt);
    return ok({ message: "Password updated. Other devices were signed out." });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/me — account deletion with cascading cleanup. */
export async function DELETE(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const url = new URL(request.url);
    const confirm = url.searchParams.get("confirm");
    if (confirm !== user.username) {
      return ok({ error: `Type your username (@${user.username}) to confirm deletion.` }, 400);
    }

    const assets = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.ownerId, user.id));
    for (const asset of assets) await deleteAsset(asset.id);

    const memberships = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, user.id));
    for (const m of memberships) {
      const others = await db
        .select({ id: conversationMembers.id })
        .from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, m.conversationId), ne(conversationMembers.userId, user.id)));
      if (others.length === 0) {
        await db.delete(conversations).where(eq(conversations.id, m.conversationId));
      }
    }

    await db.delete(moments).where(eq(moments.authorId, user.id));
    await db.delete(conversationMembers).where(eq(conversationMembers.userId, user.id));
    await db.delete(follows).where(or(eq(follows.followerId, user.id), eq(follows.followingId, user.id)));
    await db.delete(mutes).where(eq(mutes.userId, user.id));
    await db.delete(blocks).where(or(eq(blocks.blockerId, user.id), eq(blocks.blockedId, user.id)));
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
    return ok({ message: "Your BlueBelly account and data were deleted." });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await readJson(request);
    const action = typeof body.action === "string" ? body.action : "";
    if (action !== "sign-out-other-devices") return ok({ message: "Nothing to do." }, 400);
    const currentToken = await readToken(request);
    const currentSession = currentToken
      ? (await db
          .select({ platform: sessions.platform })
          .from(sessions)
          .where(and(eq(sessions.tokenHash, hashToken(currentToken)), eq(sessions.userId, user.id)))
          .limit(1))[0]
      : null;
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    const session = await createSession(user.id, currentSession?.platform === "native" ? "native" : "web");
    await setSessionCookie(session.token, session.expiresAt);
    void toInt;
    return ok({ message: "Signed out of all other devices." });
  } catch (error) {
    return fail(error);
  }
}
