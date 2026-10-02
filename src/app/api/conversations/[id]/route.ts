import { conflict, fail, forbidden, notFound, ok, readJson, requireString } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
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
    const user = await requireVerifiedUser(request);
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
    const user = await requireVerifiedUser(request);
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
    if (error instanceof Error && error.message === "group_muted") {
      return fail(forbidden("Only admins can send while this group is muted.", "group_muted"));
    }
    return fail(error);
  }
}

/** PATCH /api/conversations/:id — accept/decline requests, mute, leave, rename. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const conversationId = Number(id);
    const user = await requireVerifiedUser(request);
    const body = await readJson<{ action?: string; value?: string }>(request);
    const allowed = [
      "accept",
      "decline",
      "leave",
      "mute",
      "unmute",
      "rename",
      "add-member",
      "promote",
      "mute-members",
      "unmute-members",
      "invite",
    ] as const;
    if (!allowed.includes(body.action as (typeof allowed)[number])) {
      throw forbidden("Unsupported action.", "unsupported_action");
    }
    const action = body.action as (typeof allowed)[number];
    let value: string | undefined;

    if (typeof body.value === "string") {
      if (action === "rename") {
        value = requireString(body.value, "Group name", { min: 2, max: 60 });
      } else if (action === "add-member" || action === "promote") {
        value = requireString(body.value, "Username", { min: 1, max: 50 }).trim().toLowerCase();
      }
    }

    const result = await respondToConversation(user, conversationId, action, value);
    if (!result.ok) throw notFound("Conversation not found.");
    return ok({
      message: result.message,
      ...(result.ok && "invitePath" in result && result.invitePath ? { invitePath: result.invitePath } : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "admin_required") return fail(forbidden("Only group admins can do that.", "admin_required"));
    if (error instanceof Error && error.message === "last_admin") return fail(forbidden("Promote another admin before leaving the group.", "last_admin"));
    if (error instanceof Error && error.message === "user_not_found") return fail(notFound("That username was not found."));
    if (error instanceof Error && error.message === "already_member") return fail(conflict("That person is already in the group.", "already_member"));
    if (error instanceof Error && error.message === "member_not_found") return fail(notFound("That active member was not found."));
    if (error instanceof Error && error.message === "self_member") return fail(conflict("You are already in this group.", "self_member"));
    return fail(error);
  }
}

/** DELETE /api/conversations/:id — leave the conversation. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const conversationId = Number(id);
    const user = await requireVerifiedUser(request);
    const result = await respondToConversation(user, conversationId, "leave");
    if (!result.ok) throw notFound("Conversation not found.");
    return ok({ message: result.message ?? "You left the conversation." });
  } catch (error) {
    return fail(error);
  }
}
