/**
 * DEVELOPMENT/TEST ONLY: Deterministic mock detector.
 *
 * This adapter produces synthetic, deterministic detections for testing the
 * vision pipeline, tracker, and downstream rule engine before the trained
 * YOLO model is integrated.
 *
 * THIS IS NOT REAL COMPUTER VISION AND DOES NOT PROCESS ACTUAL PIXELS.
 */

import { IDetectorBackend, RawDetection } from './types';

export type FakeScenario = 'canonical_circuit' | 'single_resistor' | 'empty';

export class FakeDetectorBackend implements IDetectorBackend {
  private currentScenario: FakeScenario;

  constructor(initialScenario: FakeScenario = 'canonical_circuit') {
    this.currentScenario = initialScenario;
  }

  public async init(): Promise<void> {
    // No-op for synthetic test backend
  }

  public setScenario(scenario: FakeScenario): void {
    this.currentScenario = scenario;
  }

  public getScenario(): FakeScenario {
    return this.currentScenario;
  }

  /**
   * Returns deterministic RawDetection items according to the active scenario.
   * Coordinates are simulated in a standard 416x416 letterboxed model space.
   */
  public async detect(_input: unknown): Promise<RawDetection[]> {
    switch (this.currentScenario) {
      case 'canonical_circuit':
        // Battery (0), Switch (3), Resistor (1), LED (2) arranged horizontally
        return [
          {
            classIndex: 0, // battery
            confidence: 0.94,
            box: { x: 40, y: 160, w: 70, h: 90 },
          },
          {
            classIndex: 3, // switch
            confidence: 0.91,
            box: { x: 130, y: 175, w: 55, h: 60 },
          },
          {
            classIndex: 1, // resistor
            confidence: 0.88,
            box: { x: 210, y: 180, w: 65, h: 50 },
          },
          {
            classIndex: 2, // led
            confidence: 0.92,
            box: { x: 300, y: 170, w: 50, h: 70 },
          },
        ];

      case 'single_resistor':
        return [
          {
            classIndex: 1, // resistor
            confidence: 0.87,
            box: { x: 180, y: 180, w: 65, h: 50 },
          },
        ];

      case 'empty':
      default:
        return [];
    }
  }
}
