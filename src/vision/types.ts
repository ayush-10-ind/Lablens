/**
 * Types and interfaces for the LabLens vision pipeline.
 * Derived strictly from docs/architecture.md §4 and docs/rules.md §B6.
 */

// 1. Supported circuit component classes (docs/architecture.md §4 & §5.1)
export type ComponentType = 'battery' | 'resistor' | 'led' | 'switch' | 'breadboard';

export const SUPPORTED_COMPONENT_TYPES: readonly ComponentType[] = [
  'battery',
  'resistor',
  'led',
  'switch',
  'breadboard',
] as const;

/**
 * Mapping from model class index to supported ComponentType.
 * Any index not in this mapping is unsupported and must be filtered out.
 */
export const CLASS_INDEX_TO_COMPONENT: Readonly<Record<number, ComponentType>> = {
  0: 'battery',
  1: 'resistor',
  2: 'led',
  3: 'switch',
  4: 'breadboard',
};

// 2. Bounding Box in coordinates (can be pixel or normalized [0, 1])
export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 3. Raw output from inference/detector (before NMS, filtering, and tracking)
export interface RawDetection {
  classIndex: number;
  confidence: number;
  box: BoundingBox; // in model space (e.g. 416x416 letterboxed)
}

// 4. Postprocessed detection (after confidence filtering, NMS, class mapping, and un-letterboxing)
export interface ProcessedDetection {
  type: ComponentType;
  confidence: number;
  box: BoundingBox;           // in original camera frame pixel coordinates
  normalizedBox: BoundingBox;    // in [0, 1] relative coordinates for responsive SVG/canvas
}

// 5. Tracked detection state (output of tracker/smoother)
export interface TrackedDetection {
  id: string;                 // unique track id (e.g. "track_1")
  type: ComponentType;
  confidence: number;
  box: BoundingBox;           // smoothed bounding box in original frame pixel coordinates
  normalizedBox: BoundingBox;    // smoothed bounding box in [0, 1] normalized coordinates
  isStable: boolean;          // seen in >= 3 of last 5 frames
  consecutiveMisses: number;  // incremented when unmatched in a frame
  seenCount: number;          // total lifetime matched frame count
  history: boolean[];         // sliding window boolean history (size TRACK_WINDOW_SIZE)
}

// 6. Letterbox transformation parameters
export interface LetterboxInfo {
  targetSize: number;
  scale: number;
  padX: number;
  padY: number;
  srcWidth: number;
  srcHeight: number;
}

// 7. Generic detector backend contract
export interface IDetectorBackend {
  init(): Promise<void>;
  detect(input: unknown): Promise<RawDetection[]>;
}

// 8. Worker Message Protocols
export type VisionWorkerRequest =
  | {
      type: 'INIT';
      config?: {
        modelInputSize?: number;
        useFakeDetector?: boolean;
        fakeScenario?: 'canonical_circuit' | 'single_resistor' | 'empty';
      };
    }
  | {
      type: 'PROCESS_FRAME';
      frameId: number;
      timestamp: number;
      imageBitmap?: ImageBitmap;
      sourceWidth: number;
      sourceHeight: number;
      simulateDelayMs?: number;
    }
  | {
      type: 'SET_SCENARIO';
      scenario: 'canonical_circuit' | 'single_resistor' | 'empty';
    }
  | {
      type: 'RESET_TRACKER';
    };

export type VisionWorkerResponse =
  | {
      type: 'INIT_SUCCESS';
    }
  | {
      type: 'FRAME_DROPPED';
      frameId: number;
      reason: 'busy';
    }
  | {
      type: 'FRAME_PROCESSED';
      frameId: number;
      timestamp: number;
      inferenceDurationMs: number;
      trackedDetections: TrackedDetection[]; // Worker owns tracking and returns TrackedDetection[]
    }
  | {
      type: 'ERROR';
      frameId?: number;
      message: string;
    };
