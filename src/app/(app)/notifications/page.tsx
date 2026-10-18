"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import { Avatar, Badge, EmptyState, ErrorState, LoadingRows, Segmented, TimeAgo, useToast } from "@/components/ui";
import { api, useQuery } from "@/lib/client";
import { useSession } from "@/components/providers";
import type { NotificationTypeWire, NotificationView } from "@/lib/types";

const ICONS: Record<NotificationTypeWire, IconName> = {
  follow: "user-plus",
  follow_request: "request",
  follow_accepted: "check",
  like: "heart",
  comment: "comment",
  reply: "reply",
  mention: "at",
  message_request: "request",
  message: "chat",
  system: "shield-check",
};

const TITLES: Record<NotificationTypeWire, string> = {
  follow: "started following you",
  follow_request: "requested to follow you",
  follow_accepted: "approved your follow request",
  like: "liked your Moment",
  comment: "commented on your Moment",
  reply: "replied to you",
  mention: "mentioned you",
  message_request: "sent a message request",
  message: "sent you a message",
  system: "Bemblo",
};

export default function NotificationsPage() {
  const { user, refresh } = useSession();
  const { show } = useToast();
  const { data, error, loading, reload, setData } = useQuery<{ notifications: NotificationView[] }>("/api/notifications");
  const [filter, setFilter] = useState<"all" | "social" | "messages" | "requests">("all");
  const [busy, setBusy] = useState(false);

  const items = (data?.notifications ?? []).filter((item) => {
    if (filter === "all") {
      return item.type !== "message" && item.type !== "message_request" && !(item.type === "reply" && item.href?.startsWith("/messages/"));
    }
    if (filter === "messages") {
      return item.type === "message" || item.type === "message_request" || (item.type === "reply" && Boolean(item.href?.startsWith("/messages/")));
    }
    if (filter === "requests") return item.type === "follow_request" || item.type === "follow" || item.type === "follow_accepted";
    return item.type === "like" || item.type === "comment" || item.type === "reply" || item.type === "mention";
  });

  async function markAll() {
    setBusy(true);
    try {
      const scope = filter === "messages" ? "messages" : "general";
      const result = await api.post<{ notifications: NotificationView[] }>("/api/notifications", { scope });
      setData(result);
      await refresh();
      show({ title: "All caught up", tone: "success" });
    } catch (err) {
      show({ title: "Could not update", description: err instanceof Error ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: number) {
    try {
      const result = await api.post<{ notifications: NotificationView[] }>("/api/notifications", { id });
      setData(result);
    } catch {
      /* non-critical */
    }
  }

  return (
    <div className="page px-4">
      <PageHeader
        title="Notifications"
        subtitle={user ? `${user.counts.unreadNotifications} unread` : undefined}
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={markAll} disabled={busy}>
            <Icon name="check-double" size={16} /> Mark all read
          </button>
        }
      />

      <div className="pb-3">
        <Segmented
          label="Notification filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "General" },
            { value: "social", label: "Likes & comments" },
            { value: "requests", label: "Follows" },
          ]}
        />
      </div>

      {loading ? (
        <LoadingRows rows={3} />
      ) : error ? (
        <ErrorState title="Notifications could not load" description={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="bell"
            title="Nothing here yet"
            description={
              filter === "messages"
                ? "New messages and message requests will appear here."
                : "Follows, likes, comments and mentions will appear here."
            }
            action={
              <Link href="/settings?tab=notifications" className="btn btn-secondary btn-sm">
                Notification preferences
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="card divide-y divide-[color:var(--line)] p-0">
          {items.map((item) => (
            <li key={item.id} className="flex items-center">
              <Link
                href={item.href ?? "/notifications"}
                className="list-row flex-1"
                onClick={() => !item.read && markOne(item.id)}
              >
                <span className="relative">
                  <Avatar user={item.actor ?? { name: "Bemblo", accent: "violet" }} size="md" />
                  <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-surface text-brand">
                    <Icon name={ICONS[item.type]} size={13} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    <span className="font-semibold">{item.actor?.name ?? "Bemblo"}</span>{" "}
                    <span className="body-sm">{TITLES[item.type]}</span>
                  </span>
                  {item.preview ? <span className="body-sm block truncate">{item.preview}</span> : null}
                  <TimeAgo iso={item.createdAt} className="caption" />
                </span>
                {!item.read ? <Badge tone="onlyme">New</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="caption pt-4 pb-6">
        Notification preferences, including push and email delivery, live in{" "}
        <Link href="/settings?tab=notifications" className="font-semibold text-brand">
          Settings → Notifications
        </Link>
        .
      </p>
    </div>
  );
}
