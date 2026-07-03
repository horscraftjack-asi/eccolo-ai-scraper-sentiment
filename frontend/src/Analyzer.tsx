import { useEffect, useMemo, useRef, useState } from "react";
import {
  ANALYTICS_URL,
  BACKEND_URL,
  analyticsLinkFor,
  normalizeClientSlug,
  type ScrapeResult,
} from "./shared";

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
  client_slug_resolved?: string | null;
  client_context_applied?: boolean;
  truncated?: boolean;
  continuations?: number;
  summary_json?: Record<string, unknown> | null;
  validation?: { valid: boolean; errors: string[]; warnings: string[] };
  [key: string]: unknown;
}

interface AnalyzerProps {
  scrapeResult: ScrapeResult | null;
  onBack: () => void;
}

const STEP_LABELS = ["Ingest comments", "Assemble prompt", "Call model", "Validate report"];

// contract §4 only gives a qualitative prominence (strong/moderate/weak), not a mention
// count — the meter width is scaled from that tier rather than fabricating a number.
const PROMINENCE_WIDTH: Record<string, number> = { strong: 100, moderate: 65, weak: 35 };
const PROMINENCE_COLOR: Record<string, string> = {
  strong: "#B8F24A", moderate: "#7fb83a", weak: "#3f5a2b",
};

const DIRECTION_LABEL: Record<string, string> = {
  "course-development": "MODULE DIRECTION",
  "content-ideation": "CONTENT DIRECTION",
  "ip-development": "PRODUCT DIRECTION",
  "qa-mining": "ANSWER DIRECTION",
};

interface Theme { name: string; prominence?: string; }
interface QuestionCluster { name: string; }
interface PainPoint { name: string; course_response?: string; }
interface Gap { name: string; opportunity?: string; }

function directionBullets(summary: Record<string, unknown>): string[] {
  const painPoints = (summary.pain_points as PainPoint[] | undefined) ?? [];
  const gaps = (summary.gaps as Gap[] | undefined) ?? [];
  const bullets = [
    ...painPoints.map((p) => p.course_response).filter(Boolean),
    ...gaps.map((g) => g.opportunity).filter(Boolean),
  ] as string[];
  return bullets.slice(0, 3);
}

const LOG_ROTATION = [
  "> reading comments export…",
  "> assembling prompt…",
  "> calling the model — this can take a minute…",
  "> validating report against contract §4…",
];

