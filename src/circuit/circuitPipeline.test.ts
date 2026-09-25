import { describe, it, expect, beforeEach } from 'vitest';
import {
  SceneGate,
  processCircuitPipeline,
  COMPONENT_THEME_TOKENS,
  DetectedComponent,
} from './index';

// Helper fixtures
const makeComponent = (
  type: DetectedComponent['type'],
  x: number,
  y: number,
  confidence = 0.92
): DetectedComponent => ({
  id: `track_${type}_${x}_${y}`,
  type,
  box: { x, y, w: 50, h: 50 },
  confidence,
});

describe('Circuit Pipeline Integration (SceneGate -> CircuitBuilder -> RuleEngine)', () => {
  let gate: SceneGate;

  beforeEach(() => {
    gate = new SceneGate();
  });

  it('keeps zero labels, null circuit model, and null rule output while in idle state', () => {
    const randomClutter: DetectedComponent[] = [
      {
        id: 'clutter_1',
        type: 'wire' as any,
        box: { x: 10, y: 10, w: 30, h: 30 },
        confidence: 0.99,
      },
    ];

    const result = processCircuitPipeline(gate, randomClutter, 1000);

    expect(result.gateStatus.state).toBe('idle');
    expect(result.labels).toHaveLength(0);
    expect(result.circuitModel).toBeNull();
    expect(result.ruleOutput).toBeNull();
  });

  it('provides the soft hint and zero labels when exactly one supported component is present in idle', () => {
    const singleResistor = [makeComponent('resistor', 100, 100)];

    const result = processCircuitPipeline(gate, singleResistor, 1000);

    expect(result.gateStatus.state).toBe('idle');
    expect(result.labels).toHaveLength(0);
    expect(result.circuitModel).toBeNull();
    expect(result.ruleOutput).toBeNull();
    expect(result.primaryHint).toBe('Add more parts to start the circuit lab.');
  });

  it('enters lab mode on exactly the 5th qualifying frame and evaluates the circuit', () => {
    // Battery + LED (missing resistor -> should cause R3 error in lab)
    const qualifyingDetections = [
      makeComponent('battery', 50, 100),
      makeComponent('led', 200, 100),
    ];

    // Frames 1-4: remains in idle, zero labels exposed, rules not evaluated
    for (let frame = 1; frame <= 4; frame++) {
      const res = processCircuitPipeline(gate, qualifyingDetections, 1000 + frame * 100);
      expect(res.gateStatus.state).toBe('idle');
      expect(res.labels).toHaveLength(0);
      expect(res.circuitModel).toBeNull();
      expect(res.ruleOutput).toBeNull();
    }

    // 5th frame: enters lab mode!
    const labResult = processCircuitPipeline(gate, qualifyingDetections, 1500);

    expect(labResult.gateStatus.state).toBe('lab');
    expect(labResult.labels).toHaveLength(2);
    expect(labResult.circuitModel).not.toBeNull();
    expect(labResult.circuitModel?.chain).toHaveLength(2);

    // Observable rule result: Battery + LED -> overall 'error' due to missing resistor (R3)
    expect(labResult.ruleOutput).not.toBeNull();
    expect(labResult.ruleOutput?.status).toBe('error');

    const r3 = labResult.ruleOutput?.results.find((r) => r.id === 'R3');
    expect(r3).toBeDefined();
    expect(r3?.status).toBe('fail');
    expect(r3?.title).toBe('LED has no resistor in its path.');
    expect(r3?.fix).toBe('Add a resistor in series with the LED to limit current.');

    // Primary hint surfaces the top fix
    expect(labResult.primaryHint).toBe('Add a resistor in series with the LED to limit current.');
  });

  it('evaluates complete valid circuit to OK with all rules passing after R9 entry', () => {
    const fullCircuit = [
      makeComponent('battery', 50, 100),
      makeComponent('switch', 120, 100),
      makeComponent('resistor', 200, 100),
      makeComponent('led', 280, 100),
    ];

    // Step 5 frames to satisfy gate
    let result: any;
    for (let frame = 1; frame <= 5; frame++) {
      result = processCircuitPipeline(gate, fullCircuit, 1000 + frame * 100);
    }

    expect(result.gateStatus.state).toBe('lab');
    expect(result.labels).toHaveLength(4);
    expect(result.ruleOutput?.status).toBe('ok');
    expect(result.primaryHint).toBe('Circuit complete and verified.');
  });

  it('evaluates warning status and correct fix for missing LED after R9 entry', () => {
    // Battery + Switch + Resistor (valid R9 qualification with 3 distinct types, but missing LED)
    const noLedCircuit = [
      makeComponent('battery', 50, 100),
      makeComponent('switch', 120, 100),
      makeComponent('resistor', 200, 100),
    ];

    let result: any;
    for (let frame = 1; frame <= 5; frame++) {
      result = processCircuitPipeline(gate, noLedCircuit, 1000 + frame * 100);
    }

    expect(result.gateStatus.state).toBe('lab');
    expect(result.ruleOutput?.status).toBe('warning');
    expect(result.primaryHint).toBe('Add an LED so there is something to light up.');
  });

  it('exits lab mode after 3000ms with no components and clears labels, circuit model, and rules', () => {
    const qualifyingDetections = [
      makeComponent('battery', 50, 100),
      makeComponent('resistor', 200, 100),
    ];

    // Enter lab mode at t = 1000ms
    for (let frame = 1; frame <= 5; frame++) {
      processCircuitPipeline(gate, qualifyingDetections, 1000);
    }
    expect(gate.getState()).toBe('lab');

    // Intermediate empty frame at t = 2000ms (1000ms < 3000ms elapsed) -> stays in lab
    const intermediate = processCircuitPipeline(gate, [], 2000);
    expect(intermediate.gateStatus.state).toBe('lab');
    expect(intermediate.labels).toHaveLength(0); // empty frame has 0 items

    // Timeout expired at t = 4500ms (3500ms elapsed >= 3000ms) -> transitions to idle!
    const exitResult = processCircuitPipeline(gate, [], 4500);

    expect(exitResult.gateStatus.state).toBe('idle');
    expect(exitResult.labels).toHaveLength(0);
    expect(exitResult.circuitModel).toBeNull();
    expect(exitResult.ruleOutput).toBeNull();
    expect(gate.getState()).toBe('idle');
  });

  it('re-enters lab mode after timeout when 5 new consecutive frames arrive', () => {
    const qualifyingDetections = [
      makeComponent('battery', 50, 100),
      makeComponent('switch', 200, 100),
    ];

    // 1. Enter lab
    for (let f = 1; f <= 5; f++) processCircuitPipeline(gate, qualifyingDetections, 1000);
    expect(gate.getState()).toBe('lab');

    // 2. Timeout exit
    processCircuitPipeline(gate, [], 5000);
    expect(gate.getState()).toBe('idle');

    // 3. Re-entry requires 5 new frames
    for (let f = 1; f <= 4; f++) {
      const res = processCircuitPipeline(gate, qualifyingDetections, 6000 + f * 100);
      expect(res.gateStatus.state).toBe('idle');
    }

    const reEntered = processCircuitPipeline(gate, qualifyingDetections, 6500);
    expect(reEntered.gateStatus.state).toBe('lab');
    expect(reEntered.labels).toHaveLength(2);
    expect(reEntered.ruleOutput).not.toBeNull();
  });

  it('maps all component types to CSS variable design tokens without hardcoded hex', () => {
    expect(COMPONENT_THEME_TOKENS.battery).toBe('var(--battery)');
    expect(COMPONENT_THEME_TOKENS.resistor).toBe('var(--resistor)');
    expect(COMPONENT_THEME_TOKENS.led).toBe('var(--led)');
    expect(COMPONENT_THEME_TOKENS.switch).toBe('var(--switch)');
    expect(COMPONENT_THEME_TOKENS.breadboard).toBe('var(--breadboard)');
  });
});
