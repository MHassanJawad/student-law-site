"use client";

import { useEffect, useState } from "react";

type Coverage = { sources: { kind: string; count: number; lastCheckedAt: string | null }[] };

/** Show the measured published pilot count without a hard-coded corpus claim. */
export function CoverageSummary() {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/coverage", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Coverage unavailable");
        return response.json() as Promise<Coverage>;
      })
      .then(setCoverage)
      .catch((error: unknown) => { if (!(error instanceof Error && error.name === "AbortError")) setUnavailable(true); });
    return () => controller.abort();
  }, []);
  if (unavailable) return <p className="coverage-note">Current coverage is temporarily unavailable.</p>;
  if (!coverage) return <p className="coverage-note" aria-live="polite">Checking current pilot coverage...</p>;
  const total = coverage.sources.filter((source) => source.kind === "judgment")
    .reduce((sum, source) => sum + source.count, 0);
  const laws = coverage.sources.filter((source) => source.kind === "legislation")
    .reduce((sum, source) => sum + source.count, 0);
  return <p className="coverage-note" aria-live="polite">{total} published judgment{total === 1 ? "" : "s"} and {laws} legislation record{laws === 1 ? "" : "s"} in this local pilot. This is not a complete archive.</p>;
}