export default function Analyzer({ scrapeResult, onBack }: AnalyzerProps) {
  const [purposes, setPurposes] = useState<PurposeOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [analyzerEnabled, setAnalyzerEnabled] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  const [purposeId, setPurposeId] = useState("");
  const [clientSlug, setClientSlug] = useState(
    (scrapeResult?.provenance?.client_slug as string) || ""
  );
  const [scope, setScope] = useState<"per-video" | "synthesis">("per-video");
  const [transcript, setTranscript] = useState("");
  const [teamNotes, setTeamNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [directionCopied, setDirectionCopied] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const startedAtRef = useRef(0);
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  useEffect(() => clearTimers, []);

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

  // Drop into the "done" state with a full result payload (the shape the result panel renders).
  const finishWith = (data: AnalyzeResult) => {
    clearTimers();
    setStepIndex(3);
    timersRef.current.push(
      setTimeout(() => {
        setResult(data);
        setStatus("done");
      }, 300)
    );
  };

  const fail = (e: unknown) => {
    clearTimers();
    setErrorMsg(
      e instanceof Error ? e.message : "Could not reach the server. Is it running?"
    );
    setStatus("error");
  };

  // The real analysis runs on a background thread server-side (Railway's edge proxy kills any
  // single request at ~300s, and a full report runs longer). Poll for completion instead of
  // holding one long request open. Each poll is sub-second, so it never trips the edge timeout.
  const pollJob = (jobId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/analyze/status/${jobId}`);
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          throw new Error(`Status check did not return JSON (Content-Type: "${ct}").`);
        }
        const data = await res.json();
        if (data.status === "running") return; // keep polling
        if (data.status === "error") {
          fail(new Error(data.error || "Analysis failed."));
        } else {
          finishWith(data as AnalyzeResult); // "ok" — full report shape
        }
      } catch (e) {
        fail(e);
      }
    };
    const id = setInterval(poll, 3000);
    timersRef.current.push(id as unknown as ReturnType<typeof setTimeout>);
    poll(); // fire once immediately rather than waiting the first 3s
  };

  const run = async () => {
    if (!purposeId) return;
    if (!scrapeResult && !uploadFile) return;

    clearTimers();
    setStatus("loading");
    setErrorMsg("");
    setResult(null);
    setStepIndex(0);
    setElapsedSec(0);
    setLogLines([LOG_ROTATION[0]]);
    startedAtRef.current = Date.now();

    timersRef.current.push(setTimeout(() => setStepIndex(1), 500));
    timersRef.current.push(
      setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000) as unknown as ReturnType<typeof setTimeout>
    );
    let logCount = 1;
    timersRef.current.push(
      setInterval(() => {
        setLogLines((lines) => [...lines, LOG_ROTATION[logCount % LOG_ROTATION.length]].slice(-4));
        logCount += 1;
        if (logCount === 2) setStepIndex(2);
      }, 2600) as unknown as ReturnType<typeof setTimeout>
    );

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

      // 503 "not_enabled": the stub is terminal (no model call), render it straight away.
      if (res.status === 503) {
        finishWith(data as AnalyzeResult);
        return;
      }
      // 202 "running": the model call is happening on a background thread — poll for it.
      if (res.status === 202 && data.job_id) {
        pollJob(data.job_id);
        return;
      }
      // Any other non-OK is a real error.
      if (!res.ok) {
        throw new Error(data.error ?? `Backend returned ${res.status} from ${url}`);
      }
      // Fallback: a direct 200 result (older/sync backend) — render it.
      finishWith(data as AnalyzeResult);
    } catch (e) {
      fail(e);
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

  const downloadReport = () => {
    if (!result?.report_markdown) return;
    const blob = new Blob([result.report_markdown], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sentiment-report-${purposeId}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const reset = () => {
    clearTimers();
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  };

  const canRun = !!purposeId && (!!scrapeResult || !!uploadFile);

  const labelClass = "font-[600] text-[10px] tracking-[.2em] uppercase text-[#5b6573]";
  const monoField =
    "bg-[#0A0D12] border border-[#2c3540] rounded-[10px] text-[#E7EBF1] caret-[#B8F24A] font-['JetBrains_Mono']";

  const breadcrumb = useMemo(() => {
    if (status === "loading") return "ziggurat — analyzing…";
    if (status === "done") return "ziggurat — ~/analyze · done";
    if (status === "error") return "ziggurat — error";
    return "ziggurat — ~/analyze";
  }, [status]);

  return (
    <div className="min-h-screen bg-[#05070a] flex items-center justify-center p-6">
      <div className="w-full max-w-[600px]">
        <div
          className="bg-[#0E1218] border border-[#232b36] rounded-[14px] overflow-hidden text-[#E7EBF1]"
          style={{ boxShadow: "0 34px 70px -28px rgba(0,0,0,.7)", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-[#0A0D12] border-b border-[#1a212b]">
            <span className="w-[11px] h-[11px] rounded-full bg-[#2a323d]" />
            <span className="w-[11px] h-[11px] rounded-full bg-[#2a323d]" />
            <span className="w-[11px] h-[11px] rounded-full bg-[#2a323d]" />
            <span className="ml-2 font-['JetBrains_Mono'] text-xs text-[#5b6573]">{breadcrumb}</span>
          </div>

          <div className="p-[30px]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-[10px]">
                <span
                  className={`w-[26px] h-[26px] rounded-[7px] bg-[#B8F24A] flex items-center justify-center text-[#0E1218] font-bold text-sm ${
                    status === "loading" ? "animate-[tl-soft_1.3s_ease-in-out_infinite]" : ""
                  }`}
                >
                  ✦
                </span>
                <span className="font-['JetBrains_Mono'] font-semibold text-xs tracking-[.24em] text-[#aab3c0]">
                  SENTIMENT ANALYZER
                </span>
              </div>
              <div className="flex items-center gap-[14px]">
                {ANALYTICS_URL && (
                  <a
                    href={analyticsLinkFor()}
                    target="_blank"
                    rel="noreferrer"
                    className="font-['JetBrains_Mono'] text-xs text-[#697483] hover:text-[#B8F24A]"
                  >
                    Analytics ↗
                  </a>
                )}
                <button
                  onClick={onBack}
                  className="font-['JetBrains_Mono'] text-xs text-[#697483] hover:text-[#B8F24A]"
                >
                  ← Back to scraper
                </button>
              </div>
            </div>

            {status === "idle" && (
              <>
                <h1 className="m-0 mb-[10px] font-semibold text-[30px] leading-[1.05] tracking-[-0.02em]">
                  Read the room
                </h1>
                <p className="m-0 mb-[26px] font-['JetBrains_Mono'] text-[13px] text-[#7b8698]">
                  {scrapeResult
                    ? `Analysing ${scrapeResult.video?.title || scrapeResult.video?.video_id || "the scraped video"}.`
                    : "Upload a comments CSV or native JSON export → themed audience direction."}
                </p>

                {!analyzerEnabled && (
                  <div className="mb-6 border border-[#2c3540] rounded-[10px] p-3">
                    <p className="m-0 font-['JetBrains_Mono'] text-xs text-[#8a94a4]">
                      ⓘ No <span className="text-[#aab3c0]">ANTHROPIC_API_KEY</span> configured — the
                      pipeline still runs end-to-end and shows the assembled prompt + diagnostics
                      instead of a report.
                    </p>
                  </div>
                )}
                {optionsError && (
                  <div className="mb-6 bg-[#150a0b] border border-[#3a1f22] rounded-[10px] p-3">
                    <p className="m-0 font-['JetBrains_Mono'] text-xs text-[#ff9d92]">{optionsError}</p>
                  </div>
                )}

                {!scrapeResult ? (
                  <div className="mb-6">
                    <div className={`${labelClass} mb-2`}>
                      Comments file <span className="text-[#3f4854]">· §3.1 CSV or native JSON</span>
                    </div>
                    <label className="h-[56px] border border-dashed border-[#2c3540] rounded-[10px] bg-[#0A0D12] flex items-center justify-center gap-[9px] cursor-pointer">
                      <span className="text-[#8a94a4] text-sm">↑</span>
                      <span className="font-medium text-sm text-[#8a94a4]">
                        {uploadFile ? uploadFile.name : "Choose a file"}
                      </span>
                      <input
                        type="file"
                        accept=".csv,.json"
                        className="hidden"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mb-6 border border-[#1c232d] bg-[#0A0D12] rounded-[10px] p-3">
                    <p className="m-0 font-['JetBrains_Mono'] text-xs text-[#7b8698] truncate">
                      Source: {scrapeResult.video?.title || scrapeResult.video?.video_id}
                    </p>
                  </div>
                )}

                <div className="mb-6">
                  <div className={`${labelClass} mb-2`}>Purpose</div>
                  <div className="relative">
                    <select
                      value={purposeId}
                      onChange={(e) => setPurposeId(e.target.value)}
                      className={`w-full h-[48px] px-[14px] appearance-none font-['Space_Grotesk'] text-sm ${monoField}`}
                    >
                      {purposes.map((p) => (
                        <option key={p.purpose_id} value={p.purpose_id}>
                          {p.display_name}
                          {p.status === "stub" ? " (preview — shape only)" : ""}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-[#5b6573] text-xs">
                      ▾
                    </span>
                  </div>
                  {selectedPurpose && (
                    <p className="mt-2 font-['JetBrains_Mono'] text-[11px] text-[#697483]">
                      {selectedPurpose.one_line}
                    </p>
                  )}
                  {selectedPurpose?.status === "stub" && (
                    <p className="mt-1 font-['JetBrains_Mono'] text-[11px] text-[#ff9d92]">
                      This purpose is a preview — output won't be mature yet.
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <div className={`${labelClass} mb-2`}>
                    Client <span className="text-[#3f4854]">· optional</span>
                  </div>
                  <div className="relative">
                    <select
                      value={clientSlug}
                      onChange={(e) => setClientSlug(e.target.value)}
                      className={`w-full h-[48px] px-[14px] appearance-none font-['Space_Grotesk'] text-sm ${monoField}`}
                    >
                      <option value="">Run client-agnostic</option>
                      {clients.map((c) => (
                        <option key={c.client_slug} value={c.client_slug}>
                          {c.client_name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-[#5b6573] text-xs">
                      ▾
                    </span>
                  </div>
                </div>

                <div className="mb-6">
                  <div className={`${labelClass} mb-2`}>Scope</div>
                  <div className="flex bg-[#0A0D12] border border-[#2c3540] rounded-[10px] p-[5px] gap-[5px]">
                    {(["per-video", "synthesis"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setScope(s)}
                        className={`flex-1 h-[38px] rounded-[7px] font-['JetBrains_Mono'] text-sm font-medium ${
                          scope === s ? "bg-[#B8F24A] text-[#0E1218]" : "text-[#8a94a4]"
                        }`}
                      >
                        {s === "per-video" ? "Per video" : "Synthesis"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <div className={`${labelClass} mb-2`}>
                    Transcript{" "}
                    <span className="text-[#3f4854]">
                      · optional, but populates §8 for course-development
                    </span>
                  </div>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={3}
                    placeholder="Paste the video transcript…"
                    className={`w-full p-[14px] outline-none text-sm resize-none ${monoField}`}
                  />
                </div>

                <div className="mb-6">
                  <div className={`${labelClass} mb-2`}>
                    Team notes <span className="text-[#3f4854]">· optional</span>
                  </div>
                  <textarea
                    value={teamNotes}
                    onChange={(e) => setTeamNotes(e.target.value)}
                    rows={2}
                    placeholder="Any context for this run…"
                    className={`w-full p-[14px] outline-none text-sm resize-none ${monoField}`}
                  />
                </div>

                <button
                  onClick={run}
                  disabled={!canRun}
                  className="w-full h-[52px] rounded-[11px] bg-[#B8F24A] text-[#0E1218] font-bold text-[15px] disabled:bg-[#141b23] disabled:text-[#4f5a6a] disabled:cursor-not-allowed"
                >
                  Run analysis
                </button>
                {!canRun && (
                  <p className="mt-2 text-center font-['JetBrains_Mono'] text-xs text-[#4f5a6a]">
                    upload a file to enable
                  </p>
                )}
              </>
            )}

            {status === "loading" && (
              <>
                <div className="font-['JetBrains_Mono'] text-[13px] text-[#7b8698] mb-[6px]">
                  running analysis…
                </div>
                <div className="flex items-end gap-2 mb-6">
                  <span className="font-semibold text-[52px] leading-[0.9] tracking-[-0.02em] text-white">
                    {elapsedSec}
                  </span>
                  <span className="font-['JetBrains_Mono'] text-sm text-[#8a94a4] pb-2">sec elapsed</span>
                  <span className="w-[3px] h-[34px] bg-[#B8F24A] mb-[10px] ml-[2px] animate-[tl-blink_1s_step-end_infinite]" />
                </div>

                <div className="relative h-2 rounded-full bg-[#1a212b] overflow-hidden mb-[10px]">
                  <div className="absolute inset-y-0 w-1/4 rounded-full bg-[#B8F24A] animate-[tl-loadbar_1.6s_linear_infinite]" />
                </div>
                <div className="flex justify-between font-['JetBrains_Mono'] text-[11px] text-[#697483] mb-7">
                  <span>working…</span>
                  <span>model calls can take a minute</span>
                </div>

                <div className="flex flex-col gap-[14px] mb-7">
                  {STEP_LABELS.map((label, i) => (
                    <div key={label} className="flex items-center gap-3">
                      {i < stepIndex ? (
                        <span className="w-[18px] h-[18px] rounded-full bg-[#B8F24A]/[0.16] text-[#B8F24A] flex items-center justify-center font-bold text-[11px]">
                          ✓
                        </span>
                      ) : i === stepIndex ? (
                        <span className="w-[18px] h-[18px] rounded-full border-2 border-[#283039] border-t-[#B8F24A] animate-[spin_0.8s_linear_infinite]" />
                      ) : (
                        <span className="w-[18px] h-[18px] rounded-full border-[1.5px] border-[#283039]" />
                      )}
                      <span
                        className={`font-['JetBrains_Mono'] text-[13px] ${
                          i === stepIndex ? "text-[#E7EBF1]" : i < stepIndex ? "text-[#9aa4b3]" : "text-[#5b6573]"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-[#080b0f] border border-[#151b23] rounded-[10px] px-4 py-[14px] font-['JetBrains_Mono'] text-xs leading-[1.7]">
                  {logLines.map((line, i) => (
                    <div key={i} className={i === logLines.length - 1 ? "text-[#B8F24A]" : "text-[#697483]"}>
                      {line}
                      {i === logLines.length - 1 && (
                        <span className="animate-[tl-blink_1s_step-end_infinite]">▋</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-[40px] h-[40px] shrink-0 rounded-[11px] bg-[#ff6b5e]/[0.12] text-[#ff6b5e] flex items-center justify-center font-bold text-xl">
                    !
                  </span>
                  <span className="inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full bg-[#ff6b5e]/[0.1] text-[#ff6b5e] font-['JetBrains_Mono'] font-bold text-[11px] tracking-[.1em]">
                    ANALYSIS FAILED
                  </span>
                </div>
                <h1 className="m-0 mb-[10px] font-semibold text-[28px] leading-[1.1] tracking-[-0.02em]">
                  Couldn't analyze that
                </h1>
                <div className="bg-[#150a0b] border border-[#3a1f22] rounded-[10px] p-4 mb-6">
                  <p className="font-['JetBrains_Mono'] text-sm text-[#ff9d92] m-0">{errorMsg}</p>
                </div>
                <button
                  onClick={reset}
                  className="w-full h-[50px] rounded-[10px] bg-[#B8F24A] text-[#0E1218] font-bold text-sm"
                >
                  Try again
                </button>
              </>
            )}

            {status === "done" && result?.status === "not_enabled" && (
              <>
                <div className="flex items-center gap-[7px] mb-6">
                  <span className="inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full bg-[#B8F24A]/[0.12] text-[#B8F24A] font-['JetBrains_Mono'] font-bold text-[11px] tracking-[.1em]">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#B8F24A]" />
                    PIPELINE RAN
                  </span>
                </div>
                <p className="font-['JetBrains_Mono'] text-[13px] text-[#8a94a4] mb-6">
                  Analyzer not yet enabled — {result.reason}. Here's what would have been sent to the model.
                </p>

                <div className="flex gap-[10px] mb-[26px]">
                  {[
                    ["COMMENT ROWS", String(result.ingest_diagnostics?.rows_total ?? "—")],
                    ["CLIENT SLUG", String(result.client_slug_resolved ?? "standalone")],
                    ["CLIENT CONTEXT", result.client_context_applied ? "Yes" : "No"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex-1 bg-[#0A0D12] border border-[#1c232d] rounded-[10px] p-[14px]">
                      <div className="font-semibold text-[20px] text-white truncate">{value}</div>
                      <div className="font-['JetBrains_Mono'] text-[10px] tracking-[.12em] text-[#697483] mt-[6px]">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={downloadPrompt}
                  className="w-full h-[52px] rounded-[11px] bg-[#B8F24A] text-[#0E1218] font-bold text-[15px] mb-3"
                >
                  ↓ Download assembled prompt
                </button>
                <button
                  onClick={downloadDiagnostics}
                  className="w-full h-[44px] border border-[#2c3540] rounded-[10px] text-[#aab3c0] font-['JetBrains_Mono'] font-semibold text-[13px] mb-4"
                >
                  Download diagnostics + provenance
                </button>

                <details>
                  <summary className="cursor-pointer font-['JetBrains_Mono'] text-xs text-[#697483]">
                    Preview assembled prompt
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg bg-[#080b0f] border border-[#151b23] text-[#9aa4b3] overflow-auto max-h-64 whitespace-pre-wrap font-['JetBrains_Mono'] text-xs">
                    {result.assembled_prompt}
                  </pre>
                </details>

                <button
                  onClick={reset}
                  className="w-full h-[44px] mt-4 border border-[#2c3540] rounded-[10px] text-[#aab3c0] font-['JetBrains_Mono'] font-semibold text-[13px]"
                >
                  Analyze another
                </button>
              </>
            )}

            {status === "done" && result?.status === "ok" && (() => {
              const summary = result.summary_json;
              const purposeName =
                purposes.find((p) => p.purpose_id === result.purpose)?.display_name || result.purpose;
              const scopeName = scope === "per-video" ? "Per video" : "Synthesis";
              const clientLabel = result.client_context_applied
                ? result.client_slug_resolved
                : "client-agnostic";
              const rowsTotal = result.ingest_diagnostics?.rows_total;
              const themes = (summary?.themes as Theme[] | undefined)?.slice(0, 4) ?? [];
              const questions = (summary?.question_clusters as QuestionCluster[] | undefined)?.slice(0, 3) ?? [];
              const direction = summary ? directionBullets(summary) : [];
              const directionLabel = DIRECTION_LABEL[result.purpose as string] || "DIRECTION";

              const copyDirection = async () => {
                if (!direction.length) return;
                try {
                  await navigator.clipboard.writeText(direction.map((d) => `- ${d}`).join("\n"));
                  setDirectionCopied(true);
                  setTimeout(() => setDirectionCopied(false), 1600);
                } catch {
                  // Clipboard API unavailable — nothing else to fall back to here.
                }
              };

              return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full bg-[#B8F24A]/[0.12] text-[#B8F24A] font-['JetBrains_Mono'] font-bold text-[11px] tracking-[.1em]">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#B8F24A]" />
                    ANALYSIS COMPLETE
                  </span>
                  {typeof rowsTotal === "number" && (
                    <span className="font-['JetBrains_Mono'] text-xs text-[#697483]">
                      {rowsTotal.toLocaleString()} comments
                    </span>
                  )}
                </div>
                <p className="font-['JetBrains_Mono'] text-[13px] text-[#8a94a4] mb-4">
                  {[purposeName, scopeName, clientLabel].filter(Boolean).join(" · ")}
                </p>

                {result.truncated && (
                  <div className="border border-[#3a1f22] bg-[#150a0b] rounded-[10px] p-3 mb-4">
                    <p className="m-0 font-['JetBrains_Mono'] text-xs text-[#ff9d92]">
                      Report may still be truncated after {result.continuations} continuation
                      {result.continuations === 1 ? "" : "s"} — check the end of the report below.
                    </p>
                  </div>
                )}

                {result.summary_json && result.validation && (
                  <div
                    className={`rounded-[10px] p-3 mb-4 border ${
                      result.validation.valid ? "border-[#1c3324] bg-[#0d1712]" : "border-[#3a1f22] bg-[#150a0b]"
                    }`}
                  >
                    <p
                      className={`m-0 font-['JetBrains_Mono'] text-xs ${
                        result.validation.valid ? "text-[#56d993]" : "text-[#ff9d92]"
                      }`}
                    >
                      {result.validation.valid
                        ? `summary.json is valid (contract §4)${
                            result.validation.warnings.length
                              ? ` — ${result.validation.warnings.length} warning(s)`
                              : ""
                          }.`
                        : `summary.json failed validation: ${result.validation.errors.join("; ")}`}
                    </p>
                  </div>
                )}

                {!result.summary_json && (
                  <div className="border border-[#3a1f22] bg-[#150a0b] rounded-[10px] p-3 mb-4">
                    <p className="m-0 font-['JetBrains_Mono'] text-xs text-[#ff9d92]">
                      No summary.json was found — the report below is likely all that was returned
                      before the token budget ran out.
                    </p>
                  </div>
                )}

                {themes.length > 0 && (
                  <div className="mb-7">
                    <div className={`${labelClass} mb-[14px]`}>Top themes</div>
                    <div className="flex flex-col gap-[14px]">
                      {themes.map((t) => {
                        const tier = (t.prominence || "").toLowerCase();
                        return (
                          <div key={t.name}>
                            <div className="flex justify-between mb-[6px]">
                              <span className="text-[13px] text-[#d7dce3]">{t.name}</span>
                              <span className="font-['JetBrains_Mono'] text-xs text-[#697483] uppercase">
                                {tier || "—"}
                              </span>
                            </div>
                            <div className="h-[6px] rounded-full bg-[#1a212b] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${PROMINENCE_WIDTH[tier] ?? 50}%`,
                                  background: PROMINENCE_COLOR[tier] ?? "#3f5a2b",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {questions.length > 0 && (
                  <div className="mb-7">
                    <div className={`${labelClass} mb-[14px]`}>Questions the audience is asking</div>
                    <div className="flex flex-col gap-[10px]">
                      {questions.map((q, i) => (
                        <div key={i} className="flex gap-[10px] items-start">
                          <span className="font-['JetBrains_Mono'] font-semibold text-[13px] text-[#B8F24A]">?</span>
                          <span className="text-[13px] leading-[1.4] text-[#c3cad4]">{q.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {direction.length > 0 && (
                  <div className="bg-[#0A0D12] border border-[#1c232d] rounded-[12px] p-[18px] mb-6">
                    <div className={`${labelClass} mb-[14px] text-[#B8F24A]`}>→ {directionLabel}</div>
                    <div className="flex flex-col gap-[11px] text-[13px] leading-[1.5] text-[#c3cad4]">
                      {direction.map((d, i) => (
                        <div key={i} className="flex gap-[10px]">
                          <span className="text-[#56d993]">›</span> {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <details className="mb-4">
                  <summary className="cursor-pointer font-['JetBrains_Mono'] text-xs text-[#697483]">
                    Full report
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg bg-[#080b0f] border border-[#151b23] overflow-auto max-h-96 whitespace-pre-wrap font-['JetBrains_Mono'] text-xs text-[#c3cad4]">
                    {result.report_markdown}
                  </pre>
                </details>

                <button
                  onClick={downloadReport}
                  className="w-full h-[52px] rounded-[11px] bg-[#B8F24A] text-[#0E1218] font-bold text-[15px] mb-3"
                >
                  ↓ Download report
                </button>
                <div className="flex gap-[10px]">
                  {direction.length > 0 && (
                    <button
                      onClick={copyDirection}
                      className="flex-1 h-[44px] border border-[#2c3540] rounded-[10px] text-[#aab3c0] font-['JetBrains_Mono'] font-semibold text-[13px]"
                    >
                      {directionCopied ? "Copied ✓" : "Copy direction"}
                    </button>
                  )}
                  <button
                    onClick={reset}
                    className="flex-1 h-[44px] border border-[#2c3540] rounded-[10px] text-[#aab3c0] font-['JetBrains_Mono'] font-semibold text-[13px]"
                  >
                    Analyze another
                  </button>
                </div>
                {ANALYTICS_URL && (
                  <a
                    href={analyticsLinkFor(result.client_slug_resolved)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full block text-center mt-3 font-['JetBrains_Mono'] text-xs text-[#697483] hover:text-[#B8F24A]"
                  >
                    View {result.client_slug_resolved || "channel"} performance analytics →
                  </a>
                )}
              </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
