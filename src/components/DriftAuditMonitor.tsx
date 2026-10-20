import React, { useState, useCallback, FormEvent } from 'react';

export interface TelemetryAuditSnapshot {
  readonly id: string;
  readonly commitHash: string;
  readonly sampleCount: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly psiScore: number;
  readonly slaCompliant: boolean;
  readonly retrainRequired: boolean;
}

interface DriftAuditMonitorProps {
  readonly defaultCommitHash?: string;
  readonly slaThresholdMs?: number;
}

const COMMIT_HASH_REGEX = /^[a-f0-9]{7,40}$/i;

export function computeTelemetryAudit(
  latenciesMs: ReadonlyArray<number>,
  psiScore: number,
  commitHash: string,
  slaThresholdMs = 8.0
): TelemetryAuditSnapshot {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const n = sorted.length;
  const p50Index = Math.floor(0.5 * (n - 1));
  const p95Index = Math.floor(0.95 * (n - 1));

  const p50Ms = Number(sorted[p50Index].toFixed(2));
  const p95Ms = Number(sorted[p95Index].toFixed(2));

  return Object.freeze({
    id: `audit_${Date.now()}`,
    commitHash,
    sampleCount: n,
    p50Ms,
    p95Ms,
    psiScore: Number(psiScore.toFixed(4)),
    slaCompliant: p95Ms <= slaThresholdMs,
    retrainRequired: psiScore >= 0.25,
  });
}

export const DriftAuditMonitor: React.FC<DriftAuditMonitorProps> = ({
  defaultCommitHash = '6e772b7',
  slaThresholdMs = 8.0,
}) => {
  const [latencyText, setLatencyText] = useState<string>('6.1, 6.0, 5.9, 6.2, 7.4');
  const [psiInput, setPsiInput] = useState<string>('0.08');
  const [commitInput, setCommitInput] = useState<string>(defaultCommitHash);
  const [snapshots, setSnapshots] = useState<ReadonlyArray<TelemetryAuditSnapshot>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAudit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmedCommit = commitInput.trim();

      if (!COMMIT_HASH_REGEX.test(trimmedCommit)) {
        setErrorMsg('Invalid Git commit hash. Provide a 7 to 40 character hexadecimal SHA.');
        return;
      }

      const parsedLatencies = latencyText
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n) && Number.isFinite(n));

      const parsedPsi = Number(psiInput.trim());

      if (
        parsedLatencies.length < 3 ||
        parsedLatencies.some((n) => n <= 0 || n > 60000) ||
        Number.isNaN(parsedPsi) ||
        parsedPsi < 0
      ) {
        setErrorMsg(
          'Boundary validation failed: Provide at least 3 positive numeric latency samples (ms) and a valid PSI score (>= 0).'
        );
        return;
      }

      setErrorMsg(null);

      try {
        const snapshot = computeTelemetryAudit(
          parsedLatencies,
          parsedPsi,
          trimmedCommit,
          slaThresholdMs
        );
        setSnapshots((prev) => [snapshot, ...prev]);
      } catch (err) {
        console.error('[MLOPS_AUDIT_ERROR]:', err);
        setErrorMsg('Unable to compute telemetry audit. Verify numeric input formatting.');
      }
    },
    [latencyText, psiInput, commitInput, slaThresholdMs]
  );

  return (
    <section
      aria-labelledby="mlops-audit-heading"
      className="max-w-3xl mx-auto p-6 bg-slate-950 text-slate-100 rounded-lg border border-slate-800"
    >
      <header className="mb-6">
        <h2 id="mlops-audit-heading" className="text-xl font-semibold tracking-tight">
          MLOps Covariate Drift & Latency SLA Auditor
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Reproducible percentile verification and Population Stability Index (PSI) gating.
        </p>
      </header>

      <form onSubmit={handleAudit} className="grid gap-4 mb-6" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="commit-sha" className="block text-xs text-slate-400 mb-1">
              Pinned Git Commit
            </label>
            <input
              id="commit-sha"
              type="text"
              value={commitInput}
              onChange={(e) => setCommitInput(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm font-mono"
            />
          </div>
          <div>
            <label htmlFor="psi-score" className="block text-xs text-slate-400 mb-1">
              PSI Drift Score
            </label>
            <input
              id="psi-score"
              type="number"
              step="0.01"
              value={psiInput}
              onChange={(e) => setPsiInput(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm font-mono"
            />
          </div>
          <div>
            <label htmlFor="latency-samples" className="block text-xs text-slate-400 mb-1">
              Latency Samples (ms, CSV)
            </label>
            <input
              id="latency-samples"
              type="text"
              value={latencyText}
              onChange={(e) => setLatencyText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition justify-self-start"
        >
          Evaluate Telemetry
        </button>
      </form>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 mb-6 bg-red-950/60 border border-red-700 text-red-200 text-sm rounded"
        >
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        {snapshots.map((snap) => (
          <article
            key={snap.id}
            className="p-4 bg-slate-900/80 rounded border border-slate-800 flex flex-col gap-2 text-xs font-mono"
          >
            <div className="flex justify-between items-center">
              <span className="text-indigo-400">Commit: {snap.commitHash}</span>
              <span
                className={`px-2 py-0.5 rounded ${
                  snap.slaCompliant
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-red-950 text-red-300 border border-red-800'
                }`}
              >
                p50: {snap.p50Ms}ms | p95: {snap.p95Ms}ms
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-800">
              <span>PSI: {snap.psiScore}</span>
              <span>
                {snap.retrainRequired
                  ? 'DRIFT DETECTED: Retrain Triggered'
                  : 'STABLE: Within Baseline Distribution'}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};