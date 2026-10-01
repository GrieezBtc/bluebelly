import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sessionPayload, sweepIfStale } from "@/db/store";
import { AppProviders } from "@/components/providers";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.emailVerifiedAt) redirect("/verify-required");
  if (!user.onboardedAt) redirect("/onboarding");
  await sweepIfStale();
  const session = await sessionPayload(user);

  return (
    <AppProviders user={session}>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
