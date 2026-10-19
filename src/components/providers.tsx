"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { ToastProvider } from "@/components/ui";
import type { SessionUser } from "@/lib/types";

type SessionContextValue = {
  user: SessionUser | null;
  status: "authenticated" | "anonymous";
  setUser: (user: SessionUser | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  user: null,
  status: "anonymous",
  setUser: () => {},
  refresh: async () => {},
  signOut: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ user: initialUser, children }: { user: SessionUser; children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const result = await api.get<{ authenticated: boolean; user: SessionUser | null }>("/api/auth/session");
      setUser(result.user);
    } catch {
      /* keep the current session on transient failures */
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setUser(null);
      router.replace("/login");
      router.refresh();
    }
  }, [router]);


  useEffect(() => {
    if (!user?.id) return;

    let inFlight = false;

    const heartbeat = () => {
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        inFlight
      ) {
        return;
      }

      inFlight = true;
      void api
        .post("/api/presence")
        .catch(() => {
          // A failed heartbeat must not interrupt the app.
        })
        .finally(() => {
          inFlight = false;
        });
    };

    heartbeat();

    const interval = window.setInterval(heartbeat, 45_000);
    document.addEventListener("visibilitychange", heartbeat);
    window.addEventListener("online", heartbeat);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
      window.removeEventListener("online", heartbeat);
    };
  }, [user?.id]);

  const value = useMemo<SessionContextValue>(
    () => ({ user, status: user ? "authenticated" : "anonymous", setUser, refresh, signOut }),
    [user, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function ThemeSync() {
  useEffect(() => {
    const stored = window.localStorage.getItem("bemblo-theme");
    const root = document.documentElement;
    if (stored === "dark") root.classList.add("dark");
    if (stored === "light") root.classList.remove("dark");
  }, []);
  return null;
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline shell is best effort */
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

export function NetworkBanner() {
  const [online, setOnline] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) setBanner("You are offline. Bemblo will sync when your connection returns.");
      else setBanner(null);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (online) return;
    const handler = () => setBanner("Still offline — drafts are kept on this device.");
    window.addEventListener("bemblo-offline-action", handler);
    return () => window.removeEventListener("bemblo-offline-action", handler);
  }, [online]);

  if (!banner) return null;
  return (
    <div
      className="banner banner-warn fixed inset-x-0 top-0 z-[70] rounded-none border-x-0 border-t-0"
      role="status"
    >
      <span className="font-semibold">{banner}</span>
    </div>
  );
}

export function AppProviders({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <SessionProvider user={user}>
      <ToastProvider>
        <ThemeSync />
        <ServiceWorkerRegistrar />
        <NetworkBanner />
        {children}
      </ToastProvider>
    </SessionProvider>
  );
}

export function PublicProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ThemeSync />
      <NetworkBanner />
      {children}
    </ToastProvider>
  );
}
