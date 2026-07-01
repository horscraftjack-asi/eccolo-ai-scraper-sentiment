import { useState } from "react";
import CommentScraper from "./CommentScraper";
import Analyzer from "./Analyzer";
import type { ScrapeResult } from "./shared";

type View = "scraper" | "analyzer";

export default function App() {
  const [view, setView] = useState<View>("scraper");
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);

  if (view === "analyzer") {
    return (
      <Analyzer
        scrapeResult={scrapeResult}
        onBack={() => setView("scraper")}
      />
    );
  }

  return (
    <CommentScraper
      onSendToAnalyzer={(result) => {
        setScrapeResult(result);
        setView("analyzer");
      }}
      onGoToAnalyzerStandalone={() => {
        setScrapeResult(null);
        setView("analyzer");
      }}
    />
  );
}
