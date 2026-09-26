/**
 * Circuit domain understanding provider.
 *
 * Accepts a CircuitPipelineSnapshot (plain data output of processCircuitPipeline())
 * and wraps it into a typed CircuitSceneDescription.
 *
 * Architectural constraints:
 * - This is a plain class — NOT a React hook. No hook is called here.
 * - processCircuitPipeline() and useCircuitPipeline() are NOT imported or called.
 *   The snapshot is provided by the caller (e.g. usePipeline bridge hook).
 * - SceneGate, CircuitBuilder, and RuleEngine are NOT touched.
 * - CircuitModel and RuleEngineOutput are used as-is from src/circuit/types.ts.
 *
 * Confidence note:
 * detectorMeanConfidence represents the mean confidence of the underlying detector
 * labels. It must not be interpreted as semantic understanding confidence.
 * It is derived from snapshot.labels[].confidence — real detector scores, not
 * fabricated heuristics.
 */

import type { UnderstandingProvider } from './providers';
import type {
  CircuitScenePayload,
  CircuitSceneDescription,
  CircuitPipelineSnapshot,
} from './types';

export class CircuitUnderstandingProvider
  implements UnderstandingProvider<CircuitPipelineSnapshot, CircuitScenePayload>
{
  readonly domain = 'circuit';

  describe(snapshot: CircuitPipelineSnapshot): CircuitSceneDescription {
    // Compute mean detector confidence from stable labels when available.
    // detectorMeanConfidence represents the mean confidence of the underlying
    // detector labels. It must not be interpreted as semantic understanding confidence.
    const labels = snapshot.labels;
    const detectorMeanConfidence =
      labels.length > 0
        ? labels.reduce((sum, l) => sum + l.confidence, 0) / labels.length
        : undefined;

    return {
      domain: 'circuit',
      payload: {
        kind: 'circuit',
        model: snapshot.circuitModel,
        ruleOutput: snapshot.ruleOutput,
      },
      source: {
        kind: 'detector',
        detectorMeanConfidence,
      },
      producedAt: new Date().toISOString(),
    };
  }
}
