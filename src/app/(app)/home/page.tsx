"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Avatar, Badge, EmptyState, InfoBanner, LoadingRows, Skeleton, TimeAgo, useToast } from "@/components/ui";
import { FeedList, SuggestionsRail } from "@/components/moments/feed";
import { useSession } from "@/components/providers";
import { api, useQuery } from "@/lib/client";
import { compactNumber } from "@/lib/utils";
import { PRIVACY_SWITCH_COPY } from "@/lib/privacy";
import type { ConversationSummary, NotificationView, UserSummary } from "@/lib/types";

const SHORTCUTS: { href: string; label: string; icon: IconName; hint: string }[] = [
  { href: "/create", label: "New Moment", icon: "create", hint: "Photo, video or text" },
  { href: "/messages", label: "Messages", icon: "chat", hint: "Expires after viewing" },
  { href: "/search", label: "Find people", icon: "search", hint: "Names and usernames" },
  { href: "/settings", label: "Privacy", icon: "lock", hint: "Audience and permissions" },
];

export default function HomePage() {
  const { user } = useSession();
  const { show } = useToast();
  const notifications = useQuery<{ notifications: NotificationView[] }>("/api/notifications");
  const conversations = useQuery<{ conversations: ConversationSummary[] }>("/api/conversations?tab=inbox");
  const requests = useQuery<{ conversations: ConversationSummary[] }>("/api/conversations?tab=requests");
  const followRequests = useQuery<{ users: UserSummary[] }>("/api/users?kind=pending");
  const [busyUser, setBusyUser] = useState<string | null>(null);

  if (!user) {
    return <LoadingRows rows={2} />;
  }

  const counts = user.counts;
  const pending = followRequests.data?.users ?? [];
  const activity = (notifications.data?.notifications ?? []).slice(0, 4);
  const recentChats = (conversations.data?.conversations ?? []).slice(0, 3);
  const messageRequests = requests.data?.conversations ?? [];

  async function runFollowAction(username: string, action: "accept" | "decline") {
    setBusyUser(username);
    try {
      const result = await api.post<{ message: string }>(`/api/users/${username}/actions`, { action });
      show({ title: result.message, tone: "success" });
      followRequests.reload();
      notifications.reload();
    } catch (error) {
      show({ title: "Action failed", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusyUser(null);
    }
  }

  return (
    <div className="page px-4 pt-2 md:pt-6">
      <header className="pb-4">
        <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="h1 pt-1">Hi {user.name.split(" ")[0]}</h1>
        <p className="body-sm pt-1">
          {counts.unreadMessages > 0
            ? `${counts.unreadMessages} new message${counts.unreadMessages === 1 ? "" : "s"} waiting for you.`
            : "You are all caught up."}
        </p>
      </header>

      <section aria-label="Your numbers" className="grid grid-cols-3 gap-2 pb-4">
        {[
          { label: "Moments", value: counts.moments, href: `/profile/${user.username}` },
          { label: "Followers", value: counts.followers, href: `/profile/${user.username}?tab=followers` },
          { label: "Following", value: counts.following, href: `/profile/${user.username}?tab=following` },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="card card-pad text-center">
            <p className="h2 numeric">{compactNumber(stat.value)}</p>
            <p className="caption">{stat.label}</p>
          </Link>
        ))}
      </section>

      <section className="pb-4" aria-labelledby="shortcuts-heading">
        <div className="section-title">
          <h2 className="h3" id="shortcuts-heading">
            Shortcuts
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHORTCUTS.map((item) => (
            <Link key={item.href} href={item.href} className="card card-pad flex flex-col gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-soft text-brand">
                <Icon name={item.icon} size={18} />
              </span>
              <span className="text-sm font-semibold">{item.label}</span>
              <span className="caption">{item.hint}</span>
            </Link>
          ))}
        </div>
      </section>

      {messageRequests.length > 0 ? (
        <section className="pb-4">
          <InfoBanner tone="brand" icon="request" title={`${messageRequests.length} message request${messageRequests.length === 1 ? "" : "s"}`}>
            <p className="pb-2">People you do not follow back land here first. Nothing opens until you accept.</p>
            <Link href="/messages?tab=requests" className="btn btn-secondary btn-sm">
              Review requests
            </Link>
          </InfoBanner>
        </section>
      ) : null}

      {pending.length > 0 ? (
        <section className="card p-0" aria-labelledby="follow-requests-heading">
          <div className="section-title px-4 pt-4">
            <h2 className="h3" id="follow-requests-heading">
              Follow requests
            </h2>
            <Badge tone="private">{pending.length} waiting</Badge>
          </div>
          <p className="body-sm px-4 pb-2">
            Your profile is Private. Approve only the people you want to see your follower-only Moments.
          </p>
          <ul className="divide-y divide-[color:var(--line)]">
            {pending.map((person) => (
              <li key={person.id} className="flex items-center gap-2 px-3 py-2.5">
                <Link href={`/profile/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={person} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{person.name}</span>
                    <span className="caption block truncate">@{person.username}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busyUser === person.username}
                  onClick={() => runFollowAction(person.username, "accept")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyUser === person.username}
                  onClick={() => runFollowAction(person.username, "decline")}
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pending.length === 0 ? (
        <section className="pb-4">
          <div className="card card-pad flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name={user.profilePrivacy === "private" ? "lock" : "globe"} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Profile is {user.profilePrivacy === "private" ? "Private" : "Public"} ·{" "}
                <Link href="/settings?tab=privacy" className="text-brand">
                  change
                </Link>
              </p>
              <p className="body-sm pt-0.5">
                {(user.profilePrivacy === "private"
                  ? PRIVACY_SWITCH_COPY.toPrivate
                  : PRIVACY_SWITCH_COPY.toPublic
                )[0]}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="pb-3" aria-labelledby="activity-heading">
        <div className="section-title">
          <h2 className="h3" id="activity-heading">
            Recent activity
          </h2>
          <Link href="/notifications" className="text-xs font-semibold text-brand">
            See all
          </Link>
        </div>
        {notifications.loading ? (
          <div className="card card-pad flex flex-col gap-3">
            {[0, 1].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="bell"
              title="No activity yet"
              description="Likes, comments, follows and message requests will show up here."
            />
          </div>
        ) : (
          <ul className="card divide-y divide-[color:var(--line)] p-0">
            {activity.map((item) => (
              <li key={item.id}>
                <Link href={item.href ?? "/notifications"} className="list-row">
                  <Avatar user={item.actor ?? { name: "Bemblo" }} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">
                      <span className="font-semibold">{item.actor ? item.actor.name : "Bemblo"}</span>{" "}
                      <span className="body-sm">{item.preview ?? "sent you something"}</span>
                    </span>
                    <TimeAgo iso={item.createdAt} className="caption" />
                  </span>
                  <Icon name="chevron-right" size={18} className="text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pb-3" aria-labelledby="chats-heading">
        <div className="section-title">
          <h2 className="h3" id="chats-heading">
            Recent conversations
          </h2>
          <Link href="/messages" className="text-xs font-semibold text-brand">
            Open Messages
          </Link>
        </div>
        {conversations.loading ? (
          <div className="card card-pad">
            <Skeleton className="h-12 w-full" />
          </div>
        ) : recentChats.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="chat"
              title="No conversations yet"
              description="Start a chat from someone's profile. Messages disappear automatically."
              action={
                <Link href="/search" className="btn btn-primary btn-sm">
                  Find someone
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="card divide-y divide-[color:var(--line)] p-0">
            {recentChats.map((chat) => (
              <li key={chat.id}>
                <Link href={`/messages/${chat.id}`} className="list-row">
                  <Avatar user={{ name: chat.title, avatarUrl: chat.imageUrl }} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{chat.title}</span>
                      {chat.kind === "group" ? <Badge>Group</Badge> : null}
                      {chat.unreadCount > 0 ? <span className="count-badge">{chat.unreadCount}</span> : null}
                    </span>
                    <span className="caption block truncate">{chat.lastMessagePreview ?? chat.expiryLabel}</span>
                  </span>
                  <TimeAgo iso={chat.lastMessageAt} className="caption" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pb-6" aria-labelledby="feed-heading">
        <div className="section-title">
          <h2 className="h3" id="feed-heading">
            Latest Moments
          </h2>
          <Link href="/moments" className="text-xs font-semibold text-brand">
            Open feed
          </Link>
        </div>
        <FeedList
          query="/api/moments?limit=4"
          empty={{
            title: "No Moments yet",
            description: "Share your first Moment or follow a few people to fill this space.",
            action: (
              <Link href="/create" className="btn btn-primary btn-sm">
                Create a Moment
              </Link>
            ),
          }}
        />
      </section>

      <SuggestionsRail />
      <div className="h-4" />
    </div>
  );
}
