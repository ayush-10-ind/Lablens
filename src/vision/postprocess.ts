/**
 * Pure postprocessing helpers for the LabLens vision pipeline.
 * Performs confidence filtering, IoU calculation, class-aware NMS,
 * un-letterboxing back to source coordinates, and class validation.
 */

import { DETECTION_CONFIG } from '../config';
import {
  BoundingBox,
  CLASS_INDEX_TO_COMPONENT,
  ComponentType,
  LetterboxInfo,
  ProcessedDetection,
  RawDetection,
} from './types';
import { normalizeBoundingBox, unletterboxBoundingBox } from './preprocess';

/**
 * Calculates the Intersection-over-Union (IoU) between two bounding boxes.
 * Bounding boxes are formatted as { x, y, w, h } where x, y is the top-left corner.
 */
export function calculateIoU(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const intersectionW = Math.max(0, x2 - x1);
  const intersectionH = Math.max(0, y2 - y1);
  const intersectionArea = intersectionW * intersectionH;

  const areaA = Math.max(0, a.w) * Math.max(0, a.h);
  const areaB = Math.max(0, b.w) * Math.max(0, b.h);
  const unionArea = areaA + areaB - intersectionArea;

  if (unionArea <= 0) return 0;
  return intersectionArea / unionArea;
}

/**
 * Performs Non-Maximum Suppression (NMS) within a single class of candidate detections.
 * Suppresses boxes that overlap with a higher-confidence box by IoU > threshold.
 */
export function nonMaximumSuppression<T extends { box: BoundingBox; confidence: number }>(
  candidates: T[],
  iouThreshold = DETECTION_CONFIG.NMS_IOU_THRESHOLD
): T[] {
  // Sort descending by confidence
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const selected: T[] = [];

  for (const current of sorted) {
    let shouldSuppress = false;
    for (const kept of selected) {
      if (calculateIoU(current.box, kept.box) > iouThreshold) {
        shouldSuppress = true;
        break;
      }
    }
    if (!shouldSuppress) {
      selected.push(current);
    }
  }

  return selected;
}

/**
 * Full postprocessing pipeline:
 * 1. Filter out raw detections below DETECTION_CONFIG.CONFIDENCE_THRESHOLD.
 * 2. Validate and map classIndex to supported ComponentType; filter out unknown classes.
 * 3. Run class-aware Non-Maximum Suppression (NMS) with DETECTION_CONFIG.NMS_IOU_THRESHOLD.
 * 4. Project boxes from model letterbox space back to original camera pixel & normalized coordinates.
 */
export function postprocessDetections(
  rawDetections: RawDetection[],
  letterbox: LetterboxInfo,
  confidenceThreshold = DETECTION_CONFIG.CONFIDENCE_THRESHOLD,
  nmsIouThreshold = DETECTION_CONFIG.NMS_IOU_THRESHOLD
): ProcessedDetection[] {
  // Step 1 & 2: Filter by confidence and map to supported class
  type ValidatedRaw = {
    type: ComponentType;
    confidence: number;
    box: BoundingBox;
  };

  const byClass = new Map<ComponentType, ValidatedRaw[]>();

  for (const raw of rawDetections) {
    if (raw.confidence < confidenceThreshold) {
      continue;
    }

    const componentType = CLASS_INDEX_TO_COMPONENT[raw.classIndex];
    if (!componentType) {
      // Unknown or unsupported class index; drop immediately per architecture rules
      continue;
    }

    const list = byClass.get(componentType) ?? [];
    list.push({
      type: componentType,
      confidence: raw.confidence,
      box: raw.box,
    });
    byClass.set(componentType, list);
  }

  // Step 3 & 4: Run class-aware NMS and map coordinates back
  const results: ProcessedDetection[] = [];

  for (const candidates of byClass.values()) {
    const suppressed = nonMaximumSuppression(candidates, nmsIouThreshold);

    for (const item of suppressed) {
      const frameBox = unletterboxBoundingBox(item.box, letterbox);
      const normalizedBox = normalizeBoundingBox(frameBox, letterbox.srcWidth, letterbox.srcHeight);

      results.push({
        type: item.type,
        confidence: item.confidence,
        box: frameBox,
        normalizedBox,
      });
    }
  }

  return results;
}
