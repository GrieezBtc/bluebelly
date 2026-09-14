import { NextResponse } from "next/server";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const badRequest = (message: string, code = "bad_request") => new ApiError(code, message, 400);
export const unauthorized = (message = "You need to sign in to continue.") =>
  new ApiError("unauthorized", message, 401);
export const forbidden = (message = "You do not have access to that.", code = "forbidden") =>
  new ApiError(code, message, 403);
export const notFound = (message = "Not found.") => new ApiError("not_found", message, 404);
export const conflict = (message: string, code = "conflict") => new ApiError(code, message, 409);

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json({ ok: true, data }, typeof init === "number" ? { status: init } : init);
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error("[bemblo:api]", error);
  return NextResponse.json(
    { ok: false, error: { code: "server_error", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") throw new Error("bad body");
    return body as T;
  } catch {
    throw badRequest("We could not read that request. Please try again.");
  }
}

export function requireString(value: unknown, field: string, opts: { min?: number; max?: number } = {}) {
  if (typeof value !== "string") throw badRequest(`${field} is required.`);
  const trimmed = value.trim();
  const min = opts.min ?? 1;
  const max = opts.max ?? 2000;
  if (trimmed.length < min) throw badRequest(`${field} must be at least ${min} characters.`);
  if (trimmed.length > max) throw badRequest(`${field} must be under ${max} characters.`);
  return trimmed;
}

export function optionalString(value: unknown, max = 2000): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`Please keep this under ${max} characters.`);
  return trimmed;
}

export function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  return fallback;
}

export function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function paginationFrom(searchParams: URLSearchParams) {
  const limit = Math.min(Math.max(toInt(searchParams.get("limit")) ?? 20, 1), 50);
  const cursor = searchParams.get("cursor") ?? undefined;
  return { limit, cursor };
}
