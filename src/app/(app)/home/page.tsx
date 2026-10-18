"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import { FeedList, SuggestionsStrip } from "@/components/moments/feed";

/** Home: a clean feed of Moments with people suggestions on top. */
export default function HomePage() {
  return (
    <div>
      <PageHeader
        title="Home"
        actions={
          <Link href="/create" className="btn btn-primary btn-sm">
            <Icon name="create" size={16} /> New
          </Link>
        }
      />
      <div className="page flex flex-col gap-4 px-4 pb-6">
        <SuggestionsStrip />
        <FeedList
          query="/api/moments?limit=10"
          empty={{
            title: "No Moments yet",
            description: "Follow a few people or share your first Moment to fill this space.",
            action: (
              <Link href="/search" className="btn btn-primary btn-sm">
                Find people
              </Link>
            ),
          }}
        />
      </div>
    </div>
  );
}
