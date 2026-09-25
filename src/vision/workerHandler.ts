/**
 * Core message handling and pipeline orchestration for the vision Web Worker.
 *
 * Owns:
 * - Detector backend
 * - Object tracker
 * - Single-frame concurrency gate (busy -> drop incoming frames immediately)
 *
 * Implements the pipeline:
 * Frame -> Preprocess -> Detector -> Postprocess/NMS -> Tracker -> TrackedDetection[]
 */

import { UI_CONFIG } from '../config';
import { FakeDetectorBackend } from './fakeDetector';
import { computeLetterboxParams } from './preprocess';
import { postprocessDetections } from './postprocess';
import { ObjectTracker } from './tracker';
import {
  IDetectorBackend,
  VisionWorkerRequest,
  VisionWorkerResponse,
} from './types';

export interface WorkerHandlerOptions {
  detector?: IDetectorBackend;
  tracker?: ObjectTracker;
  modelInputSize?: number;
}

export class VisionWorkerHandler {
  private detector: IDetectorBackend;
  private tracker: ObjectTracker;
  private modelInputSize: number;
  private isBusy = false;

  constructor(options: WorkerHandlerOptions = {}) {
    this.detector = options.detector ?? new FakeDetectorBackend();
    this.tracker = options.tracker ?? new ObjectTracker();
    this.modelInputSize = options.modelInputSize ?? UI_CONFIG.DEFAULT_INPUT_SIZE;
  }

  public getIsBusy(): boolean {
    return this.isBusy;
  }

  public getTracker(): ObjectTracker {
    return this.tracker;
  }

  public getDetector(): IDetectorBackend {
    return this.detector;
  }

  public async handleMessage(
    message: VisionWorkerRequest
  ): Promise<VisionWorkerResponse | null> {
    switch (message.type) {
      case 'INIT': {
        if (message.config?.modelInputSize) {
          this.modelInputSize = message.config.modelInputSize;
        }
        if (message.config?.fakeScenario && this.detector instanceof FakeDetectorBackend) {
          this.detector.setScenario(message.config.fakeScenario);
        }
        await this.detector.init();
        this.tracker.reset();
        this.isBusy = false;
        return { type: 'INIT_SUCCESS' };
      }

      case 'SET_SCENARIO': {
        if (this.detector instanceof FakeDetectorBackend) {
          this.detector.setScenario(message.scenario);
        }
        return null;
      }

      case 'RESET_TRACKER': {
        this.tracker.reset();
        return null;
      }

      case 'PROCESS_FRAME': {
        // Concurrency rule: process only 1 frame at a time; drop when busy
        if (this.isBusy) {
          // Release transferred bitmap if any to prevent memory leaks
          if (message.imageBitmap && typeof message.imageBitmap.close === 'function') {
            try {
              message.imageBitmap.close();
            } catch {
              // Ignore close error
            }
          }

          return {
            type: 'FRAME_DROPPED',
            frameId: message.frameId,
            reason: 'busy',
          };
        }

        this.isBusy = true;
        const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

        try {
          const { sourceWidth, sourceHeight, frameId, timestamp, imageBitmap, simulateDelayMs } = message;

          // Dev/test-only simulated delay if explicitly requested to verify worker busy/drop behavior
          if (simulateDelayMs && simulateDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, simulateDelayMs));
          }

          // 1. Preprocessing parameters (letterbox)
          const letterbox = computeLetterboxParams(sourceWidth, sourceHeight, this.modelInputSize);

          // 2. Detection (detector backend)
          const rawDetections = await this.detector.detect(imageBitmap);

          // 3. Postprocessing & NMS
          const processedDetections = postprocessDetections(rawDetections, letterbox);

          // 4. Tracking, EMA smoothing & stability (worker-owned)
          const trackedDetections = this.tracker.update(processedDetections);

          const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const duration = Math.round(endTime - startTime);

          return {
            type: 'FRAME_PROCESSED',
            frameId,
            timestamp,
            inferenceDurationMs: duration,
            trackedDetections,
          };
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          return {
            type: 'ERROR',
            frameId: message.frameId,
            message: errorMsg,
          };
        } finally {
          if (message.imageBitmap && typeof message.imageBitmap.close === 'function') {
            try {
              message.imageBitmap.close();
            } catch {
              // Ignore close error
            }
          }
          this.isBusy = false;
        }
      }

      default:
        return null;
    }
  }
}
