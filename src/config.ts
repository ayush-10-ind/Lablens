/**
 * Configuration thresholds for LabLens.
 * Derived strictly from docs/rules.md Section B6 and docs/architecture.md.
 * No magic numbers should exist in pipeline modules; reference these constants.
 */

export const DETECTION_CONFIG = {
  /** Minimum confidence threshold for raw detections (default: 0.45) */
  CONFIDENCE_THRESHOLD: 0.45,

  /** Intersection over Union threshold for Non-Maximum Suppression (default: 0.5) */
  NMS_IOU_THRESHOLD: 0.5,

  /** Exponential Moving Average smoothing factor for bounding boxes (alpha: 0.4) */
  BOX_SMOOTHING_EMA_ALPHA: 0.4,

  /** Minimum frames a track must be detected in within the window to be considered stable (≥ 3 of last 5) */
  TRACK_MIN_SEEN_FRAMES: 3,

  /** Sliding window size for track stability evaluation */
  TRACK_WINDOW_SIZE: 5,

  /** Number of consecutive missed frames before a track expires */
  TRACK_EXPIRY_FRAMES: 10,

  /** IoU threshold for matching candidate detections to existing tracks */
  TRACK_IOU_MATCH_THRESHOLD: 0.3,

  /** Detections with confidence below this threshold show dashed outline and '?' */
  LOW_CONFIDENCE_THRESHOLD: 0.60,
} as const;

export const SCENE_GATE_CONFIG = {
  /** Minimum distinct supported component types required to pass Rule R9 entry gate */
  MIN_DISTINCT_COMPONENT_TYPES: 2,

  /** Minimum consecutive frames required for R9 entry gate stability */
  MIN_STABLE_FRAMES: 5,

  /** Milliseconds with no supported components before exiting lab mode (3 seconds) */
  EXIT_TIMEOUT_MS: 3000,

  /** Maximum labels displayed when R9 gate fails */
  MAX_LABELS_ON_FAIL: 0,
} as const;

export const UI_CONFIG = {
  /** Debounce delay before circuit status change is committed (500 ms) */
  STATUS_DEBOUNCE_MS: 500,

  /** Target frame rate in FPS (approx 10 FPS = 100ms per frame) */
  TARGET_FPS: 10,

  /** FPS threshold below which Lite mode is suggested/activated */
  LOW_FPS_THRESHOLD: 8,

  /** Duration of low FPS before switching to Lite mode (3 seconds) */
  LOW_FPS_DURATION_MS: 3000,

  /** Default model input resolution (width and height in px) */
  DEFAULT_INPUT_SIZE: 416,

  /** Lite mode model input resolution (width and height in px) */
  LITE_INPUT_SIZE: 320,

  /** Assistant question max character length (docs/rules.md Part C) */
  MAX_QUESTION_LENGTH: 300,

  /** Assistant answer target word count limit */
  MAX_ANSWER_WORDS: 60,
} as const;

export const CAMERA_CONFIG = {
  /** Preferred facing mode: rear/environment camera (docs/architecture.md §4) */
  FACING_MODE: 'environment',

  /** Ideal capture width in pixels (docs/architecture.md §4) */
  IDEAL_WIDTH: 1280,

  /** Ideal capture height in pixels (docs/architecture.md §4) */
  IDEAL_HEIGHT: 720,

  /** Normalized coordinates for the SVG dev calibration test rectangle [0.0, 1.0] */
  DEV_CALIBRATION_RECT: {
    x: 0.15,
    y: 0.25,
    width: 0.70,
    height: 0.50,
  },
} as const;
