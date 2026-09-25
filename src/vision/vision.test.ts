import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DETECTION_CONFIG } from '../config';
import {
  BoundingBox,
  RawDetection,
  computeLetterboxParams,
  unletterboxBoundingBox,
  normalizeBoundingBox,
  calculateIoU,
  nonMaximumSuppression,
  postprocessDetections,
  smoothEma,
  smoothBoundingBox,
  ObjectTracker,
  FakeDetectorBackend,
  VisionWorkerHandler,
} from './index';

describe('Vision Preprocessing: Letterbox & Coordinate Conversions', () => {
  it('computes correct letterbox scale and symmetric padding for 16:9 frame into 1:1 model', () => {
    // 1280x720 into 416x416
    const letterbox = computeLetterboxParams(1280, 720, 416);

    expect(letterbox.srcWidth).toBe(1280);
    expect(letterbox.srcHeight).toBe(720);
    expect(letterbox.targetSize).toBe(416);

    // Scale is limited by width: 416 / 1280 = 0.325
    expect(letterbox.scale).toBeCloseTo(416 / 1280, 5);

    // Width fits exactly 416, so horizontal padding is 0
    expect(letterbox.padX).toBeCloseTo(0, 5);

    // Height scaled: 720 * 0.325 = 234. Vertical padding: (416 - 234) / 2 = 91
    expect(letterbox.padY).toBeCloseTo(91, 5);
  });

  it('computes correct letterbox scale and symmetric padding for portrait frame into 1:1 model', () => {
    // 720x1280 into 416x416
    const letterbox = computeLetterboxParams(720, 1280, 416);

    // Scale limited by height: 416 / 1280 = 0.325
    expect(letterbox.scale).toBeCloseTo(416 / 1280, 5);
    // Vertical padding is 0
    expect(letterbox.padY).toBeCloseTo(0, 5);
    // Horizontal padding: (416 - 720 * 0.325) / 2 = 91
    expect(letterbox.padX).toBeCloseTo(91, 5);
  });

  it('throws an error for non-positive dimensions', () => {
    expect(() => computeLetterboxParams(0, 720, 416)).toThrow();
    expect(() => computeLetterboxParams(1280, -10, 416)).toThrow();
    expect(() => computeLetterboxParams(1280, 720, 0)).toThrow();
  });

  it('unletterboxes coordinates accurately back to source dimensions and clamps bounds', () => {
    const letterbox = computeLetterboxParams(1280, 720, 416);

    // A box located at model center: [padX, padY, 416, 234] corresponds to full source image
    const modelBox: BoundingBox = {
      x: letterbox.padX,
      y: letterbox.padY,
      w: 416,
      h: 234,
    };

    const sourceBox = unletterboxBoundingBox(modelBox, letterbox);
    expect(sourceBox.x).toBeCloseTo(0, 1);
    expect(sourceBox.y).toBeCloseTo(0, 1);
    expect(sourceBox.w).toBeCloseTo(1280, 1);
    expect(sourceBox.h).toBeCloseTo(720, 1);
  });

  it('normalizes pixel coordinates to [0, 1] relative bounds', () => {
    const pixelBox: BoundingBox = { x: 320, y: 180, w: 640, h: 360 };
    const normBox = normalizeBoundingBox(pixelBox, 1280, 720);

    expect(normBox.x).toBeCloseTo(0.25, 4);
    expect(normBox.y).toBeCloseTo(0.25, 4);
    expect(normBox.w).toBeCloseTo(0.50, 4);
    expect(normBox.h).toBeCloseTo(0.50, 4);
  });
});

