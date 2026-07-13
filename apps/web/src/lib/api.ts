import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new ApiError(401, "You're signed out. Please log in again.");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    return JSON.stringify(body.detail ?? body);
  } catch {
    return res.statusText || "Something went wrong.";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = await authHeaders();
  const init: RequestInit = { method: options.method ?? "GET", headers };

  if (options.formData) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.headers = { ...headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_URL}${path}`, init);

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  return res.blob();
}
