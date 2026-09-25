/**
 * Core types for the LabLens Circuit Builder and Rule Engine.
 * Strictly derived from docs/architecture.md §5.1 and docs/rules.md Part B.
 */

export type ComponentType = 'battery' | 'resistor' | 'led' | 'switch' | 'breadboard';

export interface DetectedComponent {
  id: string; // unique track id
  type: ComponentType;
  box: { x: number; y: number; w: number; h: number };
  confidence: number;
  polarity?: 'normal' | 'reversed'; // for Virtual Builder mode (R7)
}

export interface CircuitModel {
  components: DetectedComponent[];
  chain: DetectedComponent[]; // ordered series chain (excluding breadboard)
  mode: 'camera' | 'marker' | 'virtual';
}

export type RuleStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface RuleResult {
  id: string;
  status: RuleStatus;
  title: string;
  message?: string;
  fix?: string;
}

export type OverallCircuitStatus = 'ok' | 'warning' | 'error' | 'empty';

export interface RuleEngineOutput {
  status: OverallCircuitStatus;
  results: RuleResult[];
}