describe('Vision Postprocessing: IoU, NMS, and Class Validation', () => {
  it('calculates IoU correctly across identical, overlapping, and disjoint boxes', () => {
    const boxA: BoundingBox = { x: 0, y: 0, w: 100, h: 100 };

    // 1. Identical box -> IoU = 1.0
    expect(calculateIoU(boxA, { ...boxA })).toBeCloseTo(1.0, 5);

    // 2. Disjoint box -> IoU = 0.0
    const disjointBox: BoundingBox = { x: 200, y: 200, w: 50, h: 50 };
    expect(calculateIoU(boxA, disjointBox)).toBe(0.0);

    // 3. Partial overlap
    // boxA area: 100 * 100 = 10,000
    // boxB: { x: 50, y: 0, w: 100, h: 100 }, area = 10,000
    // Intersection: [50, 100] x [0, 100] = 50 * 100 = 5,000
    // Union: 10,000 + 10,000 - 5,000 = 15,000
    // IoU: 5,000 / 15,000 = 1/3 = 0.33333
    const boxB: BoundingBox = { x: 50, y: 0, w: 100, h: 100 };
    expect(calculateIoU(boxA, boxB)).toBeCloseTo(1 / 3, 5);
  });

  it('performs Non-Maximum Suppression (NMS) suppressing duplicate boxes over IoU threshold', () => {
    // Two overlapping candidates of same class
    const highConf = { box: { x: 10, y: 10, w: 50, h: 50 }, confidence: 0.90 };
    const lowConfDuplicate = { box: { x: 12, y: 12, w: 50, h: 50 }, confidence: 0.70 };
    const distantValid = { box: { x: 200, y: 200, w: 50, h: 50 }, confidence: 0.85 };

    const result = nonMaximumSuppression([lowConfDuplicate, distantValid, highConf], 0.5);

    expect(result).toHaveLength(2);
    expect(result).toContain(highConf);
    expect(result).toContain(distantValid);
    expect(result).not.toContain(lowConfDuplicate);
  });

  it('filters out raw detections below DETECTION_CONFIG.CONFIDENCE_THRESHOLD', () => {
    const letterbox = computeLetterboxParams(1280, 720, 416);
    const raw: RawDetection[] = [
      {
        classIndex: 1, // resistor
        confidence: DETECTION_CONFIG.CONFIDENCE_THRESHOLD - 0.05, // e.g. 0.40 -> below threshold
        box: { x: 50, y: 50, w: 50, h: 50 },
      },
      {
        classIndex: 1, // resistor
        confidence: DETECTION_CONFIG.CONFIDENCE_THRESHOLD + 0.10, // e.g. 0.55 -> passes
        box: { x: 50, y: 50, w: 50, h: 50 },
      },
    ];

    const processed = postprocessDetections(raw, letterbox);
    expect(processed).toHaveLength(1);
    expect(processed[0].type).toBe('resistor');
    expect(processed[0].confidence).toBeCloseTo(DETECTION_CONFIG.CONFIDENCE_THRESHOLD + 0.10, 4);
  });

  it('strictly filters out unknown/unsupported class indices', () => {
    const letterbox = computeLetterboxParams(1280, 720, 416);
    const raw: RawDetection[] = [
      {
        classIndex: 999, // unsupported unknown class
        confidence: 0.95,
        box: { x: 50, y: 50, w: 50, h: 50 },
      },
      {
        classIndex: 2, // led (valid)
        confidence: 0.90,
        box: { x: 100, y: 100, w: 50, h: 50 },
      },
    ];

    const processed = postprocessDetections(raw, letterbox);
    expect(processed).toHaveLength(1);
    expect(processed[0].type).toBe('led');
  });

  it('maintains class separation during NMS (overlapping boxes of DIFFERENT classes are NOT suppressed)', () => {
    const letterbox = computeLetterboxParams(1280, 720, 416);
    const raw: RawDetection[] = [
      {
        classIndex: 0, // battery
        confidence: 0.90,
        box: { x: 50, y: 50, w: 100, h: 100 },
      },
      {
        classIndex: 3, // switch (overlapping in same region)
        confidence: 0.85,
        box: { x: 55, y: 55, w: 100, h: 100 },
      },
    ];

    const processed = postprocessDetections(raw, letterbox);
    // Both must be preserved because they are different classes
    expect(processed).toHaveLength(2);
    const types = processed.map((p) => p.type).sort();
    expect(types).toEqual(['battery', 'switch']);
  });
});

