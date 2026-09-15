"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import { Avatar, Badge, EmptyState, ErrorState, Field, LoadingRows, Overlay, Segmented, Spinner, TimeAgo, useToast } from "@/components/ui";
import { api, useQuery } from "@/lib/client";
import { useSession } from "@/components/providers";
import type { ConversationSummary, UserSummary } from "@/lib/types";

function MessagesInner() {
  const router = useRouter();
  const { user } = useSession();
  const { show } = useToast();
  const [tab, setTab] = useState<"inbox" | "requests">("inbox");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "requests") setTab("requests");
  }, []);

  const { data, error, loading, reload } = useQuery<{ conversations: ConversationSummary[] }>(
    `/api/conversations?tab=${tab}`,
  );
  const suggestions = useQuery<{ users: UserSummary[] }>(newOpen ? "/api/users?kind=suggestions" : null);
  const followers = useQuery<{ users: UserSummary[] }>(newOpen ? "/api/users?kind=followers" : null);

  const conversations = (data?.conversations ?? []).filter((chat) =>
    query.trim() ? chat.title.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  async function respond(conversationId: number, action: "accept" | "decline") {
    try {
      const result = await api.patch<{ message: string }>(`/api/conversations/${conversationId}`, { action });
      show({ title: result.message, tone: "success" });
      reload();
    } catch (err) {
      show({ title: "Action failed", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
  }

  async function startDirect(username: string) {
    setCreating(true);
    try {
      const result = await api.post<{ conversationId: number; request?: boolean }>("/api/conversations", {
        kind: "direct",
        username,
      });
      setNewOpen(false);
      router.push(`/messages/${result.conversationId}`);
    } catch (err) {
      show({ title: "Could not start chat", description: err instanceof Error ? err.message : undefined, tone: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function startGroup() {
    if (groupMembers.length === 0 || groupName.trim().length < 2) return;
    setCreating(true);
    try {
      const result = await api.post<{ conversationId: number }>("/api/conversations", {
        kind: "group",
        title: groupName.trim(),
        usernames: groupMembers,
      });
      setNewOpen(false);
      setGroupMembers([]);
      setGroupName("");
      router.push(`/messages/${result.conversationId}`);
    } catch (err) {
      show({ title: "Could not create group", description: err instanceof Error ? err.message : undefined, tone: "error" });
    } finally {
      setCreating(false);
    }
  }

  const people = [...(followers.data?.users ?? []), ...(suggestions.data?.users ?? [])].filter(
    (person, index, all) => all.findIndex((item) => item.id === person.id) === index,
  );

  return (
    <div className="page px-4">
      <PageHeader
        title="Messages"
        subtitle="Temporary by design"
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>
            <Icon name="create" size={16} /> New
          </button>
        }
      />

      <div className="pb-3">
        <Segmented
          label="Message tabs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "inbox", label: "Inbox" },
            { value: "requests", label: "Requests", badge: user?.counts.requests },
          ]}
        />
      </div>

      <div className="pb-3">
        <Field label="Search conversations" htmlFor="chat-search">
          <div className="input-affix">
            <Icon name="search" size={18} className="text-ink-3" />
            <input
              id="chat-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
            />
          </div>
        </Field>
      </div>

      {loading ? (
        <LoadingRows rows={3} />
      ) : error ? (
        <ErrorState title="Messages could not load" description={error} onRetry={reload} />
      ) : conversations.length === 0 ? (
        <div className="card">
          {tab === "requests" ? (
            <EmptyState
              icon="request"
              title="No message requests"
              description="When someone you do not follow back messages you, they land here for your approval."
            />
          ) : (
            <EmptyState
              icon="chat"
              title="No conversations yet"
              description="Start a 1-to-1 chat or create a group. 1-to-1 messages disappear 24h after they are viewed; group messages after 7 days."
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>
                  Start a conversation
                </button>
              }
            />
          )}
        </div>
      ) : (
        <ul className="card divide-y divide-[color:var(--line)] p-0">
          {conversations.map((chat) => (
            <li key={chat.id} className="flex items-center">
              <Link href={`/messages/${chat.id}`} className="list-row flex-1">
                <span className="relative">
                  <Avatar user={{ name: chat.title, avatarUrl: chat.imageUrl }} size="md" />
                  {chat.kind === "group" ? (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5">
                      <Icon name="users" size={12} className="text-brand" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{chat.title}</span>
                    {chat.unreadCount > 0 ? <span className="count-badge">{chat.unreadCount}</span> : null}
                    {chat.isRequest ? <Badge tone="private">Request</Badge> : null}
                  </span>
                  <span className="caption block truncate">
                    {chat.lastMessageFromMe ? "You: " : ""}
                    {chat.lastMessagePreview ?? "No messages yet"}
                  </span>
                  <span className="caption flex items-center gap-1 pt-0.5">
                    <Icon name="clock" size={11} /> {chat.expiryLabel}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <TimeAgo iso={chat.lastMessageAt} className="caption" />
                  {chat.kind === "group" ? <span className="caption">{chat.memberCount} members</span> : null}
                </span>
              </Link>
              {chat.isRequest ? (
                <span className="flex gap-1 pr-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => respond(chat.id, "accept")}>
                    Accept
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => respond(chat.id, "decline")}>
                    Decline
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Overlay open={newOpen} onClose={() => setNewOpen(false)} title="New conversation" description="1-to-1 or group">
        <div className="flex flex-col gap-4">
          <div>
            <p className="eyebrow pb-1">Start a 1-to-1 chat</p>
            {followers.loading || suggestions.loading ? (
              <div className="skeleton h-12 w-full" />
            ) : people.length === 0 ? (
              <p className="body-sm">No contacts yet. Find people with Search first.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[color:var(--line)]">
                {people.slice(0, 6).map((person) => (
                  <li key={person.id} className="flex items-center gap-2 py-2">
                    <Avatar user={person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{person.name}</span>
                      <span className="caption block truncate">{person.messageHint}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!person.canMessage || creating}
                      onClick={() => startDirect(person.username)}
                    >
                      <Icon name="chat" size={15} /> Chat
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card card-pad flex flex-col gap-3">
            <p className="eyebrow">Create a group</p>
            <Field label="Group name" htmlFor="new-group-name">
  <input
    id="new-group-name"
    className="input"
    value={groupName}
    maxLength={60}
    onChange={(event) => {
      console.log(
        "[GROUP INPUT] change",
        event.target.value,
        "active:",
        document.activeElement?.id,
      );
      setGroupName(event.target.value);
    }}
    onBlur={() => {
      console.log(
        "[GROUP INPUT] BLUR",
        "active:",
        document.activeElement?.id,
      );
    }}
    onFocus={() => {
      console.log("[GROUP INPUT] FOCUS");
    }}
    placeholder="Sunday ride"
  />
</Field>
            <div className="flex flex-wrap gap-2">
              {people.slice(0, 8).map((person) => {
                const selected = groupMembers.includes(person.username);
                return (
                  <button
                    key={person.id}
                    type="button"
                    className="chip"
                    data-active={selected}
                    onClick={() =>
                      setGroupMembers((current) =>
                        selected ? current.filter((item) => item !== person.username) : [...current, person.username],
                      )
                    }
                    aria-pressed={selected}
                  >
                    <Avatar user={person} size="xs" />
                    {person.name}
                  </button>
                );
              })}
            </div>
            <p className="caption">Group messages disappear 7 days after sending, for everyone in the group.</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={creating || groupMembers.length === 0 || groupName.trim().length < 2}
              onClick={startGroup}
            >
              {creating ? <Spinner /> : <Icon name="users" size={16} />} Create group
            </button>
          </div>
        </div>
      </Overlay>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingRows rows={3} />}>
      <MessagesInner />
    </Suspense>
  );
}
