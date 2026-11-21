import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, notifications, sessions, users } from "@/db/schema";
import {
  clearSessionCookie,
  readToken,
  createSession,
  getCurrentUser,
  hashPassword,
  hashToken,
  newToken,
  publicBaseUrl,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { ApiError, badRequest, conflict, fail, notFound, ok, readJson, requireString } from "@/lib/api";
import { sessionPayload } from "@/db/store";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/email";
import { validateEmail, validateUsername } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

// Auth tokens must never be returned to production clients.
// Preview links are only available when explicitly enabled for development/staging.
const PREVIEW_AUTH_LINKS =
  process.env.NODE_ENV !== "production" &&
  process.env.BEMBLO_PREVIEW_AUTH_LINKS === "true";

type Params = { params: Promise<{ action: string }> };

/** GET /api/auth/session — current session for web and native clients. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { action } = await params;
    if (action !== "session") throw notFound("Unknown auth endpoint.");
    const user = await getCurrentUser(request);
    if (!user) return ok({ authenticated: false, user: null });
    return ok({ authenticated: true, user: await sessionPayload(user) });
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/auth/{signup|login|logout|forgot|reset|verify|check-username|delete-session}
 * Web authentication uses an HttpOnly session cookie. Native bearer-token
 * authentication should be added as a separate, explicitly designed flow rather
 * than exposing the web session token to arbitrary browser requests.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { action } = await params;
    switch (action) {
      case "signup":
        return await signup(request);
      case "login":
        return await login(request);
      case "logout":
        return await logout(request);
      case "forgot":
        return await forgot(request);
      case "reset":
        return await reset(request);
      case "verify":
        return await verify(request);
      case "resend-verification":
        return await resendVerification(request);
      case "check-username":
        return await checkUsername(request);
      default:
        throw notFound("Unknown auth endpoint.");
    }
  } catch (error) {
    return fail(error);
  }
}

async function signup(request: Request) {
  const body = await readJson(request);
  const name = requireString(body.name, "Name", { min: 2, max: 60 });
  const emailCheck = validateEmail(requireString(body.email, "Email", { max: 160 }));
  if (!emailCheck.ok) throw badRequest(emailCheck.message);

  const usernameCheck = validateUsername(
    requireString(body.username, "Username", { max: 24 }),
  );
  if (!usernameCheck.ok) throw badRequest(usernameCheck.message);

  const password = requireString(body.password, "Password", {
    min: 8,
    max: 200,
  });
  if (password.length < 8) {
    throw badRequest("Use a password with at least 8 characters.");
  }

  const existingEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, emailCheck.value))
    .limit(1);

  if (existingEmail.length) {
    throw conflict(
      "That email is already registered. Try logging in instead.",
      "email_taken",
    );
  }

  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, usernameCheck.value))
    .limit(1);

  if (existingUsername.length) {
    throw conflict(
      "That username is taken. Try another one.",
      "username_taken",
    );
  }

  const [created] = await db
    .insert(users)
    .values({
      name,
      email: emailCheck.value,
      username: usernameCheck.value,
      passwordHash: hashPassword(password),
      bio: "",
      profilePrivacy: "public",
      messagePermission: "everyone",
    })
    .returning();

  const token = newToken();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.userId, created.id),
          eq(authTokens.type, "email_verify"),
          isNull(authTokens.usedAt),
        ),
      );

    await tx.insert(authTokens).values({
      userId: created.id,
      type: "email_verify",
      token: hashToken(token),
      destination: emailCheck.value,
      expiresAt: new Date(now.getTime() + VERIFY_TTL_MS),
    });
  });

  const verifyUrl = `${publicBaseUrl(request)}/verify?token=${token}`;

  let emailSent = false;

  try {
    await sendVerificationEmail({
      to: emailCheck.value,
      verifyUrl,
    });
    emailSent = true;
  } catch (error) {
    console.error(
      "[bemblo:email] verification email failed during signup",
      error,
    );
  }

  const session = await createSession(created.id, "web");
  await setSessionCookie(session.token, session.expiresAt);

  await db.insert(notifications).values({
    userId: created.id,
    type: "system",
    preview: "Welcome to BlueBelly. Add a photo and say hello to a friend.",
  });

  const verification = PREVIEW_AUTH_LINKS
    ? {
        emailSentTo: emailCheck.value,
        emailSent,
        previewUrl: verifyUrl,
      }
    : {
        emailSentTo: emailCheck.value,
        emailSent,
      };

  return ok(
    {
      user: await sessionPayload(created),
      verification,
    },
    201,
  );
}

async function login(request: Request) {
  const body = await readJson(request);
  const identifier = requireString(body.email ?? body.username, "Email or username", { max: 160 }).toLowerCase();
  const password = requireString(body.password, "Password", { min: 1, max: 200 });
  const rows = await db
    .select()
    .from(users)
    .where(identifier.includes("@") ? eq(users.email, identifier) : eq(users.username, identifier))
    .limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError("invalid_credentials", "Email, username or password is incorrect.", 401);
  }

  if (!user.emailVerifiedAt) {
    throw new ApiError(
      "email_not_verified",
      "Your email address is not verified yet. Check your inbox and verify your email before logging in.",
      403,
    );
  }
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));
  const existingToken = await readToken(request);
  if (existingToken) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(existingToken)));
  }
  const session = await createSession(user.id, "web");
  await setSessionCookie(session.token, session.expiresAt);
  return ok({ user: await sessionPayload(user) });
}

async function logout(request: Request) {
  const user = await getCurrentUser(request);
  const token = await readToken(request);
  if (user && token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  await clearSessionCookie();
  return ok({ authenticated: false });
}

async function forgot(request: Request) {
  const body = await readJson(request);
  const emailCheck = validateEmail(
    requireString(body.email, "Email", { max: 160 }),
  );

  if (!emailCheck.ok) throw badRequest(emailCheck.message);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailCheck.value))
    .limit(1);

  if (!user) {
    // Never reveal whether an account exists.
    return ok({
      delivered: true,
      message: "If that email has a BlueBelly account, a reset link is on its way.",
    });
  }

  const token = newToken();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.userId, user.id),
          eq(authTokens.type, "password_reset"),
          isNull(authTokens.usedAt),
        ),
      );

    await tx.insert(authTokens).values({
      userId: user.id,
      type: "password_reset",
      token: hashToken(token),
      destination: emailCheck.value,
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
    });
  });

  const resetUrl = `${publicBaseUrl(request)}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail({
      to: emailCheck.value,
      resetUrl,
    });
  } catch (error) {
    console.error("[bemblo:email] password reset email failed", error);

    await db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.token, hashToken(token)),
          eq(authTokens.type, "password_reset"),
          isNull(authTokens.usedAt),
        ),
      );

    // Keep account enumeration protection: do not reveal delivery failure.
  }

  const response: {
    message: string;
    previewUrl?: string;
  } = {
    message: PREVIEW_AUTH_LINKS
      ? "Reset link created. It expires in 1 hour."
      : "If that email has a BlueBelly account, a reset link is on its way.",
  };

  if (PREVIEW_AUTH_LINKS) {
    response.previewUrl = resetUrl;
  }

  return ok(response);
}

async function reset(request: Request) {
  const body = await readJson(request);
  const token = requireString(body.token, "Reset token", { max: 200 });
  const password = requireString(body.password, "Password", { min: 8, max: 200 });
  await db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(authTokens)
      .where(and(eq(authTokens.token, hashToken(token)), eq(authTokens.type, "password_reset"), isNull(authTokens.usedAt)))
      .limit(1);

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw badRequest("That reset link is no longer valid. Request a new one.", "invalid_token");
    }

    const [claimed] = await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(authTokens.id, record.id), isNull(authTokens.usedAt)))
      .returning({ id: authTokens.id, userId: authTokens.userId });

    if (!claimed) {
      throw badRequest("That reset link is no longer valid. Request a new one.", "invalid_token");
    }

    await tx
      .update(users)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(users.id, record.userId));

    await tx.delete(sessions).where(eq(sessions.userId, record.userId));
  });
  return ok({ message: "Password updated. Sign in with your new password." });
}

async function verify(request: Request) {
  const body = await readJson(request);
  const token = requireString(body.token, "Verification token", { max: 200 });
  await db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(authTokens)
      .where(and(eq(authTokens.token, hashToken(token)), eq(authTokens.type, "email_verify"), isNull(authTokens.usedAt)))
      .limit(1);

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw badRequest("That verification link is no longer valid.", "invalid_token");
    }

    const [claimed] = await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(authTokens.id, record.id), isNull(authTokens.usedAt)))
      .returning({ id: authTokens.id });

    if (!claimed) {
      throw badRequest("That verification link is no longer valid.", "invalid_token");
    }

    await tx
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, record.userId));
  });

  return ok({ message: "Email verified." });
}

async function resendVerification(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new ApiError(
      "unauthorized",
      "Sign in to request a verification email.",
      401,
    );
  }

  if (user.emailVerifiedAt) {
    return ok({
      delivered: false,
      alreadyVerified: true,
      message: "Your email is already verified.",
    });
  }

  const latest = await db
    .select({ createdAt: authTokens.createdAt })
    .from(authTokens)
    .where(
      and(
        eq(authTokens.userId, user.id),
        eq(authTokens.type, "email_verify"),
      ),
    )
    .orderBy(desc(authTokens.createdAt))
    .limit(1);

  const lastSentAt = latest[0]?.createdAt;

  if (lastSentAt && Date.now() - lastSentAt.getTime() < 60_000) {
    throw new ApiError(
      "resend_cooldown",
      "Please wait 60 seconds before requesting another verification email.",
      429,
    );
  }

  const token = newToken();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.userId, user.id),
          eq(authTokens.type, "email_verify"),
          isNull(authTokens.usedAt),
        ),
      );

    await tx.insert(authTokens).values({
      userId: user.id,
      type: "email_verify",
      token: hashToken(token),
      destination: user.email,
      expiresAt: new Date(now.getTime() + VERIFY_TTL_MS),
    });
  });

  const verifyUrl = `${publicBaseUrl(request)}/verify?token=${token}`;

  try {
    await sendVerificationEmail({
      to: user.email,
      verifyUrl,
    });
  } catch (error) {
    console.error(
      "[bemblo:email] verification email failed during resend",
      error,
    );

    await db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.token, hashToken(token)),
          eq(authTokens.type, "email_verify"),
          isNull(authTokens.usedAt),
        ),
      );

    throw new ApiError(
      "email_delivery_failed",
      "We could not send the verification email. Please try again later.",
      503,
    );
  }

  const response: {
    delivered: boolean;
    message: string;
    previewUrl?: string;
  } = {
    delivered: true,
    message: PREVIEW_AUTH_LINKS
      ? "Verification link created. It expires in 24 hours."
      : "A new verification link has been sent.",
  };

  if (PREVIEW_AUTH_LINKS) {
    response.previewUrl = verifyUrl;
  }

  return ok(response);
}

async function checkUsername(request: Request) {
  const body = await readJson(request);
  const check = validateUsername(requireString(body.username, "Username", { max: 24 }));
  if (!check.ok) return ok({ available: false, username: "", message: check.message });
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, check.value)).limit(1);
  const owner = rows[0];
  const self = await getCurrentUser(request);
  const available = !owner || owner.id === self?.id;
  return ok({
    available,
    username: check.value,
    message: available ? `@${check.value} is available.` : `@${check.value} is already taken.`,
  });
}
