"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ApiFailure = { ok: false; error: { code: string; message: string } };
export type ApiSuccess<T> = { ok: true; data: T };

export class ApiClientError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  const isForm = init?.body instanceof FormData;
  if (!isForm && init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new ApiClientError("network_unavailable", "You appear to be offline. Bemblo will retry when you reconnect.");
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const body = payload as ApiSuccess<T> | ApiFailure | null;
  if (!body || typeof body !== "object" || !("ok" in body)) {
    throw new ApiClientError("server_error", "Unexpected response from Bemblo. Please try again.");
  }
  if (!body.ok) throw new ApiClientError(body.error.code, body.error.message);
  return body.data;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T,>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
};

export type QueryState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (updater: T | ((current: T | null) => T)) => void;
};

/** Small data hook shared by every Bemblo screen. */
export function useQuery<T>(path: string | null, options?: { skip?: boolean }): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path) && !options?.skip);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path || options?.skip) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<T>(path)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, options?.skip, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  const update = useCallback((updater: T | ((current: T | null) => T)) => {
    setData((current) => (typeof updater === "function" ? (updater as (c: T | null) => T)(current) : updater));
  }, []);

  return { data, error, loading, reload, setData: update };
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function useInstallPrompt() {
  const [available, setAvailable] = useState(false);
  const promptRef = useRef<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as unknown as { prompt: () => Promise<void> };
      setAvailable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    await promptRef.current?.prompt();
    setAvailable(false);
  }, []);

  return { available, install };
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function useCopyToClipboard() {
  return useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }, []);
}
