"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import { Avatar, Badge, EmptyState, ErrorState, Field, LoadingRows, Segmented, TimeAgo } from "@/components/ui";
import { MomentCard } from "@/components/moments/moment-card";
import { FollowButton } from "@/components/social/user-actions";
import { api, useQuery } from "@/lib/client";
import type { MomentView, RelationState, SearchResults, UserSummary } from "@/lib/types";

type PersonResult = SearchResults["users"][number];

export default function SearchPage() {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"people" | "moments">("people");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [suggestions, setSuggestions] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const empty = useQuery<{ suggestions: UserSummary[]; recent: string[] }>("/api/search?q=");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(raw.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [raw]);

  useEffect(() => {
    if (query.length === 0) {
      setResults(null);
      setError(null);
      setSuggestions(empty.data?.suggestions ?? []);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<SearchResults & { suggestions: UserSummary[] }>(`/api/search?q=${encodeURIComponent(query)}`)
      .then((data) => {
        if (cancelled) return;
        setResults(data);
        setSuggestions(data.suggestions ?? []);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, refreshKey, empty.data?.suggestions]);

  const people: PersonResult[] = results?.users ?? [];
  const moments: MomentView[] = results?.moments ?? [];

  return (
    <div className="page px-4">
      <PageHeader title="Search" subtitle="People, usernames and Moment text" />

      <Field label="Search Bemblo" htmlFor="global-search">
        <div className="input-affix">
          <Icon name="search" size={18} className="text-ink-3" />
          <input
            id="global-search"
            autoFocus
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder="Try a name, @username or a word"
            autoComplete="off"
          />
          {raw ? (
            <button type="button" className="btn-icon" style={{ width: 32, minHeight: 32 }} onClick={() => setRaw("")} aria-label="Clear search">
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>
      </Field>

      {(empty.data?.recent ?? []).length > 0 && !query ? (
        <div className="pt-4">
          <p className="eyebrow pb-1">Recent searches</p>
          <div className="scroll-x">
            {(empty.data?.recent ?? []).map((item) => (
              <button key={item} type="button" className="chip" onClick={() => setRaw(item)}>
                <Icon name="clock" size={14} /> {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {query ? (
        <div className="pt-4">
          <Segmented
            label="Search result type"
            value={tab}
            onChange={setTab}
            options={[
              { value: "people", label: "People", badge: people.length },
              { value: "moments", label: "Moments", badge: moments.length },
            ]}
          />
        </div>
      ) : null}

      <div className="pt-3">
        {query && loading ? <LoadingRows rows={2} /> : null}
        {query && error && !loading ? <ErrorState title="Search failed" description={error} /> : null}

        {query && !loading ? (
          tab === "people" ? (
            people.length === 0 ? (
              <div className="card">
                <EmptyState icon="search" title={`No results for “${query}”`} description="Check the spelling, or try a username instead." />
              </div>
            ) : (
              <ul className="card divide-y divide-[color:var(--line)] p-0">
                {people.map((person) => (
                  <li key={person.id} className="flex items-center gap-2 px-2">
                    <Link href={`/profile/${person.username}`} className="list-row flex-1">
                      <Avatar user={person} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{person.name}</span>
                          {person.verified ? <Icon name="shield-check" size={14} className="text-brand" /> : null}
                          {person.profilePrivacy === "private" ? <Badge tone="private">Private</Badge> : null}
                        </span>
                        <span className="caption block truncate">@{person.username}</span>
                        {person.bio ? <span className="body-sm block truncate">{person.bio}</span> : null}
                      </span>
                    </Link>
                    <FollowButton
                      user={person}
                      relation={(person.relation ?? "follow") as RelationState}
                      size="sm"
                      onChanged={() => setRefreshKey((value) => value + 1)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : moments.length === 0 ? (
            <div className="card">
              <EmptyState icon="moments" title="No Moments match" description="Try a different word or search by username." />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {moments.map((moment) => (
                <MomentCard key={moment.id} moment={moment} />
              ))}
            </div>
          )
        ) : null}

        {!query ? (
          <div className="pt-2">
            <p className="eyebrow pb-1">Suggested people</p>
            {suggestions.length === 0 ? (
              <div className="card">
                <EmptyState icon="users" title="No suggestions right now" description="Search for a name or @username above." />
              </div>
            ) : (
              <ul className="card divide-y divide-[color:var(--line)] p-0">
                {suggestions.map((person) => (
                  <li key={person.id} className="flex items-center gap-2 px-2">
                    <Link href={`/profile/${person.username}`} className="list-row flex-1">
                      <Avatar user={person} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{person.name}</span>
                        <span className="caption block truncate">@{person.username}</span>
                        <span className="caption block truncate">{person.messageHint}</span>
                      </span>
                    </Link>
                    <FollowButton
                      user={person}
                      relation={person.isFollowing ? "following" : person.requested ? "requested" : "follow"}
                      size="sm"
                      onChanged={() => setRefreshKey((value) => value + 1)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <p className="caption flex items-center gap-1.5 pt-4 pb-6">
        <Icon name="clock" size={13} /> Searches are stored only for you, so you can find past results faster.
      </p>
      <span className="sr-only">
        Last updated <TimeAgo iso={new Date().toISOString()} />
      </span>
    </div>
  );
}
