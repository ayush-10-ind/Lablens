/**
 * Scene Gate (Rule R9) State Machine for LabLens.
 * Derived strictly from docs/rules.md §B2, §B6 and docs/architecture.md §5.0.
 *
 * Implements the R9 entry gate between tracked detections and the circuit builder:
 * - Moves 'idle' -> 'lab' when >= 2 distinct supported component types are present
 *   for >= 5 consecutive frames.
 * - Moves 'lab' -> 'idle' when no supported components are observed for >= 3000 ms.
 * - While 'idle': zero labels exposed (gatedComponents = []), labelsAllowed = false.
 * - Single component provides soft hint: "Add more parts to start the circuit lab."
 * - Filters out unknown/unsupported component types so they never enter gatedComponents.
 */

import { SCENE_GATE_CONFIG } from '../config';
import { ComponentType, DetectedComponent } from './types';

export const SUPPORTED_CIRCUIT_COMPONENTS = new Set<ComponentType>([
  'battery',
  'resistor',
  'led',
  'switch',
  'breadboard',
]);

export type SceneGateState = 'idle' | 'lab';

export interface SceneGateStatus {
  state: SceneGateState;
  consecutiveStableFrames: number;
  distinctComponentTypes: ComponentType[];
  distinctCount: number;
  labelsAllowed: boolean;
  gatedComponents: DetectedComponent[];
  hint?: string;
}

export class SceneGate {
  private state: SceneGateState = 'idle';
  private consecutiveStableFrames = 0;
  private lastSupportedTimestamp: number | null = null;

  public getState(): SceneGateState {
    return this.state;
  }

  public getConsecutiveStableFrames(): number {
    return this.consecutiveStableFrames;
  }

  public reset(): void {
    this.state = 'idle';
    this.consecutiveStableFrames = 0;
    this.lastSupportedTimestamp = null;
  }

  /**
   * Evaluates the current frame's detections and timestamp to update gate state.
   *
   * @param components Detections from the current frame.
   * @param timestampMs Monotonic or wall-clock timestamp in milliseconds.
   */
  public update(components: DetectedComponent[], timestampMs: number): SceneGateStatus {
    // 1. Filter to valid, supported component types only (unsupported classes dropped)
    const supportedComponents = components.filter((c) =>
      SUPPORTED_CIRCUIT_COMPONENTS.has(c.type)
    );

    // 2. Count distinct component types
    const distinctTypesSet = new Set<ComponentType>();
    for (const c of supportedComponents) {
      distinctTypesSet.add(c.type);
    }
    const distinctComponentTypes = Array.from(distinctTypesSet);
    const distinctCount = distinctComponentTypes.length;

    // 3. State-specific transitions
    if (this.state === 'lab') {
      if (supportedComponents.length > 0) {
        // Supported components observed: refresh exit timestamp
        this.lastSupportedTimestamp = timestampMs;
      } else if (
        this.lastSupportedTimestamp !== null &&
        timestampMs - this.lastSupportedTimestamp >= SCENE_GATE_CONFIG.EXIT_TIMEOUT_MS
      ) {
        // Exit condition: no supported components for >= EXIT_TIMEOUT_MS (3000ms)
        this.state = 'idle';
        this.consecutiveStableFrames = 0;
        this.lastSupportedTimestamp = null;
      }
    }

    if (this.state === 'idle') {
      if (distinctCount >= SCENE_GATE_CONFIG.MIN_DISTINCT_COMPONENT_TYPES) {
        this.consecutiveStableFrames++;
        if (this.consecutiveStableFrames >= SCENE_GATE_CONFIG.MIN_STABLE_FRAMES) {
          // Entry condition met: >= 2 distinct types for >= 5 consecutive frames
          this.state = 'lab';
          this.lastSupportedTimestamp = timestampMs;
        }
      } else {
        // Interrupted or inadequate distinct types: reset consecutive frame counter
        this.consecutiveStableFrames = 0;
      }
    }

    // 4. Output generation
    if (this.state === 'lab') {
      return {
        state: 'lab',
        consecutiveStableFrames: this.consecutiveStableFrames,
        distinctComponentTypes,
        distinctCount,
        labelsAllowed: true,
        gatedComponents: supportedComponents,
      };
    }

    // Idle state outputs: zero labels allowed
    let hint: string | undefined;
    if (distinctCount === 1) {
      hint = 'Add more parts to start the circuit lab.';
    } else if (distinctCount === 0) {
      hint = 'Point camera at circuit parts to begin.';
    }

    return {
      state: 'idle',
      consecutiveStableFrames: this.consecutiveStableFrames,
      distinctComponentTypes,
      distinctCount,
      labelsAllowed: false,
      gatedComponents: [],
      hint,
    };
  }
}
