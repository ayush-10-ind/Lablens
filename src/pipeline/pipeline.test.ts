/**
 * Unit tests for the domain-neutral pipeline abstraction.
 *
 * Test baseline: 97 existing tests. Target: 97 + 6 = 103 minimum.
 *
 * All six tests are pure:
 * - No DOM.
 * - No WebGL / Three.js renderer.
 * - No Web Worker.
 * - No React.
 *
 * Scope: proves the pipeline abstraction layer only.
 * Does NOT test arbitrary image understanding, anatomy recognition,
 * heart recognition, or real image-to-3D generation.
 *
 * Unchanged: R9, SceneGate, CircuitBuilder, RuleEngine, useCircuitPipeline,
 *            processCircuitPipeline, CameraPreview, src/guide3d/.
 */

import { describe, it, expect } from 'vitest';
import { CircuitUnderstandingProvider } from './circuitUnderstandingProvider';
import { CircuitScenePlanner } from './circuitScenePlanner';
import { ProceduralCircuitRenderer } from './proceduralCircuitRenderer';
import { runPipeline } from './pipelineOrchestrator';
import type { CircuitPipelineSnapshot } from './types';
import type { SceneDescription } from './types';
import type { CircuitModel, RuleEngineOutput } from '../circuit/types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeIdleSnapshot(): CircuitPipelineSnapshot {
  return {
    gateStatus: {
      state: 'idle',
      consecutiveStableFrames: 0,
      distinctComponentTypes: [],
      distinctCount: 0,
      labelsAllowed: false,
      gatedComponents: [],
      hint: 'Point camera at circuit parts to begin.',
    },
    circuitModel: null,
    ruleOutput: null,
    labels: [],
    primaryHint: undefined,
  };
}

function makeLabSnapshot(
  ruleStatus: 'ok' | 'warning' | 'error',
  results: RuleEngineOutput['results'] = []
): CircuitPipelineSnapshot {
  const model: CircuitModel = {
    components: [
      { id: 'b1', type: 'battery', box: { x: 10, y: 10, w: 50, h: 30 }, confidence: 0.92 },
      { id: 'r1', type: 'resistor', box: { x: 80, y: 10, w: 40, h: 20 }, confidence: 0.85 },
      { id: 'l1', type: 'led', box: { x: 130, y: 10, w: 30, h: 30 }, confidence: 0.78 },
    ],
    chain: [],
    mode: 'camera',
  };
  const ruleOutput: RuleEngineOutput = { status: ruleStatus, results };
  return {
    gateStatus: {
      state: 'lab',
      consecutiveStableFrames: 5,
      distinctComponentTypes: ['battery', 'resistor', 'led'],
      distinctCount: 3,
      labelsAllowed: true,
      gatedComponents: model.components,
    },
    circuitModel: model,
    ruleOutput,
    labels: model.components,
    primaryHint: undefined,
  };
}

// ─── P1: Idle snapshot → circuit description with null model/ruleOutput ───────

describe('P1 – CircuitUnderstandingProvider: idle snapshot', () => {
  it('produces a circuit domain description with null model and ruleOutput, and no detectorMeanConfidence', () => {
    const provider = new CircuitUnderstandingProvider();
    const snapshot = makeIdleSnapshot();

    const desc = provider.describe(snapshot);

    expect(desc.domain).toBe('circuit');
    expect(desc.payload.kind).toBe('circuit');
    expect(desc.payload.model).toBeNull();
    expect(desc.payload.ruleOutput).toBeNull();
    expect(desc.source.kind).toBe('detector');
    // No labels → no mean confidence (must not be fabricated)
    expect(desc.source.detectorMeanConfidence).toBeUndefined();
    expect(typeof desc.producedAt).toBe('string');
  });
});

// ─── P2: Lab snapshot with R3 fail → initialStep 3, circuitActive false ──────

describe('P2 – CircuitScenePlanner: R3 fail → step 3, circuitActive false', () => {
  it('returns ProceduralPlan with initialStep=3 and circuitActive=false when R3 fails', () => {
    const provider = new CircuitUnderstandingProvider();
    const planner = new CircuitScenePlanner();

    const snapshot = makeLabSnapshot('error', [
      { id: 'R3', status: 'fail', title: 'LED has no resistor', fix: 'Add a resistor.' },
    ]);

    const desc = provider.describe(snapshot);
    expect(planner.canPlan(desc)).toBe(true);

    const plan = planner.plan(desc);
    expect(plan.strategy).toBe('procedural');
    if (plan.strategy === 'procedural') {
      expect(plan.sceneId).toBe('led-circuit');
      expect(plan.domain).toBe('circuit');
      expect(plan.initialStep).toBe(3);
      expect(plan.circuitActive).toBe(false);
    }
  });
});

// ─── P3: Lab snapshot all-pass → initialStep 1, circuitActive true ───────────

