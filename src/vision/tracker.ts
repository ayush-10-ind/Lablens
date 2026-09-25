/**
 * Multi-object tracking and box smoothing for LabLens.
 * Derived strictly from docs/architecture.md §4 and docs/rules.md §B6.
 *
 * Implements:
 * - IoU-based track association
 * - Exponential Moving Average (EMA) coordinate smoothing
 * - Sliding window track stability (>= 3 of last 5 frames)
 * - Missed-frame track expiry (10 consecutive missed frames)
 */

import { DETECTION_CONFIG } from '../config';
import { BoundingBox, ProcessedDetection, TrackedDetection } from './types';
import { calculateIoU } from './postprocess';

/**
 * Applies Exponential Moving Average (EMA) to smooth a single numerical value.
 * newValue * alpha + prevValue * (1 - alpha)
 */
export function smoothEma(
  newValue: number,
  prevValue: number,
  alpha = DETECTION_CONFIG.BOX_SMOOTHING_EMA_ALPHA
): number {
  return alpha * newValue + (1 - alpha) * prevValue;
}

/**
 * Applies EMA smoothing to all coordinates of a bounding box.
 */
export function smoothBoundingBox(
  newBox: BoundingBox,
  prevBox: BoundingBox,
  alpha = DETECTION_CONFIG.BOX_SMOOTHING_EMA_ALPHA
): BoundingBox {
  return {
    x: smoothEma(newBox.x, prevBox.x, alpha),
    y: smoothEma(newBox.y, prevBox.y, alpha),
    w: smoothEma(newBox.w, prevBox.w, alpha),
    h: smoothEma(newBox.h, prevBox.h, alpha),
  };
}

export class ObjectTracker {
  private tracks: Map<string, TrackedDetection> = new Map();
  private nextTrackId = 1;

  /**
   * Clears all active tracks and resets track ID sequence.
   */
  public reset(): void {
    this.tracks.clear();
    this.nextTrackId = 1;
  }

  /**
   * Returns current snapshot of active tracks.
   */
  public getTracks(): TrackedDetection[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Updates tracker state with a new frame's processed detections.
   * Performs IoU association, EMA smoothing, stability updates, and expiry.
   *
   * @param detections Postprocessed detections from the current frame.
   * @returns List of active tracks after update.
   */
  public update(detections: ProcessedDetection[]): TrackedDetection[] {
    const matchedTrackIds = new Set<string>();
    const matchedDetectionIndices = new Set<number>();

    // Step 1: Greedy IoU matching by class type
    const candidatePairs: {
      trackId: string;
      detectionIndex: number;
      iou: number;
    }[] = [];

    for (const [trackId, track] of this.tracks.entries()) {
      detections.forEach((detection, detIdx) => {
        if (track.type === detection.type) {
          const iou = calculateIoU(track.box, detection.box);
          if (iou >= DETECTION_CONFIG.TRACK_IOU_MATCH_THRESHOLD) {
            candidatePairs.push({ trackId, detectionIndex: detIdx, iou });
          }
        }
      });
    }

    // Sort candidate pairs descending by IoU
    candidatePairs.sort((a, b) => b.iou - a.iou);

    for (const pair of candidatePairs) {
      if (
        matchedTrackIds.has(pair.trackId) ||
        matchedDetectionIndices.has(pair.detectionIndex)
      ) {
        continue;
      }

      matchedTrackIds.add(pair.trackId);
      matchedDetectionIndices.add(pair.detectionIndex);

      const track = this.tracks.get(pair.trackId)!;
      const det = detections[pair.detectionIndex];

      // Update matched track with EMA smoothing
      const smoothedBox = smoothBoundingBox(det.box, track.box);
      const smoothedNormalizedBox = smoothBoundingBox(det.normalizedBox, track.normalizedBox);
      const smoothedConfidence = smoothEma(det.confidence, track.confidence);

      // Update sliding window history (size: TRACK_WINDOW_SIZE)
      const history = [...track.history, true];
      if (history.length > DETECTION_CONFIG.TRACK_WINDOW_SIZE) {
        history.shift();
      }

      const seenInWindow = history.filter(Boolean).length;
      const isStable = seenInWindow >= DETECTION_CONFIG.TRACK_MIN_SEEN_FRAMES;

      this.tracks.set(pair.trackId, {
        id: track.id,
        type: track.type,
        confidence: smoothedConfidence,
        box: smoothedBox,
        normalizedBox: smoothedNormalizedBox,
        isStable,
        consecutiveMisses: 0,
        seenCount: track.seenCount + 1,
        history,
      });
    }

    // Step 2: Update unmatched existing tracks (missed frame)
    for (const [trackId, track] of Array.from(this.tracks.entries())) {
      if (!matchedTrackIds.has(trackId)) {
        const misses = track.consecutiveMisses + 1;

        if (misses >= DETECTION_CONFIG.TRACK_EXPIRY_FRAMES) {
          // Expired track: remove after 10 missed frames
          this.tracks.delete(trackId);
          continue;
        }

        const history = [...track.history, false];
        if (history.length > DETECTION_CONFIG.TRACK_WINDOW_SIZE) {
          history.shift();
        }

        const seenInWindow = history.filter(Boolean).length;
        const isStable = seenInWindow >= DETECTION_CONFIG.TRACK_MIN_SEEN_FRAMES;

        this.tracks.set(trackId, {
          ...track,
          consecutiveMisses: misses,
          history,
          isStable,
        });
      }
    }

    // Step 3: Register unmatched detections as new tracks
    detections.forEach((det, idx) => {
      if (!matchedDetectionIndices.has(idx)) {
        const id = `track_${this.nextTrackId++}`;
        const history = [true];
        const isStable = history.filter(Boolean).length >= DETECTION_CONFIG.TRACK_MIN_SEEN_FRAMES;

        this.tracks.set(id, {
          id,
          type: det.type,
          confidence: det.confidence,
          box: { ...det.box },
          normalizedBox: { ...det.normalizedBox },
          isStable,
          consecutiveMisses: 0,
          seenCount: 1,
          history,
        });
      }
    });

    return Array.from(this.tracks.values());
  }
}
