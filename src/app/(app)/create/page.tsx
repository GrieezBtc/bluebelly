"use client";

import { PageHeader } from "@/components/app-shell";
import { Composer } from "@/components/moments/feed";

export default function CreateMomentPage() {
  return (
    <div className="page px-4">
      <PageHeader title="Create a Moment" subtitle="Choose your audience before publishing" backHref="/moments" />
      <Composer redirectTo="/moments" />
      <div className="h-6" />
    </div>
  );
}
