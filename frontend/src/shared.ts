// ─────────────────────────────────────────────────────────────
// The address of the Flask backend, injected at build time.
// Set VITE_BACKEND_URL in your environment (Railway → Variables).
// Falls back to localhost for `npm run dev`.
function resolveBackendUrl(): string {
  const raw = (import.meta.env.VITE_BACKEND_URL ?? "").trim();
  if (!raw) return "http://localhost:5000"; // dev fallback
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, ""); // no trailing slash
}

export const BACKEND_URL = resolveBackendUrl();
// ─────────────────────────────────────────────────────────────

export interface Comment {
  comment_id: string;
  author?: string;
  text?: string;
  likes?: number;
  published_at?: string;
  replies: Array<{
    reply_id: string;
    author?: string;
    text?: string;
    likes?: number;
    published_at?: string;
  }>;
}

export interface ScrapeResult {
  video?: {
    title?: string;
    channel?: string;
    video_id?: string;
  };
  summary?: {
    top_level_comments?: number;
    total_replies?: number;
    total_items?: number;
  };
  comments?: Comment[];
  source_id?: string;
  provenance?: {
    run_id?: string;
    generated_at?: string;
    tool?: string;
    tool_version?: string;
    client_slug?: string | null;
    source_ids?: string[];
  };
  [key: string]: unknown;
}

// Soft-normalise a client slug: lowercase, strip spaces. Never blocks submission.
export function normalizeClientSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

// Minimal well-formed CSV field quoting: quote always, double embedded quotes.
export function csvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}
