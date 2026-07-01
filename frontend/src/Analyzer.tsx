import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertTriangle,
  Sparkles,
  Upload,
} from "lucide-react";
import { BACKEND_URL, normalizeClientSlug, type ScrapeResult } from "./shared";

type Status = "idle" | "loading" | "done" | "error";

interface PurposeOption {
  purpose_id: string;
  display_name: string;
  one_line: string;
  status: "mature" | "stub";
}

interface ClientOption {
  client_slug: string;
  client_name: string;
}

interface AnalyzeResult {
  status: "not_enabled" | "ok";
  reason?: string;
  assembled_prompt?: string;
  ingest_diagnostics?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  purpose_resolved?: { display_name?: string } | null;
  client_resolved?: { client_name?: string } | null;
  report_markdown?: string;
  [key: string]: unknown;
}

interface AnalyzerProps {
  scrapeResult: ScrapeResult | null;
  onBack: () => void;
}

export default function Analyzer({ scrapeResult, onBack }: AnalyzerProps) {
  const [purposes, setPurposes] = useState<PurposeOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [analyzerEnabled, setAnalyzerEnabled] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  const [purposeId, setPurposeId] = useState("");
  const [clientSlug, setClientSlug] = useState(
    scrapeResult?.provenance?.client_slug || ""
  );
  const [scope, setScope] = useState<"per-video" | "synthesis">("per-video");
  const [transcript, setTranscript] = useState("");
  const [teamNotes, setTeamNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`${BACKEND_URL}/sentiment/options`)
      .then((res) => {
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setPurposes(data.purposes || []);
        setClients(data.clients || []);
        setAnalyzerEnabled(!!data.analyzer_enabled);
        if (data.purposes?.length) setPurposeId(data.purposes[0].purpose_id);
      })
      .catch((e) =>
        setOptionsError(
          e instanceof Error ? e.message : "Could not load purposes/clients."
        )
      );
  }, []);

  const selectedPurpose = purposes.find((p) => p.purpose_id === purposeId);

  const run = async () => {
    if (!purposeId) return;
    if (!scrapeResult && !uploadFile) return;

    setStatus("loading");
    setErrorMsg("");
    setResult(null);

    const form = new FormData();
    form.append("purpose_id", purposeId);
    const normalizedSlug = normalizeClientSlug(clientSlug);
    if (normalizedSlug) form.append("client_slug", normalizedSlug);
    form.append("scope", scope);
    if (transcript.trim()) form.append("transcript", transcript.trim());
    if (teamNotes.trim()) form.append("team_notes", teamNotes.trim());

    if (scrapeResult) {
      form.append("scrape_result", JSON.stringify(scrapeResult));
    } else if (uploadFile) {
      form.append("file", uploadFile);
    }

    const url = `${BACKEND_URL}/analyze`;
    try {
      const res = await fetch(url, { method: "POST", body: form });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          `Backend did not return JSON — called ${url}. Got Content-Type: "${contentType}".`
        );
      }
      const data = await res.json();
      // 503 "not_enabled" is a valid, expected result while the analyzer is stubbed —
      // not a fetch failure. Any other non-OK status is a real error.
      if (!res.ok && res.status !== 503) {
        throw new Error(data.error ?? `Backend returned ${res.status} from ${url}`);
      }
      setResult(data as AnalyzeResult);
      setStatus("done");
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "Could not reach the server. Is it running?"
      );
      setStatus("error");
    }
  };

  const downloadPrompt = () => {
    if (!result?.assembled_prompt) return;
    const blob = new Blob([result.assembled_prompt], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `assembled-prompt-${purposeId}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadDiagnostics = () => {
    if (!result) return;
    const payload = {
      provenance: result.provenance,
      ingest_diagnostics: result.ingest_diagnostics,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ingest-diagnostics-${purposeId}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to scraper
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">Sentiment Analyzer</h1>
          <p className="text-slate-500 mt-1">
            {scrapeResult
              ? `Analysing ${scrapeResult.video?.title || scrapeResult.video?.video_id || "the scraped video"}`
              : "Upload a comments CSV or native JSON export to analyse."}
          </p>
        </div>

        {!analyzerEnabled && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              The analyzer isn't enabled yet — no <code>ANTHROPIC_API_KEY</code> is configured.
              You can still run the full pipeline below; it'll show you the assembled prompt and
              ingest diagnostics instead of a report.
            </p>
          </div>
        )}

        {optionsError && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{optionsError}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          {!scrapeResult && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Comments file (§3.1 CSV or native JSON)
              </label>
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-slate-300 text-slate-500 cursor-pointer hover:border-indigo-400 hover:text-indigo-600 transition">
                <Upload className="w-4 h-4" />
                {uploadFile ? uploadFile.name : "Choose a file"}
                <input
                  type="file"
                  accept=".csv,.json"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Purpose</label>
            <select
              value={purposeId}
              onChange={(e) => setPurposeId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            >
              {purposes.map((p) => (
                <option key={p.purpose_id} value={p.purpose_id}>
                  {p.display_name}
                  {p.status === "stub" ? " (preview — shape only)" : ""}
                </option>
              ))}
            </select>
            {selectedPurpose && (
              <p className="text-xs text-slate-400 mt-1">{selectedPurpose.one_line}</p>
            )}
            {selectedPurpose?.status === "stub" && (
              <p className="text-xs text-amber-600 mt-1">
                This purpose is a preview — output won't be mature yet.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Client (optional)
            </label>
            <select
              value={clientSlug}
              onChange={(e) => setClientSlug(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            >
              <option value="">Run client-agnostic</option>
              {clients.map((c) => (
                <option key={c.client_slug} value={c.client_slug}>
                  {c.client_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Scope</label>
            <div className="flex gap-2">
              {(["per-video", "synthesis"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${
                    scope === s
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-slate-300 text-slate-600 hover:border-indigo-300"
                  }`}
                >
                  {s === "per-video" ? "Per video" : "Synthesis"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Transcript (optional)
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={3}
              placeholder="Paste the video transcript…"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Team notes (optional)
            </label>
            <textarea
              value={teamNotes}
              onChange={(e) => setTeamNotes(e.target.value)}
              rows={2}
              placeholder="Any context for this run…"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            />
          </div>

          <button
            onClick={run}
            disabled={status === "loading" || !purposeId || (!scrapeResult && !uploadFile)}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running analysis…
              </>
            ) : (
              "Run analysis"
            )}
          </button>

          {status === "error" && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {status === "done" && result?.status === "not_enabled" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Analyzer not yet enabled — {result.reason}. The pipeline ran end-to-end;
                  here's what would have been sent to the model.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-lg font-semibold text-slate-800">
                    {String(result.ingest_diagnostics?.rows_total ?? "—")}
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">
                    Comment rows
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-lg font-semibold text-slate-800">
                    {String(result.provenance?.client_slug ?? "standalone")}
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">
                    Client slug
                  </div>
                </div>
              </div>

              <button
                onClick={downloadPrompt}
                className="w-full py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download assembled prompt
              </button>
              <button
                onClick={downloadDiagnostics}
                className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download ingest diagnostics + provenance
              </button>

              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-700">
                  Preview assembled prompt
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 overflow-auto max-h-64 whitespace-pre-wrap">
                  {result.assembled_prompt}
                </pre>
              </details>
            </div>
          )}

          {status === "done" && result?.status === "ok" && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800">
                Report generated.
              </div>
              <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 overflow-auto max-h-96 whitespace-pre-wrap text-sm">
                {result.report_markdown}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
