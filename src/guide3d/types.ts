/**
 * Core types for the Prebuilt 3D Circuit Guide.
 * Strictly derived from docs/design.md §3.5, docs/architecture.md §6.0, and docs/rules.md §B2-B3.
 */

export type GuideComponentId = 'battery' | 'switch' | 'resistor' | 'led';

export interface GuideStep {
  stepNumber: number; // 1..4
  componentId: GuideComponentId;
  label: string;
  caption: string;
}

export type GuideContextFocus = 'overview' | 'resistor' | 'loop';

export interface GuideCircuitContent {
  id: string; // 'led-circuit'
  title: string;
  steps: GuideStep[];
  contextGuidance: {
    r3Fail: string;
    r5Warn: string;
    circuitOk: string;
  };
}

export interface GuideControllerState {
  currentStepIndex: number; // 0-indexed (0..3 corresponding to steps 1..4)
  isPlaying: boolean;
  focusContext: GuideContextFocus;
  activeCaption: string;
}
