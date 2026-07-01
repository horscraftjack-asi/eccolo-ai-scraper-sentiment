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
    published_at?: string;
    view_count?: string | number;
    like_count?: string | number;
    comment_count_reported?: string | number;
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

// ─────────────────────────────────────────────────────────────
// Recently-scraped videos, kept client-side so the Input screen can
// show a short history without needing a backend table for it.
const RECENT_KEY = "threadline_recent_scrapes";

export interface RecentScrape {
  videoId: string;
  title: string;
  totalItems: number;
  timestamp: number;
}

export function loadRecentScrapes(): RecentScrape[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentScrape[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentScrape(entry: RecentScrape): RecentScrape[] {
  try {
    const existing = loadRecentScrapes().filter((r) => r.videoId !== entry.videoId);
    const updated = [entry, ...existing].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return loadRecentScrapes();
  }
}

export function timeAgo(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
