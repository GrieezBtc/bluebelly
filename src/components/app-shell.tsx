"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark, Icon, type IconName } from "@/components/icons";
import { Avatar, useToast } from "@/components/ui";
import { useSession } from "@/components/providers";
import { useInstallPrompt } from "@/lib/client";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  match: (path: string) => boolean;
};

export function useNavItems(): NavItem[] {
  const { user } = useSession();
  const counts = user?.counts;
  return [
    { href: "/home", label: "Home", icon: "home", match: (p) => p === "/home" || p === "/" },
    { href: "/moments", label: "Moments", icon: "moments", match: (p) => p.startsWith("/moments") },
    { href: "/create", label: "Create", icon: "create", match: (p) => p.startsWith("/create") },
    {
      href: "/messages",
      label: "Messages",
      icon: "chat",
      badge: (counts?.unreadMessages ?? 0) + (counts?.requests ?? 0),
      match: (p) => p.startsWith("/messages"),
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: "bell",
      badge: counts?.unreadNotifications ?? 0,
      match: (p) => p.startsWith("/notifications"),
    },
    {
      href: user ? `/profile/${user.username}` : "/profile",
      label: "Profile",
      icon: "user",
      match: (p) => p.startsWith("/profile") || p.startsWith("/settings"),
    },
  ];
}

export function BrandHeaderActions({ onOpenSearch }: { onOpenSearch?: () => void }) {
  const { user } = useSession();
  return (
    <div className="flex items-center gap-1">
      {onOpenSearch ? (
        <button type="button" className="btn-icon" onClick={onOpenSearch} aria-label="Search Bemblo">
          <Icon name="search" />
        </button>
      ) : (
        <Link href="/search" className="btn-icon" aria-label="Search Bemblo">
          <Icon name="search" />
        </Link>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const items = useNavItems();
  const [installBannerDismissed, setInstallBannerDismissed] = useState(true);
  const { available, install } = useInstallPrompt();
  const { show } = useToast();

  useEffect(() => {
    setInstallBannerDismissed(window.localStorage.getItem("bemblo-install-dismissed") === "1");
  }, []);

  const isMainTab = ["/home", "/moments", "/create", "/messages"].includes(pathname) || pathname.startsWith("/profile/");

  return (
    <div className="app-shell">
      <a href="#bemblo-main" className="sr-only">
        Skip to content
      </a>

      {/* Mobile header */}
      {isMainTab ? (
        <header className="sticky-top flex items-center justify-between gap-3 px-4 py-3 md:hidden">
          <Link href="/home" aria-label="Bemblo home">
            <BrandMark size={30} />
          </Link>
          <BrandHeaderActions />
        </header>
      ) : null}

      <div className="desktop-frame">
        {/* Desktop / tablet sidebar */}
        <aside className="hidden md:block">
          <div className="sticky top-0 flex h-dvh flex-col gap-4 py-5">
            <Link href="/home" className="px-1" aria-label="Bemblo home">
              <BrandMark size={34} />
            </Link>
            <nav className="flex flex-col gap-1" aria-label="Main navigation">
              {items.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link key={item.href} href={item.href} className="sidebar-item" data-active={active} aria-current={active ? "page" : undefined}>
                    <Icon name={item.icon} size={22} filled={false} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && item.badge > 0 ? <span className="count-badge">{item.badge > 9 ? "9+" : item.badge}</span> : null}
                  </Link>
                );
              })}
              <Link href="/notifications" className="sidebar-item" data-active={pathname.startsWith("/notifications")}>
                <Icon name="bell" size={22} />
                <span className="flex-1">Notifications</span>
                {user?.counts.unreadNotifications ? (
                  <span className="count-badge">
                    {user.counts.unreadNotifications > 9 ? "9+" : user.counts.unreadNotifications}
                  </span>
                ) : null}
              </Link>
              <Link href="/search" className="sidebar-item" data-active={pathname.startsWith("/search")}>
                <Icon name="search" size={22} />
                <span className="flex-1">Search</span>
              </Link>
              <Link href="/settings" className="sidebar-item" data-active={pathname.startsWith("/settings")}>
                <Icon name="sliders" size={22} />
                <span className="flex-1">Settings</span>
              </Link>
              <Link href="/support" className="sidebar-item" data-active={pathname.startsWith("/support")}>
                <Icon name="help" size={22} />
                <span className="flex-1">Help &amp; Support</span>
              </Link>
            </nav>

            <div className="mt-auto flex flex-col gap-2">
              {available ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={install}>
                  <Icon name="install" size={16} /> Install Bemblo
                </button>
              ) : null}
              {user ? (
                <div className="card card-pad flex items-center gap-3">
                  <Avatar user={user} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="caption truncate">@{user.username}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Log out"
                    onClick={async () => {
                      await signOut();
                      show({ title: "Signed out", tone: "info" });
                    }}
                  >
                    <Icon name="logout" size={18} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main id="bemblo-main" className="app-main min-w-0">
          {children}
        </main>
      </div>

      {/* Install / PWA banner */}
      {!installBannerDismissed && available ? (
        <div className="fixed inset-x-3 bottom-[calc(var(--nav-height)+14px)] z-[45] md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
          <div className="card card-pad flex items-start gap-3 shadow-lg">
            <span className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-full text-white">
              <Icon name="install" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Install Bemblo</p>
              <p className="caption">Full-screen, faster launch and notifications. Works offline for the shell.</p>
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={install}>
                  Install
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    window.localStorage.setItem("bemblo-install-dismissed", "1");
                    setInstallBannerDismissed(true);
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mobile bottom navigation */}
      <nav className="bottom-nav safe-bottom md:hidden" aria-label="Main navigation">
        {items.map((item) => {
          const active = item.match(pathname);
          if (item.href === "/create") {
            return (
              <Link
                key={item.href}
                href="/create"
                className="nav-create"
                aria-label="Create a Moment"
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-create__inner">
                  <Icon name="create" size={24} />
                </span>
                <span className="mt-1 text-[0.6875rem] font-semibold" style={{ color: active ? "var(--brand)" : "var(--ink-3)" }}>
                  Create
                </span>
              </Link>
            );
          }
          return (
            <Link key={item.href} href={item.href} className="nav-item" data-active={active} aria-current={active ? "page" : undefined}>
              <Icon name={item.icon} size={22} filled={false} />
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="count-badge nav-item__dot">{item.badge > 9 ? "9+" : item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  actions,
  sticky = true,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <header className={cn("flex items-center gap-2 px-2 py-3", sticky && "sticky-top")}>
      {backHref ? (
        <Link href={backHref} className="btn-icon" aria-label="Go back">
          <Icon name="chevron-left" size={22} />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1 px-1">
        <h1 className="h2 truncate">{title}</h1>
        {subtitle ? <p className="caption truncate">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </header>
  );
}
