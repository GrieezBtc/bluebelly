import { redirect } from "next/navigation";
import { joinGroupByInvite } from "@/db/store";
import { getCurrentUser } from "@/lib/auth";

type Params = { params: Promise<{ token: string }> };

export default async function GroupInvitePage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { token } = await params;
  const result = await joinGroupByInvite(user, token);
  if (!result.ok) redirect("/messages");

  redirect(`/messages/${result.conversationId}`);
}
