"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandMark, Icon } from "@/components/icons";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[bemblo:render]", error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="card card-pad w-full max-w-md text-center">
        <div className="flex justify-center pb-4">
          <BrandMark size={36} />
        </div>
        <span className="empty-state__icon mx-auto" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
          <Icon name="alert" size={26} />
        </span>
        <h1 className="h1 pt-3">Something went wrong</h1>
        <p className="body-sm pt-1">
          This one is on us. Your messages and Moments are safe. Try again, and if it keeps happening contact Bemblo Support.
        </p>
        <div className="flex flex-col gap-2 pt-5 sm:flex-row sm:justify-center">
          <button type="button" className="btn btn-primary" onClick={reset}>
            <Icon name="refresh" size={18} /> Try again
          </button>
          <Link href="/support" className="btn btn-secondary">
            <Icon name="help" size={18} /> Contact support
          </Link>
          <Link href="/home" className="btn btn-ghost">
            Back to Home
          </Link>
        </div>
        {error.digest ? <p className="caption pt-3">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
