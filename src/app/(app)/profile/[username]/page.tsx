"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingRows,
  Overlay,
  Segmented,
  useToast,
} from "@/components/ui";
import { MomentCard } from "@/components/moments/moment-card";
import { FollowButton, MessageButton, UserOptionsMenu } from "@/components/social/user-actions";
import { api, useQuery } from "@/lib/client";
import { useSession } from "@/components/providers";
import { compactNumber } from "@/lib/utils";
import type { PublicUser, RelationState, UserSummary } from "@/lib/types";

type ProfilePayload = {
  profile: {
    user: PublicUser;
    isSelf: boolean;
    relation: RelationState;
    restricted: boolean;
    restrictedReason?: "private" | "blocked" | "blocked_by";
    followerCount: number;
    followingCount: number;
    momentCount: number;
    messageAllowed: boolean;
    messageHint: string;
    canViewFollowers: boolean;
    profilePrivacy: "public" | "private";
  };
  moments: { id: number; kind: "text" | "photo" | "video"; body: string; mediaUrl: string | null; posterUrl: string | null; mediaWidth: number | null; mediaHeight: number | null; audience: "public" | "followers" | "only_me"; audienceLocked: boolean; createdAt: string; author: PublicUser; likeCount: number; commentCount: number; shareCount: number; likedByMe: boolean; isMine: boolean; effectiveAudience: "public" | "followers" | "only_me" | "hidden" }[];
  followersPreview: { id: number; username: string; name: string; avatarUrl: string | null; accent: string; relation: RelationState }[];
  pendingRequests: UserSummary[];
};

