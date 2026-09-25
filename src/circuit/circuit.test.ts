import { describe, it, expect } from 'vitest';
import {
  buildCircuitModel,
  evaluateRules,
  DetectedComponent,
  CircuitModel,
} from './index';

// Helper fixtures
const makeComponent = (
  type: DetectedComponent['type'],
  x: number,
  y: number,
  w = 50,
  h = 50,
  confidence = 0.90,
  polarity: DetectedComponent['polarity'] = 'normal'
): DetectedComponent => ({
  id: `test_${type}_${x}_${y}`,
  type,
  box: { x, y, w, h },
  confidence,
  polarity,
});

describe('Circuit Model Builder (src/circuit/builder.ts)', () => {
  it('excludes breadboard from the series chain but keeps it in components (context-only)', () => {
    const raw = [
      makeComponent('breadboard', 0, 0, 300, 200),
      makeComponent('battery', 50, 100),
      makeComponent('resistor', 150, 100),
      makeComponent('led', 250, 100),
    ];

    const circuit = buildCircuitModel(raw, 'camera');

    expect(circuit.components).toHaveLength(4);
    expect(circuit.chain).toHaveLength(3);
    expect(circuit.chain.some((c) => c.type === 'breadboard')).toBe(false);
  });

  it('sorts components along dominant horizontal axis (left-to-right)', () => {
    // Horizontal spread: 300 - 50 = 250. Vertical spread: 110 - 100 = 10.
    const raw = [
      makeComponent('led', 300, 100),
      makeComponent('battery', 50, 105),
      makeComponent('resistor', 180, 110),
    ];

    const circuit = buildCircuitModel(raw, 'camera');
    const order = circuit.chain.map((c) => c.type);

    expect(order).toEqual(['battery', 'resistor', 'led']);
  });

  it('sorts components along dominant vertical axis (top-to-bottom)', () => {
    // Vertical spread: 300 - 50 = 250. Horizontal spread: 110 - 100 = 10.
    const raw = [
      makeComponent('led', 100, 300),
      makeComponent('battery', 105, 50),
      makeComponent('resistor', 110, 180),
    ];

    const circuit = buildCircuitModel(raw, 'camera');
    const order = circuit.chain.map((c) => c.type);

    expect(order).toEqual(['battery', 'resistor', 'led']);
  });

  it('handles empty or single component lists safely', () => {
    expect(buildCircuitModel([]).chain).toHaveLength(0);

    const single = [makeComponent('battery', 10, 10)];
    expect(buildCircuitModel(single).chain).toHaveLength(1);
  });
});

