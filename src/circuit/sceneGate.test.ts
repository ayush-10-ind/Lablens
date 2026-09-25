import { describe, it, expect, beforeEach } from 'vitest';
import { SCENE_GATE_CONFIG } from '../config';
import {
  SceneGate,
  DetectedComponent,
  SUPPORTED_CIRCUIT_COMPONENTS,
} from './index';

// Helper fixtures
const makePart = (
  type: DetectedComponent['type'],
  id = `c_${type}_${Math.random()}`
): DetectedComponent => ({
  id,
  type,
  box: { x: 50, y: 50, w: 60, h: 60 },
  confidence: 0.90,
});

describe('SceneGate (Rule R9 State Machine)', () => {
  let gate: SceneGate;

  beforeEach(() => {
    gate = new SceneGate();
  });

  it('starts in idle state with zero labels allowed and consecutiveStableFrames = 0', () => {
    expect(gate.getState()).toBe('idle');
    expect(gate.getConsecutiveStableFrames()).toBe(0);

    const status = gate.update([], 1000);
    expect(status.state).toBe('idle');
    expect(status.labelsAllowed).toBe(false);
    expect(status.gatedComponents).toHaveLength(0);
    expect(status.consecutiveStableFrames).toBe(0);
  });

  it('remains in idle with soft hint when only 1 component type is detected', () => {
    // 1 resistor
    const status = gate.update([makePart('resistor')], 1000);

    expect(status.state).toBe('idle');
    expect(status.labelsAllowed).toBe(false);
    expect(status.gatedComponents).toHaveLength(0);
    expect(status.distinctCount).toBe(1);
    expect(status.consecutiveStableFrames).toBe(0);
    expect(status.hint).toBe('Add more parts to start the circuit lab.');
  });

  it('does not satisfy the gate with breadboard alone (distinct count = 1)', () => {
    const status = gate.update([makePart('breadboard')], 1000);

    expect(status.state).toBe('idle');
    expect(status.labelsAllowed).toBe(false);
    expect(status.gatedComponents).toHaveLength(0);
    expect(status.distinctCount).toBe(1);
    expect(status.hint).toBe('Add more parts to start the circuit lab.');
  });

  it('does not count duplicate instances of a single component type as 2 distinct types', () => {
    // 2 resistors -> distinctCount = 1
    const twoResistors = [makePart('resistor', 'r1'), makePart('resistor', 'r2')];
    const status = gate.update(twoResistors, 1000);

    expect(status.state).toBe('idle');
    expect(status.distinctCount).toBe(1);
    expect(status.consecutiveStableFrames).toBe(0);
    expect(status.labelsAllowed).toBe(false);
    expect(status.gatedComponents).toHaveLength(0);
  });

  it('remains in idle when 2 distinct types are seen for fewer than 5 consecutive frames', () => {
    const parts = [makePart('battery'), makePart('led')];

    // Frame 1 to 4: distinctCount = 2, but fewer than MIN_STABLE_FRAMES (5)
    for (let frame = 1; frame <= 4; frame++) {
      const status = gate.update(parts, 1000 + frame * 100);
      expect(status.state).toBe('idle');
      expect(status.labelsAllowed).toBe(false);
      expect(status.gatedComponents).toHaveLength(0);
      expect(status.consecutiveStableFrames).toBe(frame);
    }
  });

  it('enters lab mode on exactly the 5th consecutive frame with >= 2 distinct types', () => {
    const parts = [makePart('battery'), makePart('led')];

    for (let frame = 1; frame <= 4; frame++) {
      gate.update(parts, 1000 + frame * 100);
    }

    // 5th consecutive frame
    const status5 = gate.update(parts, 1500);

    expect(status5.state).toBe('lab');
    expect(status5.labelsAllowed).toBe(true);
    expect(status5.consecutiveStableFrames).toBe(SCENE_GATE_CONFIG.MIN_STABLE_FRAMES);
    expect(status5.gatedComponents).toHaveLength(2);
    expect(gate.getState()).toBe('lab');
  });

  it('resets consecutive frame count if interrupted before reaching 5 frames', () => {
    const validParts = [makePart('resistor'), makePart('switch')];

    // 3 valid frames
    gate.update(validParts, 1100);
    gate.update(validParts, 1200);
    const s3 = gate.update(validParts, 1300);
    expect(s3.consecutiveStableFrames).toBe(3);

    // Frame 4: interrupted (e.g. only 1 component visible)
    const s4 = gate.update([makePart('resistor')], 1400);
    expect(s4.state).toBe('idle');
    expect(s4.consecutiveStableFrames).toBe(0); // reset!

    // Frame 5: valid parts again -> starts at 1, does NOT enter lab mode
    const s5 = gate.update(validParts, 1500);
    expect(s5.state).toBe('idle');
    expect(s5.consecutiveStableFrames).toBe(1);
    expect(s5.labelsAllowed).toBe(false);
  });

  it('persists in lab mode while supported components continue to be observed', () => {
    const validParts = [makePart('battery'), makePart('led')];

    // Enter lab mode (5 frames)
    for (let i = 1; i <= 5; i++) {
      gate.update(validParts, 1000 + i * 100);
    }
    expect(gate.getState()).toBe('lab');

    // Subsequent frames in lab mode
    const status6 = gate.update(validParts, 1700);
    expect(status6.state).toBe('lab');
    expect(status6.labelsAllowed).toBe(true);
    expect(status6.gatedComponents).toHaveLength(2);

    // Even if reduced to 1 supported component while in lab, it stays in lab
    const status7 = gate.update([makePart('led')], 1800);
    expect(status7.state).toBe('lab');
    expect(status7.labelsAllowed).toBe(true);
    expect(status7.gatedComponents).toHaveLength(1);
  });

  it('immediately exits to idle if next frame is at t >= 3000ms after last supported components (Adjustment 1)', () => {
    const validParts = [makePart('battery'), makePart('led')];

    // Enter lab mode at t = 1000ms
    for (let i = 1; i <= 5; i++) {
      gate.update(validParts, 1000);
    }
    expect(gate.getState()).toBe('lab');

    // Next frame arrives at t = 4500ms (3500ms since last supported at t = 1000)
    // Elapsed: 4500 - 1000 = 3500ms >= EXIT_TIMEOUT_MS (3000ms)
    const statusAfterTimeout = gate.update([], 4500);

    expect(statusAfterTimeout.state).toBe('idle');
    expect(statusAfterTimeout.labelsAllowed).toBe(false);
    expect(statusAfterTimeout.gatedComponents).toHaveLength(0);
    expect(gate.getState()).toBe('idle');
  });

  it('stays in lab mode if empty frames are under 3000ms, then exits once 3000ms is exceeded', () => {
    const validParts = [makePart('battery'), makePart('switch')];

    // Enter lab mode with last supported component at t = 0ms
    for (let i = 1; i <= 5; i++) {
      gate.update(validParts, 0);
    }
    expect(gate.getState()).toBe('lab');

    // Empty frame at t = 1000ms -> elapsed 1000ms < 3000ms -> stays lab
    const s1 = gate.update([], 1000);
    expect(s1.state).toBe('lab');
    expect(s1.labelsAllowed).toBe(true);

    // Empty frame at t = 2900ms -> elapsed 2900ms < 3000ms -> stays lab
    const s2 = gate.update([], 2900);
    expect(s2.state).toBe('lab');
    expect(s2.labelsAllowed).toBe(true);

    // Empty frame at t = 3000ms -> elapsed 3000ms >= 3000ms -> EXITS to idle!
    const s3 = gate.update([], 3000);
    expect(s3.state).toBe('idle');
    expect(s3.labelsAllowed).toBe(false);
    expect(s3.gatedComponents).toHaveLength(0);
  });

  it('allows re-entry into lab mode after timeout exit', () => {
    const parts = [makePart('battery'), makePart('resistor')];

    // 1. Enter lab
    for (let i = 1; i <= 5; i++) gate.update(parts, 1000);
    expect(gate.getState()).toBe('lab');

    // 2. Exit to idle via timeout
    gate.update([], 4500);
    expect(gate.getState()).toBe('idle');

    // 3. Re-entry requires 5 new consecutive stable frames
    for (let i = 1; i <= 4; i++) {
      const s = gate.update(parts, 5000 + i * 100);
      expect(s.state).toBe('idle');
    }

    const reEntered = gate.update(parts, 5500);
    expect(reEntered.state).toBe('lab');
    expect(reEntered.labelsAllowed).toBe(true);
    expect(reEntered.gatedComponents).toHaveLength(2);
  });

  it('strictly filters out unknown/unsupported component types from gatedComponents (Adjustment 2)', () => {
    const mixedParts: DetectedComponent[] = [
      makePart('battery'),
      makePart('led'),
      // Unsupported / fake classes that might come from an external detector or corrupted label
      {
        id: 'bad_1',
        type: 'wire' as any,
        box: { x: 0, y: 0, w: 10, h: 10 },
        confidence: 0.99,
      },
      {
        id: 'bad_2',
        type: 'pencil' as any,
        box: { x: 0, y: 0, w: 10, h: 10 },
        confidence: 0.85,
      },
    ];

    // Enter lab mode with mixed parts
    let status: any;
    for (let i = 1; i <= 5; i++) {
      status = gate.update(mixedParts, 1000 + i * 100);
    }

    expect(status.state).toBe('lab');
    expect(status.labelsAllowed).toBe(true);

    // Only supported component types ('battery', 'led') are forwarded
    expect(status.gatedComponents).toHaveLength(2);
    for (const c of status.gatedComponents) {
      expect(SUPPORTED_CIRCUIT_COMPONENTS.has(c.type)).toBe(true);
      expect(c.type).not.toBe('wire');
      expect(c.type).not.toBe('pencil');
    }
  });

  it('resets completely when reset() is called', () => {
    const parts = [makePart('battery'), makePart('led')];
    for (let i = 1; i <= 5; i++) gate.update(parts, 1000);
    expect(gate.getState()).toBe('lab');

    gate.reset();
    expect(gate.getState()).toBe('idle');
    expect(gate.getConsecutiveStableFrames()).toBe(0);

    const s = gate.update([], 1500);
    expect(s.state).toBe('idle');
    expect(s.labelsAllowed).toBe(false);
  });
});
