"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Spinner, useToast } from "@/components/ui";
import { api } from "@/lib/client";

export function DemoButton({ label = "Explore the demo", block }: { label?: string; block?: boolean }) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className={`btn btn-secondary${block ? " btn-block" : ""}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.post("/api/demo");
          show({ title: "Welcome to Bemblo", description: "You are signed in as @ava.rivera.", tone: "success" });
          router.replace("/home");
        } catch (error) {
          show({
            title: "Demo unavailable",
            description: error instanceof Error ? error.message : "Try again in a moment.",
            tone: "error",
          });
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <Icon name="sparkle" size={18} />}
      {label}
    </button>
  );
}
