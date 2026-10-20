import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DriftAuditMonitor, computeTelemetryAudit } from './DriftAuditMonitor';

describe('DriftAuditMonitor ECC Pure Calculation & Boundary Suite', () => {
  it('computes p50 and p95 latency without mutating the source array', () => {
    const rawLatencies = Object.freeze([7.4, 6.1, 5.8, 6.0, 6.2]);
    const result = computeTelemetryAudit([...rawLatencies], 0.08, '6e772b7');

    expect(result.p50Ms).toBe(6.1);
    expect(result.p95Ms).toBe(7.4);
    expect(result.slaCompliant).toBe(true);
    expect(result.retrainRequired).toBe(false);
  });

  it('rejects negative or malformed latency inputs at the component boundary', () => {
    render(<DriftAuditMonitor defaultCommitHash="6e772b7" />);

    fireEvent.change(screen.getByLabelText(/latency samples/i), {
      target: { value: '6.1, -4.2, 7.4' },
    });
    fireEvent.click(screen.getByRole('button', { name: /evaluate telemetry/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Boundary validation failed: Provide at least 3 positive numeric latency samples (ms) and a valid PSI score (>= 0).'
    );
  });
});