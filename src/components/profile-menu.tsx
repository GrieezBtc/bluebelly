"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Avatar, useToast } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { useSession } from "@/components/providers";
import { useInstallPrompt } from "@/lib/client";

type MenuLink = { href: string; label: string; blurb?: string; icon: IconName };

const SETTINGS: MenuLink[] = [
  { href: "/settings?tab=account", label: "Account & app", blurb: "Login, security, appearance", icon: "sliders" },
  { href: "/settings?tab=privacy", label: "Privacy & safety", blurb: "Profile visibility, blocked and muted", icon: "lock" },
  { href: "/settings?tab=messaging", label: "Messaging", blurb: "Who can message you, expiry", icon: "chat" },
  { href: "/settings?tab=notifications", label: "Notifications", blurb: "Push, email and in-app alerts", icon: "bell" },
  { href: "/settings?tab=content", label: "Content preferences", blurb: "Sensitive content, muted words", icon: "shield-check" },
];

const ABOUT: MenuLink[] = [
  { href: "/support", label: "Help & Support", blurb: "Guides, contact and account recovery", icon: "help" },
  { href: "/legal/terms", label: "Terms of Service", icon: "shield" },
  { href: "/legal/privacy", label: "Privacy Policy", icon: "shield" },
  { href: "/legal/guidelines", label: "Community guidelines", icon: "users" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="eyebrow px-4 pb-1 pt-4">{title}</p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function Row({ item }: { item: MenuLink }) {
  return (
    <li>
      <Link href={item.href} className="list-row px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
          <Icon name={item.icon} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.label}</span>
          {item.blurb ? <span className="caption block truncate">{item.blurb}</span> : null}
        </span>
        <Icon name="chevron-right" size={16} className="text-ink-3" />
      </Link>
    </li>
  );
}

/** Side menu that slides in from the profile page. Holds app-level settings, legal pages and log out. */
export function ProfileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useSession();
  const { available, install } = useInstallPrompt();
  const { show } = useToast();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" className="profile-menu-backdrop absolute inset-0" aria-label="Close menu" onClick={onClose} />
      <aside className="profile-menu-panel absolute right-0 top-0 flex h-dvh w-[min(88vw,360px)] flex-col bg-surface shadow-lg">
        <header className="flex items-center gap-3 border-b border-[color:var(--line)] px-4 py-3">
          {user ? <Avatar user={user} size="md" /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name ?? "Menu"}</p>
            {user ? <p className="caption truncate">@{user.username}</p> : null}
          </div>
          <button type="button" className="btn-icon" aria-label="Close menu" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </header>

        <nav className="min-h-0 flex-1 overflow-y-auto pb-4" aria-label="Profile menu">
          <Section title="Settings">
            {SETTINGS.map((item) => (
              <Row key={item.href} item={item} />
            ))}
          </Section>
          <Section title="About & help">
            {ABOUT.map((item) => (
              <Row key={item.href} item={item} />
            ))}
          </Section>
        </nav>

        <footer className="safe-bottom flex flex-col gap-2 border-t border-[color:var(--line)] p-4">
          {available ? (
            <button type="button" className="btn btn-secondary" onClick={install}>
              <Icon name="install" size={16} /> Install Bemblo
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary text-coral"
            onClick={async () => {
              onClose();
              await signOut();
              show({ title: "Signed out", tone: "info" });
            }}
          >
            <Icon name="logout" size={16} /> Log out
          </button>
        </footer>
      </aside>
    </div>
  );
}
