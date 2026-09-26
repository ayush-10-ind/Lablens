/**
 * Domain-neutral pipeline types for LabLens.
 *
 * Design principles:
 * - SceneDescription<TPayload> is generic: the core type never changes when a new domain is added.
 * - Domain payloads are additive aliases/types declared outside the core interface.
 * - No Three.js references. No React references. No camera frame data.
 * - Circuit types (CircuitModel, RuleEngineOutput) are imported unchanged from src/circuit/types.ts.
 */

import type {
  CircuitModel,
  DetectedComponent,
  RuleEngineOutput,
} from '../circuit/types';
import type { SceneGateStatus } from '../circuit/sceneGate';

// ─── DescriptionSource ───────────────────────────────────────────────────────

/**
 * Provenance and reliability metadata for a SceneDescription.
 *
 * Deliberately separates detector confidence from semantic understanding confidence:
 * detectorMeanConfidence represents the mean confidence of the underlying detector
 * labels. It must not be interpreted as semantic understanding confidence.
 */
export interface DescriptionSource {
  /**
   * How the description was produced.
   * 'detector' — on-device ML model (current circuit pipeline).
   * 'vlm'      — future vision-language model response.
   * 'mock'     — deterministic test/dev fixture.
   */
  kind: 'detector' | 'vlm' | 'mock';

  /**
   * For 'detector' sources: the mean confidence of the stable detector labels
   * that contributed to the description. Absent when there are no labels or
   * when source kind is not 'detector'.
   *
   * detectorMeanConfidence represents the mean confidence of the underlying
   * detector labels. It must not be interpreted as semantic understanding
   * confidence.
   */
  detectorMeanConfidence?: number;
}

// ─── SceneDescription<TPayload> ──────────────────────────────────────────────

/**
 * A domain-neutral description of what the input source understands.
 *
 * @template TPayload  Domain-specific structured data. The core interface is
 *                     completely ignorant of the payload shape; each domain
 *                     defines its own payload type and a named alias below.
 *
 * Invariants:
 * - Never contains raw camera frames (ImageData, ImageBitmap, ArrayBuffer of pixels).
 * - Never contains Three.js objects.
 * - Adding a new domain does NOT require editing this interface.
 */
export interface SceneDescription<TPayload = unknown> {
  /** Unique slug for the educational domain: 'circuit', 'optics', 'anatomy', … */
  domain: string;

  /** Structured domain payload. Shape is defined per domain via the generic parameter. */
  payload: TPayload;

  /** Provenance and reliability of this description. */
  source: DescriptionSource;

  /** ISO timestamp when this description was produced. */
  producedAt: string;
}

// ─── Domain payload types ─────────────────────────────────────────────────────

/**
 * Circuit domain payload.
 * Wraps the existing CircuitModel and RuleEngineOutput from src/circuit/types.ts.
 * Neither of those types is modified.
 */
export interface CircuitScenePayload {
  kind: 'circuit';
  /** The constructed circuit graph; null when SceneGate is idle. */
  model: CircuitModel | null;
  /** Rule engine results; null when SceneGate is idle. */
  ruleOutput: RuleEngineOutput | null;
}

/** Typed alias for the circuit domain description. */
export type CircuitSceneDescription = SceneDescription<CircuitScenePayload>;

/**
 * Emitted when no provider can commit to a domain.
 * Not the same as an idle circuit — this is a pipeline-level unknown.
 */
export interface UnknownScenePayload {
  kind: 'unknown';
  reason: string;
}
export type UnknownSceneDescription = SceneDescription<UnknownScenePayload>;

/**
 * Placeholder for a future domain.
 * No changes to SceneDescription<T> are needed when this is implemented.
 */
export interface AnatomyScenePayload {
  kind: 'anatomy';
  structures: string[];
}

// ─── CircuitPipelineSnapshot ──────────────────────────────────────────────────

/**
 * A plain-data snapshot of one processCircuitPipeline() invocation.
 *
 * This is the input type for CircuitUnderstandingProvider.
 * Shape intentionally matches CircuitPipelineResult from src/circuit/useCircuitPipeline.ts
 * so no adapter transformation is needed at the callsite — but it is declared here
 * to avoid coupling the pipeline module to the circuit module's hook file.
 */
export interface CircuitPipelineSnapshot {
  gateStatus: SceneGateStatus;
  circuitModel: CircuitModel | null;
  ruleOutput: RuleEngineOutput | null;
  /** The stable detected components exposed by the gate (may be [] when idle). */
  labels: DetectedComponent[];
  primaryHint?: string;
}

// ─── VisualizationPlan ────────────────────────────────────────────────────────

export type VisualizationStrategy =
  | 'procedural' // Pure Three.js geometry — implemented
  | 'curated'    // Pre-approved GLB asset — typed stub
  | 'generated'; // Future LLM/mesh pipeline — typed stub

/**
 * A plan tells a renderer what to show and how.
 * Every concrete plan carries `domain` + `strategy` so multiple renderers
 * with the same strategy (e.g. procedural/circuit vs procedural/optics)
 * can coexist and be selected via canRender().
 */
export type VisualizationPlan =
  | ProceduralPlan
  | CuratedPlan
  | GeneratedPlan
  | NullPlan;

export interface ProceduralPlan {
  strategy: 'procedural';
  /** Identifies the exact scene within the strategy — e.g. 'led-circuit', 'optics-bench'. */
  sceneId: string;
  /** Domain slug — used by canRender() to disambiguate renderers. */
  domain: string;
  /** Which step to open at (1-indexed). Defaults to 1. */
  initialStep?: number;
  /** Whether the circuit/experiment is active (e.g. loop complete, switch closed). */
  circuitActive?: boolean;
}

export interface CuratedPlan {
  strategy: 'curated';
  /** Path under public/assets/ to the pre-approved GLB. */
  assetPath: string;
  domain: string;
}

export interface GeneratedPlan {
  strategy: 'generated';
  /** Educational prompt sent to the generation endpoint. */
  prompt: string;
  domain: string;
}

export interface NullPlan {
  strategy: 'none';
  reason: string;
}
