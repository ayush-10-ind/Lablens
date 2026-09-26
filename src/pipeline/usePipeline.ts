/**
 * React bridge hook: usePipeline.
 *
 * The ONLY React-touching file in src/pipeline/.
 *
 * Bridges the output of useCircuitPipeline() (a CircuitPipelineResult, which
 * satisfies CircuitPipelineSnapshot) into the domain-neutral pipeline.
 *
 * Ownership model:
 * - useCircuitPipeline() owns the SceneGate lifecycle — untouched here.
 * - This hook only consumes the already-produced snapshot (plain data).
 * - CircuitUnderstandingProvider is a plain class — no hook is called inside it.
 *
 * This hook is standalone for this slice: it is not yet wired into CameraPreview.
 * Wiring it into the UI is the next slice.
 */

import { useMemo } from 'react';
import type { CircuitPipelineResult } from '../circuit/useCircuitPipeline';
import type { CircuitSceneDescription, VisualizationPlan } from './types';
import { CircuitUnderstandingProvider } from './circuitUnderstandingProvider';
import { CircuitScenePlanner } from './circuitScenePlanner';
import { runPipeline } from './pipelineOrchestrator';

/**
 * Converts a CircuitPipelineResult snapshot into a domain-neutral description
 * and visualization plan.
 *
 * @param snapshot  The current output of useCircuitPipeline(). The caller
 *                  continues to own the SceneGate lifecycle.
 *
 * @returns { description, plan } — both are plain data with stable references
 *          (memoized until snapshot identity changes).
 */
export function usePipeline(snapshot: CircuitPipelineResult): {
  description: CircuitSceneDescription;
  plan: VisualizationPlan;
} {
  // Providers are stable class instances — created once per hook mount.
  const provider = useMemo(() => new CircuitUnderstandingProvider(), []);
  const planner = useMemo(() => new CircuitScenePlanner(), []);

  // runPipeline is a pure function; only re-runs when snapshot identity changes.
  return useMemo(
    () => runPipeline(snapshot, { understanding: provider, planner }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, provider, planner]
  );
}