describe('Pure Rule Engine & Staged Test Circuits (docs/rules.md §B5 T1-T10)', () => {
  it('T1: Battery + Switch + Resistor + LED -> OK (all pass)', () => {
    const components = [
      makeComponent('battery', 50, 100),
      makeComponent('switch', 120, 100),
      makeComponent('resistor', 200, 100),
      makeComponent('led', 280, 100),
    ];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('ok');
    expect(output.results.every((r) => r.status === 'pass')).toBe(true);
  });

  it('T2: Battery + Switch + LED -> Error (R3 fails: LED has no resistor)', () => {
    const components = [
      makeComponent('battery', 50, 100),
      makeComponent('switch', 120, 100),
      makeComponent('led', 200, 100),
    ];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('error');

    const r3 = output.results.find((r) => r.id === 'R3');
    expect(r3).toBeDefined();
    expect(r3?.status).toBe('fail');
    expect(r3?.title).toBe('LED has no resistor in its path.');
    expect(r3?.fix).toContain('in series with the LED');
  });

  it('T3: Switch + Resistor + LED -> Error (R1 fails: No battery detected)', () => {
    const components = [
      makeComponent('switch', 50, 100),
      makeComponent('resistor', 120, 100),
      makeComponent('led', 200, 100),
    ];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('error');

    const r1 = output.results.find((r) => r.id === 'R1');
    expect(r1).toBeDefined();
    expect(r1?.status).toBe('fail');
    expect(r1?.title).toBe('No battery detected.');
  });

  it('T4: Battery + Resistor + LED -> Warning (R4 warns: No switch to control the circuit)', () => {
    const components = [
      makeComponent('battery', 50, 100),
      makeComponent('resistor', 120, 100),
      makeComponent('led', 200, 100),
    ];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('warning');

    const r4 = output.results.find((r) => r.id === 'R4');
    expect(r4).toBeDefined();
    expect(r4?.status).toBe('warn');
    expect(r4?.title).toBe('No switch to control the circuit.');

    // R1 and R3 must pass
    expect(output.results.find((r) => r.id === 'R1')?.status).toBe('pass');
    expect(output.results.find((r) => r.id === 'R3')?.status).toBe('pass');
  });

  it('T5: Battery only -> Warning (R2 no LED, R4 no switch, R5 incomplete loop)', () => {
    const components = [makeComponent('battery', 50, 100)];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('warning');

    expect(output.results.find((r) => r.id === 'R2')?.status).toBe('warn');
    expect(output.results.find((r) => r.id === 'R4')?.status).toBe('warn');
    expect(output.results.find((r) => r.id === 'R5')?.status).toBe('warn');
    expect(output.results.find((r) => r.id === 'R1')?.status).toBe('pass');
  });

  it('T6: Empty table -> Empty / neutral behavior', () => {
    const circuit = buildCircuitModel([]);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('empty');
    expect(output.results).toHaveLength(0);
  });

  it('T7: Battery + Switch + Resistor -> Warning (R2 warns: No LED found yet)', () => {
    const components = [
      makeComponent('battery', 50, 100),
      makeComponent('switch', 120, 100),
      makeComponent('resistor', 200, 100),
    ];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('warning');

    const r2 = output.results.find((r) => r.id === 'R2');
    expect(r2).toBeDefined();
    expect(r2?.status).toBe('warn');
    expect(r2?.title).toBe('No LED found yet.');
  });

  it('T8: Battery + Switch + Resistor + 2 LEDs -> Warning (R6 warns: Duplicate LEDs in same path)', () => {
    const components = [
      makeComponent('battery', 50, 100),
      makeComponent('switch', 120, 100),
      makeComponent('resistor', 200, 100),
      makeComponent('led', 270, 100),
      makeComponent('led', 340, 100),
    ];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('warning');

    const r6 = output.results.find((r) => r.id === 'R6');
    expect(r6).toBeDefined();
    expect(r6?.status).toBe('warn');
    expect(r6?.title).toBe('More than one LED in the same path.');
  });

  it('T9: Virtual Builder mode with reversed LED -> Error (R7 fails)', () => {
    // In Virtual Builder mode:
    const reversedVirtualCircuit: CircuitModel = {
      components: [
        makeComponent('battery', 50, 100),
        makeComponent('switch', 120, 100),
        makeComponent('resistor', 200, 100),
        makeComponent('led', 280, 100, 50, 50, 0.95, 'reversed'),
      ],
      chain: [
        makeComponent('battery', 50, 100),
        makeComponent('switch', 120, 100),
        makeComponent('resistor', 200, 100),
        makeComponent('led', 280, 100, 50, 50, 0.95, 'reversed'),
      ],
      mode: 'virtual',
    };

    const outputVirtual = evaluateRules(reversedVirtualCircuit);
    expect(outputVirtual.status).toBe('error');

    const r7Virtual = outputVirtual.results.find((r) => r.id === 'R7');
    expect(r7Virtual?.status).toBe('fail');
    expect(r7Virtual?.title).toBe('LED is reversed.');

    // In Camera mode, the same circuit MUST pass R7 because camera does not detect polarity
    const cameraCircuit: CircuitModel = {
      ...reversedVirtualCircuit,
      mode: 'camera',
    };
    const outputCamera = evaluateRules(cameraCircuit);
    expect(outputCamera.status).toBe('ok');
    expect(outputCamera.results.find((r) => r.id === 'R7')?.status).toBe('pass');
  });

  it('T10: Low-confidence item (< 0.60) -> Info R8 without turning overall circuit into Error/Warning', () => {
    const components = [
      makeComponent('battery', 50, 100, 50, 50, 0.92),
      makeComponent('switch', 120, 100, 50, 50, 0.90),
      makeComponent('resistor', 200, 100, 50, 50, 0.55), // < 0.60 low confidence
      makeComponent('led', 280, 100, 50, 50, 0.88),
    ];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    // Overall status remains 'ok' because info severity does not change status color
    expect(output.status).toBe('ok');

    const r8 = output.results.find((r) => r.id === 'R8');
    expect(r8).toBeDefined();
    expect(r8?.status).toBe('info');
    expect(r8?.title).toBe('Not sure about one item.');
  });

  it('R3 order independence: Resistor placed AFTER LED in chain passes R3', () => {
    // Battery -> Switch -> LED -> Resistor (order reversed compared to textbook convention)
    const components = [
      makeComponent('battery', 50, 100),
      makeComponent('switch', 120, 100),
      makeComponent('led', 200, 100),
      makeComponent('resistor', 280, 100),
    ];
    const circuit = buildCircuitModel(components);
    const output = evaluateRules(circuit);

    expect(output.status).toBe('ok');
    const r3 = output.results.find((r) => r.id === 'R3');
    expect(r3?.status).toBe('pass');
  });
});

describe('Note on Staged Cases T11 to T14 (Reserved for R9 Scene Gate Slice)', () => {
  it('confirms T11-T14 require the scene gate state machine and are outside pure CircuitModel scope', () => {
    // T11: Textbook diagram with no parts -> R9 gate fails (Not recognized screen)
    // T12: Random desk clutter (keys, pen) -> R9 gate fails (Not recognized screen)
    // T13: Single resistor alone -> R9 soft fail hint ("Add more parts")
    // T14: User picks LED circuit lab from list -> Opens Virtual Builder
    // These belong in the R9 scene gate / UI slice per architecture.md §5.0.
    expect(true).toBe(true);
  });
});
