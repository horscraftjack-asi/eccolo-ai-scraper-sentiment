import { useState } from "react";
import { Download, Loader2, CheckCircle2, AlertCircle, Youtube, ArrowRight } from "lucide-react";
import { BACKEND_URL, normalizeClientSlug, csvField, type ScrapeResult } from "./shared";

type Status = "idle" | "loading" | "done" | "error";

interface CommentScraperProps {
  onSendToAnalyzer: (result: ScrapeResult) => void;
  onGoToAnalyzerStandalone: () => void;
}

export default function CommentScraper({
  onSendToAnalyzer,
  onGoToAnalyzerStandalone,
}: CommentScraperProps) {
  const [url, setUrl] = useState("");
  const [clientSlug, setClientSlug] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const run = async () => {
    if (!url.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    setResult(null);

    const normalizedSlug = normalizeClientSlug(clientSlug);
    const requestBody = {
      url: url.trim(),
      client_slug: normalizedSlug || null,
    };

    const fetchUrl = `${BACKEND_URL}/scrape`;
    try {
      const res = await fetch(fetchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          `Backend did not return JSON — called ${fetchUrl}. ` +
            `This usually means VITE_BACKEND_URL is empty or scheme-less, ` +
            `so the request hit the frontend instead of the backend. ` +
            `Got Content-Type: "${contentType}".`
        );
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error ?? `Backend returned ${res.status} from ${fetchUrl}`);
      }

      const data = await res.json();
      setResult(data as ScrapeResult);
      setStatus("done");
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "Could not reach the server. Is it running?"
      );
      setStatus("error");
    }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const safeTitle = (result.video?.title || result.video?.video_id || "comments")
      .replace(/[^a-z0-9]+/gi, "_")
      .slice(0, 60);
    link.download = `${safeTitle}_comments.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadCsv = () => {
    if (!result) return;
    const sourceId = result.source_id ?? "";
    const slug = result.provenance?.client_slug ?? "";

    const header = [
      "client_slug",
      "source_id",
      "comment_id",
      "parent_id",
      "author",
      "text",
      "likes",
      "published_at",
      "is_reply",
    ];
    const rows: string[] = [header.join(",")];

    for (const comment of result.comments ?? []) {
      rows.push(
        [
          csvField(slug),
          csvField(sourceId),
          csvField(comment.comment_id),
          csvField(""),
          csvField(comment.author),
          csvField(comment.text),
          csvField(comment.likes ?? ""),
          csvField(comment.published_at),
          csvField(false),
        ].join(",")
      );
      for (const reply of comment.replies ?? []) {
        rows.push(
          [
            csvField(slug),
            csvField(sourceId),
            csvField(reply.reply_id),
            csvField(comment.comment_id),
            csvField(reply.author),
            csvField(reply.text),
            csvField(reply.likes ?? ""),
            csvField(reply.published_at),
            csvField(true),
          ].join(",")
        );
      }
    }

    const csv = rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const videoId = result.video?.video_id || "scrape";
    link.download = `${slug || "scrape"}_${videoId}_comments.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const reset = () => {
    setUrl("");
    setClientSlug("");
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500 mb-4">
            <Youtube className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">Comment Scraper</h1>
          <p className="text-slate-500 mt-1">Paste a YouTube link, get a clean data file.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {status !== "done" && (
            <>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                YouTube video URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && status !== "loading" && run()}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={status === "loading"}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition disabled:bg-slate-50 disabled:text-slate-400"
              />

              <label className="block text-sm font-medium text-slate-600 mb-2 mt-4">
                Client slug (optional)
              </label>
              <input
                type="text"
                value={clientSlug}
                onChange={(e) => setClientSlug(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && status !== "loading" && run()}
                placeholder="e.g. jameshoffmann"
                disabled={status === "loading"}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition disabled:bg-slate-50 disabled:text-slate-400"
              />

              <button
                onClick={run}
                disabled={status === "loading" || !url.trim()}
                className="w-full mt-4 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Fetching comments…
                  </>
                ) : (
                  "Get comments"
                )}
              </button>

              {status === "loading" && (
                <p className="text-center text-sm text-slate-400 mt-3">
                  This can take a moment on videos with lots of comments.
                </p>
              )}

              {status === "error" && (
                <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errorMsg}</p>
                </div>
              )}
            </>
          )}

          {status === "done" && result && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">
                {result.video?.title || "Comments ready"}
              </h2>
              {result.video?.channel && (
                <p className="text-sm text-slate-500 mb-4">{result.video.channel}</p>
              )}

              <div className="flex justify-center gap-6 my-5 text-center">
                <div>
                  <div className="text-2xl font-semibold text-slate-800">
                    {result.summary?.top_level_comments?.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Comments</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-slate-800">
                    {result.summary?.total_replies?.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Replies</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-slate-800">
                    {result.summary?.total_items?.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Total</div>
                </div>
              </div>

              <button
                onClick={download}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download JSON
              </button>
              <button
                onClick={downloadCsv}
                className="w-full mt-2 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download CSV
              </button>
              <button
                onClick={() => onSendToAnalyzer(result)}
                className="w-full mt-2 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                Send to Analyzer
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={reset}
                className="w-full mt-2 py-2.5 rounded-xl text-slate-500 font-medium hover:bg-slate-50 transition"
              >
                Scrape another video
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Output is threaded JSON with full metadata — ready to feed straight into analysis.
        </p>
        <p className="text-center mt-3">
          <button
            onClick={onGoToAnalyzerStandalone}
            className="text-sm text-indigo-600 hover:text-indigo-800 underline"
          >
            Or analyze an existing comments export →
          </button>
        </p>
      </div>
    </div>
  );
}
