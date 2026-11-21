import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/icons";
import { PublicProviders } from "@/components/providers";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <PublicProviders>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-6">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="BlueBelly home">
            <BrandMark size={30} />
          </Link>
          <Link href="/support" className="text-sm font-semibold text-brand">
            Help
          </Link>
        </header>
        <main className="flex flex-1 flex-col justify-center py-6">{children}</main>
        <footer className="pt-6 text-center">
          <p className="caption">BlueBelly — Talk. Share. Connect.</p>
          <nav className="flex justify-center gap-4 pt-2 text-xs" aria-label="Legal">
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/guidelines">Guidelines</Link>
          </nav>
        </footer>
      </div>
    </PublicProviders>
  );
}
