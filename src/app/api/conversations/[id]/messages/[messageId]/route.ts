import { badRequest, conflict, fail, forbidden, notFound, ok, readJson } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { deleteMessage, editMessage, reactToMessage } from "@/db/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; messageId: string }> };

function mapError(error: unknown) {
  if (error instanceof Error) {
    switch (error.message) {
      case "forbidden":
        return fail(forbidden("You are not part of this conversation.", "not_a_member"));
      case "not_found":
        return fail(notFound("Message not found."));
      case "not_author":
        return fail(forbidden("You can only edit your own messages.", "not_author"));
      case "message_deleted":
        return fail(conflict("This message was deleted.", "message_deleted"));
      case "empty":
        return fail(badRequest("A message cannot be empty. Delete it instead."));
      case "too_long":
        return fail(badRequest("That message is too long."));
      case "invalid_emoji":
        return fail(badRequest("Choose an emoji to react with."));
      case "not_text":
        return fail(badRequest("Only text messages can be edited."));
    }
  }
  return fail(error);
}

/** PATCH — edit your own text message. Nobody (admins included) can edit someone else's. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, messageId } = await params;
    const user = await requireVerifiedUser(request);
    const body = await readJson<{ body?: string }>(request);
    if (typeof body.body !== "string") throw badRequest("Write the new message first.");
    const result = await editMessage(user, Number(id), Number(messageId), body.body);
    return ok(result);
  } catch (error) {
    return mapError(error);
  }
}

/** PUT — react to a message with any emoji (or remove your reaction with null / the same emoji). */
export async function PUT(request: Request, { params }: Params) {
  try {
    const { id, messageId } = await params;
    const user = await requireVerifiedUser(request);
    const body = await readJson<{ emoji?: string | null }>(request);
    const emoji = typeof body.emoji === "string" ? body.emoji : null;
    return ok(await reactToMessage(user, Number(id), Number(messageId), emoji));
  } catch (error) {
    return mapError(error);
  }
}

/** DELETE — delete for everyone. Authors always; group admins may delete anyone's. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id, messageId } = await params;
    const user = await requireVerifiedUser(request);
    const result = await deleteMessage(user, Number(id), Number(messageId));
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "not_author") {
      return fail(forbidden("You can only delete your own messages.", "not_author"));
    }
    return mapError(error);
  }
}
