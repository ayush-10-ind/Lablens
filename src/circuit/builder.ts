/**
 * Circuit Model Builder for LabLens.
 * Derived strictly from docs/architecture.md §5.2.
 *
 * Infers an assumed series loop from spatial layout:
 * - Breadboard is ignored for chain construction (context-only).
 * - Components are sorted along the dominant spatial axis (left-to-right or top-to-bottom).
 * - In camera mode, this is a layout-based approximation (physical wires are not detected).
 */

import { CircuitModel, DetectedComponent } from './types';

/**
 * Builds a CircuitModel from detected components.
 * In camera mode, infers the series chain by spatial layout.
 */
export function buildCircuitModel(
  components: DetectedComponent[],
  mode: 'camera' | 'marker' | 'virtual' = 'camera'
): CircuitModel {
  // Breadboard is context-only; filter out for chain building
  const chainCandidates = components.filter((c) => c.type !== 'breadboard');

  if (chainCandidates.length <= 1) {
    return {
      components: [...components],
      chain: [...chainCandidates],
      mode,
    };
  }

  // Calculate box centers
  const withCenters = chainCandidates.map((c) => ({
    component: c,
    centerX: c.box.x + c.box.w / 2,
    centerY: c.box.y + c.box.h / 2,
  }));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const item of withCenters) {
    if (item.centerX < minX) minX = item.centerX;
    if (item.centerX > maxX) maxX = item.centerX;
    if (item.centerY < minY) minY = item.centerY;
    if (item.centerY > maxY) maxY = item.centerY;
  }

  const spreadX = maxX - minX;
  const spreadY = maxY - minY;

  // Sort along the dominant axis: if vertical spread is larger, sort by Y; else sort by X
  const sorted = [...withCenters].sort((a, b) => {
    if (spreadY > spreadX) {
      return a.centerY - b.centerY;
    }
    return a.centerX - b.centerX;
  });

  return {
    components: [...components],
    chain: sorted.map((s) => s.component),
    mode,
  };
}
