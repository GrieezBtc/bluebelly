import { redirect } from "next/navigation";
import { joinGroupByInvite } from "@/db/store";
import { getCurrentUser } from "@/lib/auth";

type Params = { params: Promise<{ token: string }> };

export default async function GroupInvitePage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { token } = await params;
  let result: Awaited<ReturnType<typeof joinGroupByInvite>>;
  try {
    result = await joinGroupByInvite(user, token);
  } catch {
    // Removed from this group by an admin: the invite link no longer works for them.
    redirect("/messages");
  }
  if (!result.ok) redirect("/messages");

  redirect(`/messages/${result.conversationId}`);
}
