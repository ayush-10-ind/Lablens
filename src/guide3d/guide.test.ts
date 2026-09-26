import { describe, it, expect } from 'vitest';
import { GuideController } from './guideController';
import { LED_CIRCUIT_GUIDE_CONTENT } from './content';
import { RuleEngineOutput } from '../circuit/types';

describe('3D Guide Controller & Context Mapping (GuideController)', () => {
  it('1. Step navigation and clamping (1 to 4)', () => {
    const controller = new GuideController(null);
    expect(controller.getCurrentStepNumber()).toBe(1);

    controller.next();
    expect(controller.getCurrentStepNumber()).toBe(2);

    controller.next();
    expect(controller.getCurrentStepNumber()).toBe(3);

    controller.next();
    expect(controller.getCurrentStepNumber()).toBe(4);

    // Clamping at upper bound (max 4)
    controller.next();
    expect(controller.getCurrentStepNumber()).toBe(4);

    controller.previous();
    expect(controller.getCurrentStepNumber()).toBe(3);

    controller.previous();
    controller.previous();
    expect(controller.getCurrentStepNumber()).toBe(1);

    // Clamping at lower bound (min 1)
    controller.previous();
    expect(controller.getCurrentStepNumber()).toBe(1);
  });

  it('2. Reset function restores step 1 and pauses playback', () => {
    const controller = new GuideController(null);
    controller.setStep(3);
    controller.setPlaying(true);

    controller.reset();
    expect(controller.getCurrentStepNumber()).toBe(1);
    expect(controller.getState().isPlaying).toBe(false);
  });

  it('3. Playback state toggle and cyclic step advancement', () => {
    const controller = new GuideController(null);
    expect(controller.getState().isPlaying).toBe(false);

    controller.togglePlay();
    expect(controller.getState().isPlaying).toBe(true);

    // Step 1 -> 2 -> 3 -> 4 -> 1
    controller.advancePlayback();
    expect(controller.getCurrentStepNumber()).toBe(2);
    controller.advancePlayback();
    expect(controller.getCurrentStepNumber()).toBe(3);
    controller.advancePlayback();
    expect(controller.getCurrentStepNumber()).toBe(4);
    controller.advancePlayback();
    expect(controller.getCurrentStepNumber()).toBe(1);
  });

  it('4. Context mapping: R3 failure opens resistor-focused guidance', () => {
    const r3FailOutput: RuleEngineOutput = {
      status: 'error',
      results: [
        {
          id: 'R3',
          status: 'fail',
          title: 'LED has no resistor',
          message: 'The LED is connected without a current-limiting resistor.',
          fix: 'Connect a resistor in series with the LED to limit current.',
        },
      ],
    };

    const controller = new GuideController(r3FailOutput);
    const state = controller.getState();

    expect(state.focusContext).toBe('resistor');
    expect(controller.getCurrentStepNumber()).toBe(3); // Step 3: Resistor
    expect(state.activeCaption).toBe("Place a resistor in series with the LED so it isn't overloaded.");
  });

  it('5. Context mapping: R5 warning opens loop-focused guidance without blaming switch', () => {
    const r5WarnOutput: RuleEngineOutput = {
      status: 'warning',
      results: [
        {
          id: 'R5',
          status: 'warn',
          title: 'The loop is incomplete.',
          message: 'Battery and at least one load (LED) are not in a closed loop.',
          fix: 'Connect the parts in a loop back to the battery.',
        },
      ],
    };

    const controller = new GuideController(r5WarnOutput);
    const state = controller.getState();

    expect(state.focusContext).toBe('loop');
    expect(state.activeCaption).toBe('Connect the parts in a continuous loop back to the battery.');
    // Must NOT claim the switch is the cause
    expect(state.activeCaption.toLowerCase()).not.toContain('switch');
  });

  it('6. Context mapping: Circuit OK opens verified overview', () => {
    const okOutput: RuleEngineOutput = {
      status: 'ok',
      results: [
        { id: 'R1', status: 'pass', title: 'Battery present' },
        { id: 'R2', status: 'pass', title: 'Loads present' },
        { id: 'R3', status: 'pass', title: 'LED has series resistor' },
      ],
    };

    const controller = new GuideController(okOutput);
    const state = controller.getState();

    expect(state.focusContext).toBe('overview');
    expect(controller.getCurrentStepNumber()).toBe(1);
    expect(state.activeCaption).toBe(
      'Circuit complete: current flows through the series path and illuminates the LED.'
    );
  });
});

describe('3D Guide Educational Content & Electrical Language Rules', () => {
  it('7. Content definition matches required static library structure', () => {
    expect(LED_CIRCUIT_GUIDE_CONTENT.id).toBe('led-circuit');
    expect(LED_CIRCUIT_GUIDE_CONTENT.title).toBe('LED Circuit Guide');
    expect(LED_CIRCUIT_GUIDE_CONTENT.steps).toHaveLength(4);

    const componentIds = LED_CIRCUIT_GUIDE_CONTENT.steps.map((s) => s.componentId);
    expect(componentIds).toEqual(['battery', 'switch', 'resistor', 'led']);
  });

  it('8. Enforces required electrical wording: "in series with the LED"', () => {
    const r3Guidance = LED_CIRCUIT_GUIDE_CONTENT.contextGuidance.r3Fail;
    expect(r3Guidance).toContain('resistor in series with the LED');

    const resistorStep = LED_CIRCUIT_GUIDE_CONTENT.steps.find((s) => s.componentId === 'resistor');
    expect(resistorStep?.caption).toContain('in series with the LED');
  });

  it('9. Strictly forbids directional requirement wording ("must come before", "comes before")', () => {
    const allText = [
      LED_CIRCUIT_GUIDE_CONTENT.contextGuidance.r3Fail,
      LED_CIRCUIT_GUIDE_CONTENT.contextGuidance.r5Warn,
      LED_CIRCUIT_GUIDE_CONTENT.contextGuidance.circuitOk,
      ...LED_CIRCUIT_GUIDE_CONTENT.steps.map((s) => s.caption),
    ].join(' ');

    expect(allText).not.toContain('must come before');
    expect(allText).not.toContain('must precede');
    expect(allText).not.toContain('comes before');
  });

  it('10. Procedural scene geometry budget is strictly below 2,500 vertices', async () => {
    const { countProceduralSceneVertices } = await import('./scene');
    const vertexCount = countProceduralSceneVertices();

    expect(vertexCount).toBeGreaterThan(500); // Verify geometry was counted
    expect(vertexCount).toBeLessThan(2500); // Verify strictly within budget
  });
});