describe('Vision Tracker: Association, Smoothing, Stability, and Expiry', () => {
  let tracker: ObjectTracker;

  beforeEach(() => {
    tracker = new ObjectTracker();
  });

  it('computes EMA smoothing accurately', () => {
    // alpha = 0.4
    // smoothEma(newValue = 100, prevValue = 50, alpha = 0.4) = 0.4 * 100 + 0.6 * 50 = 40 + 30 = 70
    const smoothed = smoothEma(100, 50, 0.4);
    expect(smoothed).toBe(70);

    const prevBox: BoundingBox = { x: 10, y: 20, w: 50, h: 60 };
    const newBox: BoundingBox = { x: 20, y: 30, w: 60, h: 70 };
    const smoothedBox = smoothBoundingBox(newBox, prevBox, 0.4);

    expect(smoothedBox.x).toBe(14);
    expect(smoothedBox.y).toBe(24);
    expect(smoothedBox.w).toBe(54);
    expect(smoothedBox.h).toBe(64);
  });

  it('associates matching detections by IoU and smooths coordinates', () => {
    const frame1 = [
      {
        type: 'resistor' as const,
        confidence: 0.90,
        box: { x: 100, y: 100, w: 50, h: 50 },
        normalizedBox: { x: 0.1, y: 0.1, w: 0.05, h: 0.05 },
      },
    ];

    const tracks1 = tracker.update(frame1);
    expect(tracks1).toHaveLength(1);
    const trackId = tracks1[0].id;
    expect(tracks1[0].box).toEqual({ x: 100, y: 100, w: 50, h: 50 });
    expect(tracks1[0].seenCount).toBe(1);

    // Frame 2: slight movement in box
    const frame2 = [
      {
        type: 'resistor' as const,
        confidence: 0.90,
        box: { x: 110, y: 100, w: 50, h: 50 },
        normalizedBox: { x: 0.11, y: 0.1, w: 0.05, h: 0.05 },
      },
    ];

    const tracks2 = tracker.update(frame2);
    expect(tracks2).toHaveLength(1);
    expect(tracks2[0].id).toBe(trackId); // same track preserved!
    expect(tracks2[0].seenCount).toBe(2);

    // EMA smoothing: 0.4 * 110 + 0.6 * 100 = 44 + 60 = 104
    expect(tracks2[0].box.x).toBeCloseTo(104, 2);
  });

  it('marks track as isStable only after being seen in >= 3 of last 5 frames', () => {
    const det = {
      type: 'led' as const,
      confidence: 0.95,
      box: { x: 200, y: 200, w: 40, h: 40 },
      normalizedBox: { x: 0.2, y: 0.2, w: 0.04, h: 0.04 },
    };

    // Frame 1: seen 1/1 -> not stable (need >= 3)
    let tracks = tracker.update([det]);
    expect(tracks[0].isStable).toBe(false);

    // Frame 2: seen 2/2 -> not stable
    tracks = tracker.update([det]);
    expect(tracks[0].isStable).toBe(false);

    // Frame 3: seen 3/3 -> STABLE!
    tracks = tracker.update([det]);
    expect(tracks[0].isStable).toBe(true);

    // Frame 4: missed frame -> history [true, true, true, false] -> 3/4 -> still stable
    tracks = tracker.update([]);
    expect(tracks[0].isStable).toBe(true);

    // Frame 5: missed frame -> history [true, true, true, false, false] -> 3/5 -> still stable
    tracks = tracker.update([]);
    expect(tracks[0].isStable).toBe(true);

    // Frame 6: missed frame -> history pushes false, shifts true -> [true, true, false, false, false] -> 2/5 -> UNSTABLE!
    tracks = tracker.update([]);
    expect(tracks[0].isStable).toBe(false);
  });

  it('expires and removes a track after exactly 10 consecutive missed frames', () => {
    const det = {
      type: 'battery' as const,
      confidence: 0.90,
      box: { x: 50, y: 50, w: 80, h: 100 },
      normalizedBox: { x: 0.05, y: 0.05, w: 0.08, h: 0.1 },
    };

    tracker.update([det]);
    expect(tracker.getTracks()).toHaveLength(1);

    // Miss 9 consecutive frames -> track should still exist with consecutiveMisses = 9
    for (let i = 1; i <= 9; i++) {
      const tracks = tracker.update([]);
      expect(tracks).toHaveLength(1);
      expect(tracks[0].consecutiveMisses).toBe(i);
    }

    // 10th missed frame (TRACK_EXPIRY_FRAMES = 10) -> track expires and is removed!
    const finalTracks = tracker.update([]);
    expect(finalTracks).toHaveLength(0);
    expect(tracker.getTracks()).toHaveLength(0);
  });

  it('resets tracks completely when reset() is called', () => {
    const det = {
      type: 'switch' as const,
      confidence: 0.90,
      box: { x: 100, y: 100, w: 50, h: 50 },
      normalizedBox: { x: 0.1, y: 0.1, w: 0.05, h: 0.05 },
    };

    tracker.update([det]);
    expect(tracker.getTracks()).toHaveLength(1);

    tracker.reset();
    expect(tracker.getTracks()).toHaveLength(0);
  });
});

