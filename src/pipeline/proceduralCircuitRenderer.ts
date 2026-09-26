/**
 * Procedural circuit renderer.
 *
 * Implements VisualizationRenderer for the 'led-circuit' procedural scene.
 * Delegates to the existing createCircuitGuideScene() from src/guide3d/scene.ts.
 * That file is NOT modified.
 *
 * Renderer selection:
 * canRender() checks strategy, domain AND sceneId so that a future
 * ProceduralOpticsRenderer (also strategy='procedural') can coexist without
 * conflict. Never rely on strategy alone.
 */

import type { VisualizationRenderer, VisualizationHandle } from './providers';
import type { VisualizationPlan, ProceduralPlan } from './types';
import { createCircuitGuideScene } from '../guide3d/scene';

export class ProceduralCircuitRenderer implements VisualizationRenderer {
  /**
   * Returns true only for procedural 'led-circuit' plans in the 'circuit' domain.
   * A future ProceduralOpticsRenderer with strategy='procedural' + domain='optics'
   * will correctly return false here.
   */
  canRender(plan: VisualizationPlan): boolean {
    if (plan.strategy !== 'procedural') return false;
    const p = plan as ProceduralPlan;
    return p.domain === 'circuit' && p.sceneId === 'led-circuit';
  }

  /**
   * Mounts the Three.js circuit guide scene inside container.
   * Must only be called after canRender() returns true.
   */
  render(container: HTMLElement, plan: VisualizationPlan): VisualizationHandle {
    if (!this.canRender(plan)) {
      throw new Error(
        `ProceduralCircuitRenderer: incompatible plan strategy="${plan.strategy}" ` +
          `domain="${(plan as { domain?: string }).domain ?? 'n/a'}" ` +
          `sceneId="${(plan as { sceneId?: string }).sceneId ?? 'n/a'}"`
      );
    }

    const p = plan as ProceduralPlan;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handle = createCircuitGuideScene(container, { reducedMotion });

    if (p.initialStep !== undefined) {
      handle.setStep(p.initialStep);
    }
    handle.setCircuitActive(p.circuitActive ?? true);

    return {
      dispose: () => handle.dispose(),
      onResize: (w, h) => handle.onResize(w, h),
    };
  }
}
