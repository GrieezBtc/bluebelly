"use client";

import { useParams } from "next/navigation";
import { ConversationView } from "@/components/messages/conversation";
import { PageHeader } from "@/components/app-shell";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = Number(params?.id);

  if (!Number.isFinite(conversationId)) {
    return (
      <div className="page px-4">
        <PageHeader title="Conversation" backHref="/messages" />
        <p className="body-sm">That conversation link is not valid.</p>
      </div>
    );
  }

  return <ConversationView conversationId={conversationId} />;
}
