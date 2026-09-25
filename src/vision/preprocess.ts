/**
 * Pure preprocessing and coordinate conversion helpers for YOLO models.
 * Strictly local coordinate math — zero frame upload or serialization.
 */

import { BoundingBox, LetterboxInfo } from './types';

/**
 * Computes letterbox scale and symmetric padding to fit a source frame
 * of (srcWidth x srcHeight) into a square target model dimension (e.g. 416x416 or 320x320)
 * while preserving aspect ratio.
 */
export function computeLetterboxParams(
  srcWidth: number,
  srcHeight: number,
  targetSize: number
): LetterboxInfo {
  if (srcWidth <= 0 || srcHeight <= 0 || targetSize <= 0) {
    throw new Error(`Invalid dimensions for letterbox: src=${srcWidth}x${srcHeight}, target=${targetSize}`);
  }

  const scale = Math.min(targetSize / srcWidth, targetSize / srcHeight);
  const scaledWidth = srcWidth * scale;
  const scaledHeight = srcHeight * scale;

  const padX = (targetSize - scaledWidth) / 2;
  const padY = (targetSize - scaledHeight) / 2;

  return {
    targetSize,
    scale,
    padX,
    padY,
    srcWidth,
    srcHeight,
  };
}

/**
 * Maps a bounding box from letterboxed model space back to the source frame pixel coordinates.
 * Clamps coordinates to valid frame bounds [0, srcWidth] and [0, srcHeight].
 */
export function unletterboxBoundingBox(
  box: BoundingBox,
  letterbox: LetterboxInfo
): BoundingBox {
  const { scale, padX, padY, srcWidth, srcHeight } = letterbox;

  const unpaddedX = (box.x - padX) / scale;
  const unpaddedY = (box.y - padY) / scale;
  const unpaddedW = box.w / scale;
  const unpaddedH = box.h / scale;

  // Clamp to source frame boundaries
  const clampedX = Math.max(0, Math.min(srcWidth, unpaddedX));
  const clampedY = Math.max(0, Math.min(srcHeight, unpaddedY));
  const clampedW = Math.max(0, Math.min(srcWidth - clampedX, unpaddedW));
  const clampedH = Math.max(0, Math.min(srcHeight - clampedY, unpaddedH));

  return {
    x: clampedX,
    y: clampedY,
    w: clampedW,
    h: clampedH,
  };
}

/**
 * Normalizes a pixel bounding box into [0, 1] relative coordinates.
 */
export function normalizeBoundingBox(
  box: BoundingBox,
  srcWidth: number,
  srcHeight: number
): BoundingBox {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  const normX = Math.max(0, Math.min(1, box.x / srcWidth));
  const normY = Math.max(0, Math.min(1, box.y / srcHeight));
  const normW = Math.max(0, Math.min(1 - normX, box.w / srcWidth));
  const normH = Math.max(0, Math.min(1 - normY, box.h / srcHeight));

  return {
    x: normX,
    y: normY,
    w: normW,
    h: normH,
  };
}
