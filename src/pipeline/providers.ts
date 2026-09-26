/**
 * Provider interfaces for the domain-neutral LabLens pipeline.
 *
 * Three narrow interfaces — each independently replaceable:
 *   UnderstandingProvider<TInput, TPayload>  — raw input → SceneDescription
 *   ScenePlanner<TPayload>                   — SceneDescription → VisualizationPlan
 *   VisualizationRenderer                    — VisualizationPlan → rendered scene
 *
 * None of these reference Three.js, React, or circuit-specific types.
 */

import type {
  SceneDescription,
  VisualizationPlan,
  CircuitScenePayload,
  CircuitPipelineSnapshot,
} from './types';

// ─── UnderstandingProvider ────────────────────────────────────────────────────

/**
 * Converts domain-specific raw input into a typed SceneDescription.
 *
 * @template TInput    The raw input the provider accepts.
 *                     e.g. CircuitPipelineSnapshot for the circuit domain,
 *                          ImageBitmap for a future VLM-based domain.
 * @template TPayload  The structured domain payload it produces.
 *                     e.g. CircuitScenePayload, AnatomyScenePayload.
 *
 * The provider is a plain class/service — never a React hook.
 */
export interface UnderstandingProvider<TInput = unknown, TPayload = unknown> {
  readonly domain: string;
  describe(input: TInput): SceneDescription<TPayload>;
}

/**
 * Typed alias for the circuit-domain understanding provider.
 * Constrains the concrete class without coupling the interface to circuit types.
 */
export type CircuitUnderstandingProviderType = UnderstandingProvider<
  CircuitPipelineSnapshot,
  CircuitScenePayload
>;

// ─── ScenePlanner ─────────────────────────────────────────────────────────────

/**
 * Converts a typed SceneDescription into a VisualizationPlan.
 * Has no side effects. Pure function equivalent at the class level.
 *
 * @template TPayload  The domain payload this planner handles.
 */
export interface ScenePlanner<TPayload = unknown> {
  readonly domain: string;

  /**
   * Type guard: returns true when this planner can handle the given description.
   * Callers must call canPlan() before plan() when working with unknown descriptions.
   */
  canPlan(
    description: SceneDescription<unknown>
  ): description is SceneDescription<TPayload>;

  /**
   * Converts a typed description into a VisualizationPlan.
   * Only called after canPlan() returns true.
   */
  plan(description: SceneDescription<TPayload>): VisualizationPlan;
}

// ─── VisualizationRenderer ────────────────────────────────────────────────────

/**
 * Executes a VisualizationPlan inside a DOM container element.
 * Returns a handle for lifecycle management.
 *
 * Renderer selection uses canRender() (not a strategy-keyed map) so multiple
 * renderers can share the same strategy enum value:
 *   e.g. ProceduralCircuitRenderer and a future ProceduralOpticsRenderer
 *        both have strategy='procedural' but different domain/sceneId.
 */
export interface VisualizationRenderer {
  /**
   * Returns true if this renderer can execute the given plan.
   * Implementations should check strategy, domain, and sceneId as needed.
   */
  canRender(plan: VisualizationPlan): boolean;

  /**
   * Mounts the visualization inside container and returns a lifecycle handle.
   * Must only be called after canRender() returns true.
   */
  render(container: HTMLElement, plan: VisualizationPlan): VisualizationHandle;
}

/**
 * Lifecycle handle returned by VisualizationRenderer.render().
 */
export interface VisualizationHandle {
  /** Release all GPU/memory resources. Must be called on unmount. */
  dispose(): void;
  /** Update renderer dimensions after a container resize. */
  onResize(width: number, height: number): void;
}