describe('P3 – CircuitScenePlanner: all rules pass → step 1, circuitActive true', () => {
  it('returns ProceduralPlan with initialStep=1 and circuitActive=true when status is ok', () => {
    const provider = new CircuitUnderstandingProvider();
    const planner = new CircuitScenePlanner();

    const snapshot = makeLabSnapshot('ok', [
      { id: 'R1', status: 'pass', title: 'Battery present' },
      { id: 'R3', status: 'pass', title: 'Resistor present' },
    ]);

    const desc = provider.describe(snapshot);
    const plan = planner.plan(desc);

    expect(plan.strategy).toBe('procedural');
    if (plan.strategy === 'procedural') {
      expect(plan.initialStep).toBe(1);
      expect(plan.circuitActive).toBe(true);
    }
  });

  it('computes detectorMeanConfidence from actual label confidences (0.92 + 0.85 + 0.78 / 3)', () => {
    const provider = new CircuitUnderstandingProvider();
    const snapshot = makeLabSnapshot('ok');
    const desc = provider.describe(snapshot);

    // Mean of 0.92, 0.85, 0.78
    const expected = (0.92 + 0.85 + 0.78) / 3;
    expect(desc.source.detectorMeanConfidence).toBeCloseTo(expected, 5);
  });
});

// ─── P4a: canPlan() returns false for wrong domain ───────────────────────────

describe('P4a – CircuitScenePlanner.canPlan(): returns false for non-circuit domain', () => {
  it('returns false when description.domain is not "circuit"', () => {
    const planner = new CircuitScenePlanner();

    const nonCircuitDesc: SceneDescription<unknown> = {
      domain: 'anatomy',
      payload: { kind: 'anatomy', structures: ['heart'] },
      source: { kind: 'mock' },
      producedAt: new Date().toISOString(),
    };

    expect(planner.canPlan(nonCircuitDesc)).toBe(false);
  });
});

// ─── P4b: Valid circuit description with no usable model → NullPlan ──────────

describe('P4b – CircuitScenePlanner.plan(): null model/ruleOutput → NullPlan', () => {
  it('returns NullPlan when circuitModel is null (gate idle)', () => {
    const provider = new CircuitUnderstandingProvider();
    const planner = new CircuitScenePlanner();

    const snapshot = makeIdleSnapshot();
    const desc = provider.describe(snapshot);

    // canPlan returns true — this is a valid circuit description
    expect(planner.canPlan(desc)).toBe(true);

    // But plan() returns NullPlan because there is no usable model
    const plan = planner.plan(desc);
    expect(plan.strategy).toBe('none');
  });
});

// ─── P5: ProceduralCircuitRenderer.canRender() + render() error on wrong plan ─

describe('P5 – ProceduralCircuitRenderer: canRender and render guard', () => {
  it('returns false for a plan with wrong domain', () => {
    const renderer = new ProceduralCircuitRenderer();

    const wrongDomainPlan = {
      strategy: 'procedural' as const,
      sceneId: 'optics-bench',
      domain: 'optics',
    };

    expect(renderer.canRender(wrongDomainPlan)).toBe(false);
  });

  it('returns false for a NullPlan', () => {
    const renderer = new ProceduralCircuitRenderer();
    expect(renderer.canRender({ strategy: 'none', reason: 'test' })).toBe(false);
  });

  it('throws when render() is called with an incompatible plan', () => {
    const renderer = new ProceduralCircuitRenderer();

    const wrongPlan = {
      strategy: 'procedural' as const,
      sceneId: 'optics-bench',
      domain: 'optics',
    };

    // render() checks canRender() first and throws before touching the DOM.
    // Use a stub cast to avoid document.createElement in a node test environment.
    const stubContainer = {} as HTMLElement;
    expect(() =>
      renderer.render(stubContainer, wrongPlan)
    ).toThrow(/ProceduralCircuitRenderer: incompatible plan/);
  });
});

// ─── P6: runPipeline end-to-end with real providers ──────────────────────────

describe('P6 – runPipeline: end-to-end with CircuitUnderstandingProvider + CircuitScenePlanner', () => {
  it('returns matching CircuitSceneDescription and ProceduralPlan with domain="circuit" throughout', () => {
    const provider = new CircuitUnderstandingProvider();
    const planner = new CircuitScenePlanner();

    const snapshot = makeLabSnapshot('ok', [
      { id: 'R1', status: 'pass', title: 'Battery present' },
    ]);

    const { description, plan } = runPipeline(snapshot, {
      understanding: provider,
      planner,
    });

    // Description
    expect(description.domain).toBe('circuit');
    expect(description.payload.kind).toBe('circuit');
    expect(description.payload.model).not.toBeNull();
    expect(description.payload.ruleOutput).not.toBeNull();

    // Plan
    expect(plan.strategy).toBe('procedural');
    if (plan.strategy === 'procedural') {
      expect(plan.domain).toBe('circuit');
      expect(plan.sceneId).toBe('led-circuit');
    }
  });

  it('returns NullPlan end-to-end when gate is idle', () => {
    const provider = new CircuitUnderstandingProvider();
    const planner = new CircuitScenePlanner();

    const { plan } = runPipeline(makeIdleSnapshot(), {
      understanding: provider,
      planner,
    });

    expect(plan.strategy).toBe('none');
  });
});