function ProfileInner() {
  const params = useParams<{ username: string }>();
  const { user, refresh } = useSession();
  const { show } = useToast();
  const username = params?.username ?? "";
  const [tab, setTab] = useState<"moments" | "followers" | "following">("moments");
  const [pendingOpen, setPendingOpen] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search).get("tab");
    if (search === "followers" || search === "following" || search === "moments") setTab(search);
  }, []);

  const { data, error, loading, reload } = useQuery<ProfilePayload>(username ? `/api/users/${username}` : null);
  const connections = useQuery<{ users: { id: number; username: string; name: string; avatarUrl: string | null; accent: string; relation: RelationState; followsYou: boolean }[]; restricted: boolean }>(
    data && tab !== "moments" ? `/api/users/${username}/connections?kind=${tab}` : null,
  );

  if (loading && !data) return <LoadingRows rows={2} />;

  if (error || !data) {
    return (
      <div className="page px-4">
        <PageHeader title="Profile" backHref="/moments" />
        <ErrorState title="Profile unavailable" description={error ?? "That account does not exist."} onRetry={reload} />
      </div>
    );
  }

  const { profile } = data;

  return (
    <div className="page px-4">
      <PageHeader
        title={profile.user.name}
        subtitle={`@${profile.user.username}`}
        backHref="/moments"
        actions={
          profile.isSelf ? (
            <Link href="/settings?tab=account" className="btn btn-secondary btn-sm">
              <Icon name="edit" size={15} /> Edit profile
            </Link>
          ) : (
            <UserOptionsMenu user={{ ...profile.user }} relation={profile.relation} onChanged={reload} />
          )
        }
      />

      <section className="card card-pad">
        <div className="flex items-start gap-4">
          <Avatar user={profile.user} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="h2 truncate">{profile.user.name}</h1>
              {profile.user.verified ? <Icon name="shield-check" size={16} className="text-brand" /> : null}
              <Badge tone={profile.profilePrivacy === "private" ? "private" : "public"} icon={profile.profilePrivacy === "private" ? "lock" : "globe"}>
                {profile.profilePrivacy === "private" ? "Private" : "Public"}
              </Badge>
            </div>
            <p className="caption">@{profile.user.username}</p>
            {profile.user.bio ? <p className="body-sm pt-2 whitespace-pre-wrap">{profile.user.bio}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-4">
          {[
            { label: "Moments", value: profile.momentCount, tab: "moments" as const },
            { label: "Followers", value: profile.followerCount, tab: "followers" as const },
            { label: "Following", value: profile.followingCount, tab: "following" as const },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              className="card-flat py-2 text-center"
              onClick={() => setTab(stat.tab)}
              aria-label={`${stat.label}: ${stat.value}`}
            >
              <span className="block text-base font-semibold numeric">{compactNumber(stat.value)}</span>
              <span className="caption">{stat.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-4">
          {profile.isSelf ? (
            <>
              <Link href="/create" className="btn btn-primary btn-sm">
                <Icon name="create" size={16} /> New Moment
              </Link>
              <Link href="/settings?tab=privacy" className="btn btn-secondary btn-sm">
                <Icon name="lock" size={16} /> Privacy settings
              </Link>
              {data.pendingRequests.length > 0 ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPendingOpen(true)}>
                  <Icon name="request" size={16} /> {data.pendingRequests.length} follow requests
                </button>
              ) : null}
            </>
          ) : (
            <>
              <FollowButton user={profile.user} relation={profile.relation} onChanged={reload} />
              <MessageButton user={profile.user} allowed={profile.messageAllowed} hint={profile.messageHint} />
            </>
          )}
        </div>

        {!profile.isSelf && profile.messageHint ? <p className="caption pt-2">{profile.messageHint}</p> : null}
      </section>

      {profile.restrictedReason === "blocked" || profile.restrictedReason === "blocked_by" ? (
        <div className="pt-3">
          <InfoBanner tone="danger" icon="ban" title="This account is blocked">
            <p>
              {profile.restrictedReason === "blocked"
                ? "You blocked this account. Unblock from the options menu to see their profile and Moments."
                : "You cannot view this profile."}
            </p>
          </InfoBanner>
        </div>
      ) : null}

      {profile.restricted ? (
        <div className="pt-3">
          <div className="card">
            <EmptyState
              icon="lock"
              title="This profile is private"
              description={`Only approved followers can see @${profile.user.username}'s Moments. Send a follow request to be considered.`}
              action={
                <FollowButton user={profile.user} relation={profile.relation} onChanged={reload} />
              }
            />
          </div>
          <div className="pt-3">
            <InfoBanner tone="info" icon="shield-check" title="How Bemblo handles private accounts">
              <ul className="list-disc space-y-1 pl-4">
                <li>Follower requests need approval before any content becomes visible.</li>
                <li>Messaging permissions are separate — you may still be able to message.</li>
                <li>Only Me Moments are never visible to anyone else.</li>
              </ul>
            </InfoBanner>
          </div>
        </div>
      ) : (
        <>
          <div className="pt-4">
            <Segmented
              label="Profile sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: "moments", label: profile.isSelf ? "My Moments" : "Moments" },
                { value: "followers", label: "Followers" },
                { value: "following", label: "Following" },
              ]}
            />
          </div>

          {tab === "moments" ? (
            data.moments.length === 0 ? (
              <div className="card mt-3">
                <EmptyState
                  icon="moments"
                  title={profile.isSelf ? "You have no Moments yet" : "No Moments to show"}
                  description={
                    profile.isSelf
                      ? "Share a photo, video or thought. Choose Public, Followers or Only Me before publishing."
                      : "When they post, their Moments will appear here."
                  }
                  action={
                    profile.isSelf ? (
                      <Link href="/create" className="btn btn-primary btn-sm">
                        Create a Moment
                      </Link>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-3">
                {data.moments.map((moment, index) => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    priority={index < 2}
                    onChanged={() => reload()}
                  />
                ))}
              </div>
            )
          ) : connections.loading ? (
            <div className="pt-3">
              <LoadingRows rows={2} />
            </div>
          ) : connections.data?.restricted ? (
            <div className="card mt-3">
              <EmptyState icon="lock" title="Followers are hidden" description="This private account keeps its follower list visible to approved followers only." />
            </div>
          ) : (connections.data?.users ?? []).length === 0 ? (
            <div className="card mt-3">
              <EmptyState
                icon="users"
                title={tab === "followers" ? "No followers yet" : "Not following anyone yet"}
                description={
                  tab === "followers"
                    ? "When someone follows this account they will appear here."
                    : "People this account follows will show up here."
                }
              />
            </div>
          ) : (
            <ul className="card mt-3 divide-y divide-[color:var(--line)] p-0">
              {(connections.data?.users ?? []).map((person) => (
                <li key={person.id} className="flex items-center gap-2 px-2">
                  <Link href={`/profile/${person.username}`} className="list-row flex-1">
                    <Avatar user={person} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{person.name}</span>
                      <span className="caption block truncate">
                        @{person.username}
                        {person.followsYou ? " · follows you" : ""}
                      </span>
                    </span>
                  </Link>
                  {user && person.id !== user.id ? (
                    <FollowButton user={person} relation={person.relation} size="sm" onChanged={() => connections.reload()} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {profile.isSelf && data.followersPreview.length > 0 && tab === "moments" ? (
            <section className="pt-4">
              <p className="eyebrow pb-1">Recent followers</p>
              <div className="scroll-x">
                {data.followersPreview.map((person) => (
                  <Link key={person.id} href={`/profile/${person.username}`} className="flex w-20 flex-col items-center gap-1">
                    <Avatar user={person} size="lg" />
                    <span className="caption truncate w-full text-center">{person.name.split(" ")[0]}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <Overlay open={pendingOpen} onClose={() => setPendingOpen(false)} title="Follow requests" description="Approve who sees your follower-only Moments">
        <ul className="flex flex-col divide-y divide-[color:var(--line)]">
          {data.pendingRequests.map((person) => (
            <li key={person.id} className="flex items-center gap-2 py-2">
              <Avatar user={person} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{person.name}</span>
                <span className="caption">@{person.username}</span>
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  await api.post(`/api/users/${person.username}/actions`, { action: "accept" });
                  show({ title: `@${person.username} approved`, tone: "success" });
                  reload();
                  await refresh();
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await api.post(`/api/users/${person.username}/actions`, { action: "decline" });
                  show({ title: "Request declined", tone: "info" });
                  reload();
                }}
              >
                Decline
              </button>
            </li>
          ))}
        </ul>
      </Overlay>

      <div className="h-6" />
      {loading ? <span className="sr-only">Refreshing profile</span> : null}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingRows rows={2} />}>
      <ProfileInner />
    </Suspense>
  );
}
