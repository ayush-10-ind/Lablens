/**
 * Pure state controller for the 3D Circuit Guide.
 * Completely decoupled from WebGL and DOM for deterministic testability.
 */

import { LED_CIRCUIT_GUIDE_CONTENT } from './content';
import { GuideContextFocus, GuideControllerState } from './types';
import { RuleEngineOutput } from '../circuit/types';

export class GuideController {
  private state: GuideControllerState;
  private readonly totalSteps: number = LED_CIRCUIT_GUIDE_CONTENT.steps.length;

  constructor(ruleOutput: RuleEngineOutput | null = null) {
    const { focusContext, initialIndex, initialCaption } = this.deriveInitialContext(ruleOutput);
    this.state = {
      currentStepIndex: initialIndex,
      isPlaying: false,
      focusContext,
      activeCaption: initialCaption,
    };
  }

  public getState(): GuideControllerState {
    return { ...this.state };
  }

  public getCurrentStepNumber(): number {
    return this.state.currentStepIndex + 1;
  }

  public next(): void {
    if (this.state.currentStepIndex < this.totalSteps - 1) {
      this.state.currentStepIndex++;
      this.updateCaptionForCurrentStep();
    }
  }

  public previous(): void {
    if (this.state.currentStepIndex > 0) {
      this.state.currentStepIndex--;
      this.updateCaptionForCurrentStep();
    }
  }

  public setStep(index: number): void {
    const clamped = Math.max(0, Math.min(this.totalSteps - 1, index));
    this.state.currentStepIndex = clamped;
    this.updateCaptionForCurrentStep();
  }

  public reset(): void {
    this.state.currentStepIndex = 0;
    this.state.isPlaying = false;
    this.updateCaptionForCurrentStep();
  }

  public togglePlay(): void {
    this.state.isPlaying = !this.state.isPlaying;
  }

  public setPlaying(playing: boolean): void {
    this.state.isPlaying = playing;
  }

  /**
   * Advances step in playback loop (wrapping around to 0 after step 4).
   */
  public advancePlayback(): void {
    this.state.currentStepIndex = (this.state.currentStepIndex + 1) % this.totalSteps;
    this.updateCaptionForCurrentStep();
  }

  private updateCaptionForCurrentStep(): void {
    const step = LED_CIRCUIT_GUIDE_CONTENT.steps[this.state.currentStepIndex];
    this.state.activeCaption = step.caption;
  }

  private deriveInitialContext(ruleOutput: RuleEngineOutput | null): {
    focusContext: GuideContextFocus;
    initialIndex: number;
    initialCaption: string;
  } {
    if (!ruleOutput) {
      return {
        focusContext: 'overview',
        initialIndex: 0,
        initialCaption: LED_CIRCUIT_GUIDE_CONTENT.steps[0].caption,
      };
    }

    // 1. R3 Failure (Missing resistor): focus directly on resistor step
    const hasR3Fail = ruleOutput.results.some((r) => r.id === 'R3' && r.status === 'fail');
    if (hasR3Fail) {
      return {
        focusContext: 'resistor',
        initialIndex: 2, // Step 3 (0-indexed 2)
        initialCaption: LED_CIRCUIT_GUIDE_CONTENT.contextGuidance.r3Fail,
      };
    }

    // 2. R5 Warning (Open loop): loop-focused guidance without presuming switch is the culprit
    const hasR5Warn = ruleOutput.results.some((r) => r.id === 'R5' && r.status === 'warn');
    if (hasR5Warn) {
      return {
        focusContext: 'loop',
        initialIndex: 0,
        initialCaption: LED_CIRCUIT_GUIDE_CONTENT.contextGuidance.r5Warn,
      };
    }

    // 3. Circuit OK: verified overview
    if (ruleOutput.status === 'ok') {
      return {
        focusContext: 'overview',
        initialIndex: 0,
        initialCaption: LED_CIRCUIT_GUIDE_CONTENT.contextGuidance.circuitOk,
      };
    }

    // Default
    return {
      focusContext: 'overview',
      initialIndex: 0,
      initialCaption: LED_CIRCUIT_GUIDE_CONTENT.steps[0].caption,
    };
  }
}
