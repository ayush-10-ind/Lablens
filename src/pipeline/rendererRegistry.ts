/**
 * Renderer registry for the domain-neutral LabLens pipeline.
 *
 * Design: NOT a Map<VisualizationStrategy, VisualizationRenderer>.
 * Uses canRender() dispatch so multiple renderers can share the same strategy
 * but target different domains or sceneIds without conflict.
 *
 * Example coexistence:
 *   ProceduralCircuitRenderer  (strategy='procedural', domain='circuit', sceneId='led-circuit')
 *   ProceduralOpticsRenderer   (strategy='procedural', domain='optics',  sceneId='optics-bench')  ← future
 */

import type { VisualizationRenderer, VisualizationHandle } from './providers';
import type { VisualizationPlan } from './types';

export class RendererRegistry {
  private readonly renderers: VisualizationRenderer[] = [];

  /**
   * Registers a renderer. Renderers are evaluated in registration order;
   * the first canRender() match wins.
   */
  register(renderer: VisualizationRenderer): void {
    this.renderers.push(renderer);
  }

  /**
   * Returns the first registered renderer that can handle the plan.
   *
   * @throws Error if plan.strategy === 'none' (NullPlan must be handled before calling resolve).
   * @throws Error if no registered renderer can handle the plan.
   */
  resolve(plan: VisualizationPlan): VisualizationRenderer {
    if (plan.strategy === 'none') {
      throw new Error(
        `RendererRegistry: cannot resolve NullPlan — reason: "${plan.reason}"`
      );
    }

    const renderer = this.renderers.find((r) => r.canRender(plan));

    if (!renderer) {
      const hint =
        plan.strategy === 'procedural' || plan.strategy === 'curated' || plan.strategy === 'generated'
          ? ` domain="${(plan as { domain?: string }).domain ?? 'n/a'}"`
          : '';
      throw new Error(
        `RendererRegistry: no renderer registered for strategy="${plan.strategy}"${hint}`
      );
    }

    return renderer;
  }

  /**
   * Convenience: resolve and immediately render into a container.
   * Equivalent to registry.resolve(plan).render(container, plan).
   */
  renderInto(container: HTMLElement, plan: VisualizationPlan): VisualizationHandle {
    return this.resolve(plan).render(container, plan);
  }
}
