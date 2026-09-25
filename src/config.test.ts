import { describe, it, expect } from 'vitest';
import { DETECTION_CONFIG, SCENE_GATE_CONFIG, UI_CONFIG, CAMERA_CONFIG } from './config';

describe('LabLens Configuration Contract (docs/rules.md §B6)', () => {
  it('strictly adheres to detection thresholds defined in docs/rules.md §B6', () => {
    // Confidence threshold: 0.45
    expect(DETECTION_CONFIG.CONFIDENCE_THRESHOLD).toBe(0.45);

    // NMS IoU: 0.5
    expect(DETECTION_CONFIG.NMS_IOU_THRESHOLD).toBe(0.5);

    // Stable track: seen in ≥ 3 of last 5 frames
    expect(DETECTION_CONFIG.TRACK_MIN_SEEN_FRAMES).toBe(3);
    expect(DETECTION_CONFIG.TRACK_WINDOW_SIZE).toBe(5);

    // Track expiry: 10 missed frames
    expect(DETECTION_CONFIG.TRACK_EXPIRY_FRAMES).toBe(10);

    // Track association IoU threshold: 0.3
    expect(DETECTION_CONFIG.TRACK_IOU_MATCH_THRESHOLD).toBe(0.3);

    // Box smoothing (EMA α): 0.4
    expect(DETECTION_CONFIG.BOX_SMOOTHING_EMA_ALPHA).toBe(0.4);

    // Low-confidence display threshold: < 0.60
    expect(DETECTION_CONFIG.LOW_CONFIDENCE_THRESHOLD).toBe(0.60);
  });

  it('strictly adheres to scene gate R9 thresholds defined in docs/rules.md §B6', () => {
    // R9 entry: distinct component types ≥ 2
    expect(SCENE_GATE_CONFIG.MIN_DISTINCT_COMPONENT_TYPES).toBe(2);

    // R9 entry: stable frames ≥ 5 consecutive
    expect(SCENE_GATE_CONFIG.MIN_STABLE_FRAMES).toBe(5);

    // R9 exit: no supported components for 3 seconds
    expect(SCENE_GATE_CONFIG.EXIT_TIMEOUT_MS).toBe(3000);

    // Max labels shown when R9 fails: 0 (never label unrecognized objects)
    expect(SCENE_GATE_CONFIG.MAX_LABELS_ON_FAIL).toBe(0);
  });

  it('adheres to UI and assistant limits from docs/rules.md & docs/architecture.md', () => {
    // Status debounce: 500 ms
    expect(UI_CONFIG.STATUS_DEBOUNCE_MS).toBe(500);

    // Not recognized sheet delay: 2000 ms (docs/design.md §3.8, docs/architecture.md §5.0)
    expect(UI_CONFIG.NOT_RECOGNIZED_DELAY_MS).toBe(2000);

    // Target FPS: 10 FPS
    expect(UI_CONFIG.TARGET_FPS).toBe(10);

    // Low FPS threshold: 8 FPS for 3000 ms before Lite mode
    expect(UI_CONFIG.LOW_FPS_THRESHOLD).toBe(8);
    expect(UI_CONFIG.LOW_FPS_DURATION_MS).toBe(3000);

    // Default vs Lite input sizes: 416 and 320
    expect(UI_CONFIG.DEFAULT_INPUT_SIZE).toBe(416);
    expect(UI_CONFIG.LITE_INPUT_SIZE).toBe(320);

    // Assistant question truncated to 300 chars, answers ~60 words
    expect(UI_CONFIG.MAX_QUESTION_LENGTH).toBe(300);
    expect(UI_CONFIG.MAX_ANSWER_WORDS).toBe(60);
  });

  it('adheres to camera configuration constraints from docs/architecture.md §4', () => {
    // Camera facing mode: 'environment' (rear camera)
    expect(CAMERA_CONFIG.FACING_MODE).toBe('environment');

    // Camera ideal resolution: 1280x720
    expect(CAMERA_CONFIG.IDEAL_WIDTH).toBe(1280);
    expect(CAMERA_CONFIG.IDEAL_HEIGHT).toBe(720);

    // Dev calibration test rect within [0, 1] normalized bounds
    expect(CAMERA_CONFIG.DEV_CALIBRATION_RECT.x).toBeGreaterThanOrEqual(0);
    expect(CAMERA_CONFIG.DEV_CALIBRATION_RECT.y).toBeGreaterThanOrEqual(0);
    expect(CAMERA_CONFIG.DEV_CALIBRATION_RECT.x + CAMERA_CONFIG.DEV_CALIBRATION_RECT.width).toBeLessThanOrEqual(1);
    expect(CAMERA_CONFIG.DEV_CALIBRATION_RECT.y + CAMERA_CONFIG.DEV_CALIBRATION_RECT.height).toBeLessThanOrEqual(1);
  });
});
