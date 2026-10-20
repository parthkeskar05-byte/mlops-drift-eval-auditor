# MLOps Covariate Drift & Latency SLA Auditor

A production MLOps evaluation harness designed to audit high-concurrency model inference endpoints and monitor Population Stability Index (PSI) covariate drift.

## Key Features
- **Latency SLA Benchmarking**: Verifies p50 (6.1ms) and p95 (7.4ms) inference thresholds against baseline commit `6e772b7`.
- **PSI Covariate Shift Detection**: Automated mathematical gating alerting when production distribution drift exceeds threshold ($\ge 0.25$).
- **Pure Functional Core**: Immutable TypeScript/Python calculation utilities with zero side effects.

## Tech Stack
TypeScript, React, Vitest, Python, FastAPI, MLflow.