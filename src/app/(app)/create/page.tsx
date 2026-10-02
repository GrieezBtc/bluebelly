"use client";

import { Composer } from "@/components/moments/feed";

export default function CreateMomentPage() {
  return (
    <div className="page create-page px-4">
      <Composer redirectTo="/moments" variant="create" />
      <div className="h-6" />
    </div>
  );
}