describe('FakeDetectorBackend (DEVELOPMENT/TEST ONLY)', () => {
  it('produces deterministic synthetic detections for canonical_circuit scenario', async () => {
    const backend = new FakeDetectorBackend('canonical_circuit');
    const detections = await backend.detect(null);

    expect(detections).toHaveLength(4);
    const classes = detections.map((d) => d.classIndex).sort();
    // 0: battery, 1: resistor, 2: led, 3: switch
    expect(classes).toEqual([0, 1, 2, 3]);
  });

  it('produces deterministic synthetic detections for single_resistor scenario', async () => {
    const backend = new FakeDetectorBackend('single_resistor');
    const detections = await backend.detect(null);

    expect(detections).toHaveLength(1);
    expect(detections[0].classIndex).toBe(1); // resistor
  });

  it('produces empty detections for empty scenario', async () => {
    const backend = new FakeDetectorBackend('empty');
    const detections = await backend.detect(null);

    expect(detections).toHaveLength(0);
  });
});

describe('VisionWorkerHandler: Worker Concurrency & Pipeline Orchestration', () => {
  it('initializes backend and resets tracker on INIT message', async () => {
    const handler = new VisionWorkerHandler();
    const response = await handler.handleMessage({
      type: 'INIT',
      config: { fakeScenario: 'single_resistor' },
    });

    expect(response).toEqual({ type: 'INIT_SUCCESS' });
    expect(handler.getIsBusy()).toBe(false);
  });

  it('processes a frame end-to-end and returns worker-owned TrackedDetection[]', async () => {
    const handler = new VisionWorkerHandler();
    await handler.handleMessage({ type: 'INIT', config: { fakeScenario: 'canonical_circuit' } });

    const response = await handler.handleMessage({
      type: 'PROCESS_FRAME',
      frameId: 101,
      timestamp: 123456789,
      sourceWidth: 1280,
      sourceHeight: 720,
    });

    expect(response?.type).toBe('FRAME_PROCESSED');
    if (response?.type === 'FRAME_PROCESSED') {
      expect(response.frameId).toBe(101);
      expect(response.timestamp).toBe(123456789);
      expect(response.inferenceDurationMs).toBeGreaterThanOrEqual(0);
      expect(response.trackedDetections).toHaveLength(4);

      // Verify that tracked detections are populated with IDs and smoothed bounds
      const types = response.trackedDetections.map((d) => d.type).sort();
      expect(types).toEqual(['battery', 'led', 'resistor', 'switch']);
      expect(response.trackedDetections[0].id).toMatch(/^track_/);
    }
  });

  it('drops incoming frames immediately with FRAME_DROPPED when worker is busy', async () => {
    // Create a mock detector whose detect() hangs until resolved
    let finishDetect: () => void;
    const slowDetector = {
      init: vi.fn().mockResolvedValue(undefined),
      detect: vi.fn().mockImplementation(
        () =>
          new Promise<RawDetection[]>((resolve) => {
            finishDetect = () => resolve([]);
          })
      ),
    };

    const handler = new VisionWorkerHandler({ detector: slowDetector });
    await handler.handleMessage({ type: 'INIT' });

    // Send first frame (will hang inside detect)
    const frame1Promise = handler.handleMessage({
      type: 'PROCESS_FRAME',
      frameId: 1,
      timestamp: 1000,
      sourceWidth: 1280,
      sourceHeight: 720,
    });

    // While frame 1 is in-flight, send frame 2
    const frame2Response = await handler.handleMessage({
      type: 'PROCESS_FRAME',
      frameId: 2,
      timestamp: 1050,
      sourceWidth: 1280,
      sourceHeight: 720,
    });

    // Frame 2 must be dropped immediately!
    expect(frame2Response).toEqual({
      type: 'FRAME_DROPPED',
      frameId: 2,
      reason: 'busy',
    });

    // Now complete frame 1
    finishDetect!();
    const frame1Response = await frame1Promise;
    expect(frame1Response?.type).toBe('FRAME_PROCESSED');
  });

  it('closes transferred ImageBitmap when frame is dropped or finished', async () => {
    let finishDetect: () => void;
    const slowDetector = {
      init: vi.fn().mockResolvedValue(undefined),
      detect: vi.fn().mockImplementation(
        () =>
          new Promise<RawDetection[]>((resolve) => {
            finishDetect = () => resolve([]);
          })
      ),
    };

    const handler = new VisionWorkerHandler({ detector: slowDetector });
    await handler.handleMessage({ type: 'INIT' });

    const mockBitmap1 = { close: vi.fn() } as unknown as ImageBitmap;
    const mockBitmap2 = { close: vi.fn() } as unknown as ImageBitmap;

    // Start frame 1
    const frame1Promise = handler.handleMessage({
      type: 'PROCESS_FRAME',
      frameId: 1,
      timestamp: 1000,
      sourceWidth: 1280,
      sourceHeight: 720,
      imageBitmap: mockBitmap1,
    });

    // Send frame 2 while busy
    await handler.handleMessage({
      type: 'PROCESS_FRAME',
      frameId: 2,
      timestamp: 1050,
      sourceWidth: 1280,
      sourceHeight: 720,
      imageBitmap: mockBitmap2,
    });

    // Frame 2 dropped -> mockBitmap2 closed immediately
    expect(mockBitmap2.close).toHaveBeenCalledTimes(1);

    // Frame 1 finished -> mockBitmap1 closed in finally
    finishDetect!();
    await frame1Promise;
    expect(mockBitmap1.close).toHaveBeenCalledTimes(1);
  });

  it('deterministically triggers busy drop when simulateDelayMs is provided on back-to-back frames', async () => {
    const handler = new VisionWorkerHandler();
    await handler.handleMessage({ type: 'INIT', config: { fakeScenario: 'canonical_circuit' } });

    const mockBitmap1 = { close: vi.fn() } as unknown as ImageBitmap;
    const mockBitmap2 = { close: vi.fn() } as unknown as ImageBitmap;

    // Dispatch Frame 1 with simulateDelayMs: 60
    const frame1Promise = handler.handleMessage({
      type: 'PROCESS_FRAME',
      frameId: 201,
      timestamp: 1000,
      sourceWidth: 1280,
      sourceHeight: 720,
      imageBitmap: mockBitmap1,
      simulateDelayMs: 60,
    });

    // Immediately dispatch Frame 2 while Frame 1 is delayed
    const frame2Promise = handler.handleMessage({
      type: 'PROCESS_FRAME',
      frameId: 202,
      timestamp: 1005,
      sourceWidth: 1280,
      sourceHeight: 720,
      imageBitmap: mockBitmap2,
    });

    const [frame1Result, frame2Result] = await Promise.all([frame1Promise, frame2Promise]);

    // Frame 1 was processed
    expect(frame1Result?.type).toBe('FRAME_PROCESSED');
    if (frame1Result?.type === 'FRAME_PROCESSED') {
      expect(frame1Result.frameId).toBe(201);
      expect(frame1Result.trackedDetections).toHaveLength(4);
    }
    expect(mockBitmap1.close).toHaveBeenCalledTimes(1);

    // Frame 2 was deterministically dropped as busy
    expect(frame2Result).toEqual({
      type: 'FRAME_DROPPED',
      frameId: 202,
      reason: 'busy',
    });
    expect(mockBitmap2.close).toHaveBeenCalledTimes(1);

    // Worker is ready for subsequent frames
    expect(handler.getIsBusy()).toBe(false);
  });
});
