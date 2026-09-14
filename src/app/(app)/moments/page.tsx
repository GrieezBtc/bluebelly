"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import { FeedList, SuggestionsRail } from "@/components/moments/feed";
import { Segmented } from "@/components/ui";
import { useSession } from "@/components/providers";

export default function MomentsFeedPage() {
  const { user } = useSession();
  const [scope, setScope] = useState<"discover" | "mine">("discover");

  return (
    <div>
      <PageHeader
        title="Moments"
        subtitle="Photos, videos and thoughts that stay until deleted"
        actions={
          <Link href="/create" className="btn btn-primary btn-sm">
            <Icon name="create" size={16} /> New
          </Link>
        }
      />
      <div className="px-4 pb-3">
        <Segmented
          label="Feed filter"
          value={scope}
          onChange={setScope}
          options={[
            { value: "discover", label: "For you" },
            { value: "mine", label: "My Moments" },
          ]}
        />
      </div>
      <div className="page px-4 pb-4">
        <FeedList
          query={scope === "mine" && user ? `/api/moments?authorId=${user.id}&limit=10` : "/api/moments?limit=10"}
          empty={
            scope === "mine"
              ? {
                  title: "You have not posted a Moment yet",
                  description: "Photos, videos and text — choose who sees it before you publish.",
                  action: (
                    <Link href="/create" className="btn btn-primary btn-sm">
                      Create your first Moment
                    </Link>
                  ),
                }
              : {
                  title: "Nothing here yet",
                  description: "Follow a few people and their Moments will appear here instantly.",
                  action: (
                    <Link href="/search" className="btn btn-primary btn-sm">
                      Find people
                    </Link>
                  ),
                }
          }
        />
        <div className="pt-4 lg:hidden">
          <SuggestionsRail />
        </div>
      </div>
    </div>
  );
}
