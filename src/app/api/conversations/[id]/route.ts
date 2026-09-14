import { fail, forbidden, notFound, ok, readJson, requireString } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  getConversationDetail,
  markConversationRead,
  respondToConversation,
  sendMessage,
  sweepIfStale,
} from "@/db/store";
import type { MessageView } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/conversations/:id — history. Expired messages are already gone. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const conversationId = Number(id);
    const user = await requireUser(request);
    await sweepIfStale();
    const detail = await getConversationDetail(user, conversationId);
    if (!detail) throw notFound("Conversation not found.");
    return ok(detail);
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/conversations/:id — send a message (text, voice, image, video). */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const conversationId = Number(id);
    const user = await requireUser(request);
    const body = await readJson<{
      action?: string;
      kind?: string;
      body?: string;
      mediaUrl?: string;
      durationSec?: number;
    }>(request);

    if (body.action === "read") {
      await markConversationRead(user, conversationId);
      return ok({ read: true });
    }
    if (body.action === "acknowledge-expired") {
      const detail = await getConversationDetail(user, conversationId);
      if (!detail) throw notFound("Conversation not found.");
      return ok(detail);
    }

    const kind = (["text", "voice", "image", "video"] as MessageView["kind"][]).includes(body.kind as MessageView["kind"])
      ? (body.kind as MessageView["kind"])
      : "text";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (kind === "text" && text.length === 0) throw new Error("empty");
    if (kind !== "text" && !body.mediaUrl) throw new Error("empty");
    const message = await sendMessage(user, conversationId, {
      kind,
      body: text.slice(0, 4000),
      mediaUrl: body.mediaUrl ?? null,
      durationSec: typeof body.durationSec === "number" ? Math.round(body.durationSec) : null,
    });
    return ok({ message }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "empty") {
      return fail({ code: "empty_message", message: "Write a message or attach something first." });
    }
    if (error instanceof Error && error.message === "forbidden") {
      return fail(forbidden("You are not part of this conversation.", "not_a_member"));
    }
    return fail(error);
  }
}

/** PATCH /api/conversations/:id — accept/decline requests, mute, leave, rename. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const conversationId = Number(id);
    const user = await requireUser(request);
    const body = await readJson<{ action?: string; value?: string }>(request);
    const allowed = ["accept", "decline", "leave", "mute", "unmute", "rename"] as const;
    if (!allowed.includes(body.action as (typeof allowed)[number])) {
      throw forbidden("Unsupported action.", "unsupported_action");
    }
    const result = await respondToConversation(
      user,
      conversationId,
      body.action as (typeof allowed)[number],
      typeof body.value === "string" ? requireString(body.value, "Group name", { min: 2, max: 60 }) : undefined,
    );
    if (!result.ok) throw notFound("Conversation not found.");
    return ok({ message: result.message });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/conversations/:id — leave the conversation. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const conversationId = Number(id);
    const user = await requireUser(request);
    const result = await respondToConversation(user, conversationId, "leave");
    if (!result.ok) throw notFound("Conversation not found.");
    return ok({ message: result.message ?? "You left the conversation." });
  } catch (error) {
    return fail(error);
  }
}
