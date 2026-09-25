/**
 * DEVELOPMENT/INTEGRATION HOOK: Vision Web Worker client.
 *
 * Connects the live HTMLVideoElement to detector.worker.ts:
 * Camera video -> createImageBitmap -> postMessage(bitmap, [bitmap]) -> Worker -> TrackedDetection[]
 *
 * Purely local - zero network transfer, zero serialization.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { VisionWorkerResponse, TrackedDetection } from './types';

export interface VisionWorkerStats {
  workerStatus: 'uninitialized' | 'ready' | 'error';
  framesSent: number;
  framesProcessed: number;
  framesDropped: number;
  lastDurationMs: number;
  lastTrackedCount: number;
  lastError: string | null;
}

export interface UseVisionWorkerReturn {
  stats: VisionWorkerStats;
  latestTracks: TrackedDetection[];
  processFrame: (video: HTMLVideoElement) => Promise<boolean>;
  sendBurstTest: (video: HTMLVideoElement) => Promise<void>;
}

export function useVisionWorker(enabled = true): UseVisionWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const frameIdCounterRef = useRef<number>(0);

  const [stats, setStats] = useState<VisionWorkerStats>({
    workerStatus: 'uninitialized',
    framesSent: 0,
    framesProcessed: 0,
    framesDropped: 0,
    lastDurationMs: 0,
    lastTrackedCount: 0,
    lastError: null,
  });

  const [latestTracks, setLatestTracks] = useState<TrackedDetection[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let worker: Worker;
    try {
      worker = new Worker(new URL('./detector.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[VisionWorker] Failed to construct Worker:', msg);
      setStats((s) => ({ ...s, workerStatus: 'error', lastError: msg }));
      return;
    }

    worker.onmessage = (event: MessageEvent<VisionWorkerResponse>) => {
      const data = event.data;

      switch (data.type) {
        case 'INIT_SUCCESS':
          setStats((s) => ({ ...s, workerStatus: 'ready' }));
          break;

        case 'FRAME_PROCESSED':
          setLatestTracks(data.trackedDetections);
          setStats((s) => ({
            ...s,
            framesProcessed: s.framesProcessed + 1,
            lastDurationMs: data.inferenceDurationMs,
            lastTrackedCount: data.trackedDetections.length,
          }));
          break;

        case 'FRAME_DROPPED':
          setStats((s) => ({
            ...s,
            framesDropped: s.framesDropped + 1,
          }));
          break;

        case 'ERROR':
          console.error('[VisionWorker] Worker reported error:', data.message);
          setStats((s) => ({
            ...s,
            lastError: data.message,
          }));
          break;
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      console.error('[VisionWorker] Unhandled worker error:', err.message);
      setStats((s) => ({ ...s, workerStatus: 'error', lastError: err.message }));
    };

    // Initialize worker with default settings
    worker.postMessage({
      type: 'INIT',
      config: { fakeScenario: 'canonical_circuit' },
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled]);

  const processFrame = useCallback(async (video: HTMLVideoElement): Promise<boolean> => {
    const worker = workerRef.current;
    if (!worker) return false;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return false;
    }

    const frameId = ++frameIdCounterRef.current;
    const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      // Create transferable ImageBitmap locally from live video element
      const imageBitmap = await createImageBitmap(video);

      // Transfer ownership to worker via transfer list (zero copy, zero serialization)
      worker.postMessage(
        {
          type: 'PROCESS_FRAME',
          frameId,
          timestamp,
          imageBitmap,
          sourceWidth: video.videoWidth,
          sourceHeight: video.videoHeight,
        },
        [imageBitmap]
      );

      setStats((s) => ({ ...s, framesSent: s.framesSent + 1 }));
      return true;
    } catch (err: unknown) {
      console.warn('[VisionWorker] createImageBitmap transfer failed:', err);
      return false;
    }
  }, []);

  /**
   * Diagnostic helper: sends 2 real frames concurrently to verify
   * that the worker accepts the first and immediately drops the second with FRAME_DROPPED.
   * Frame 1 sets simulateDelayMs: 150 to guarantee the worker is busy when Frame 2 arrives.
   */
  const sendBurstTest = useCallback(async (video: HTMLVideoElement) => {
    const worker = workerRef.current;
    if (!worker || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    try {
      // 1. Create two real ImageBitmaps concurrently
      const [bitmap1, bitmap2] = await Promise.all([
        createImageBitmap(video),
        createImageBitmap(video),
      ]);

      const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const frame1Id = ++frameIdCounterRef.current;
      const frame2Id = ++frameIdCounterRef.current;

      // 2. Post Frame 1 with small test delay (150ms) to hold worker busy
      worker.postMessage(
        {
          type: 'PROCESS_FRAME',
          frameId: frame1Id,
          timestamp,
          imageBitmap: bitmap1,
          sourceWidth: video.videoWidth,
          sourceHeight: video.videoHeight,
          simulateDelayMs: 150,
        },
        [bitmap1]
      );

      // 3. Immediately post Frame 2 back-to-back without gap
      worker.postMessage(
        {
          type: 'PROCESS_FRAME',
          frameId: frame2Id,
          timestamp,
          imageBitmap: bitmap2,
          sourceWidth: video.videoWidth,
          sourceHeight: video.videoHeight,
        },
        [bitmap2]
      );

      setStats((s) => ({ ...s, framesSent: s.framesSent + 2 }));
    } catch (err: unknown) {
      console.warn('[VisionWorker] sendBurstTest failed:', err);
    }
  }, []);

  return {
    stats,
    latestTracks,
    processFrame,
    sendBurstTest,
  };
}
