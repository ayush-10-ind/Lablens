import { useState, useEffect, useRef, useCallback } from 'react';
import { UI_CONFIG } from '../config';

export interface NotRecognizedInput {
  cameraReady: boolean;
  workerReady: boolean;
  gateState: 'idle' | 'lab';
  distinctCount: number;
}

export interface UseNotRecognizedSheetOptions extends NotRecognizedInput {
  delayMs?: number;
}

export interface UseNotRecognizedSheetReturn {
  isSheetVisible: boolean;
  dismissSheet: () => void;
}

/**
 * Pure controller managing the presentation timing and episode-scoped dismissal
 * of the Not Recognized bottom sheet (docs/design.md §3.8, docs/rules.md §B2, docs/architecture.md §5.0).
 *
 * Rules:
 * - SceneGate (R9) is the sole authority for gate state and distinctCount.
 * - Eligible only when: cameraReady && workerReady && gateState === 'idle' && distinctCount === 0.
 * - Requires continuous zero-component idle for delayMs (2000 ms).
 * - Dismissal ("Try again") is episode-scoped: dismisses the sheet and keeps it dismissed
 *   for the remainder of that zero-component episode.
 * - A supported component appearing (distinctCount > 0) or entering lab ends the episode.
 *   A subsequent return to zero-component idle starts a new episode eligible for the sheet.
 */
export class NotRecognizedController {
  private isVisible = false;
  private isDismissedInCurrentEpisode = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private delayMs: number;
  private onChange?: (visible: boolean) => void;

  constructor(
    delayMs: number = UI_CONFIG.NOT_RECOGNIZED_DELAY_MS,
    onChange?: (visible: boolean) => void
  ) {
    this.delayMs = delayMs;
    this.onChange = onChange;
  }

  public update(input: NotRecognizedInput): void {
    const { cameraReady, workerReady, gateState, distinctCount } = input;

    // Episode boundary: a supported component appearing or entering lab ends the current zero-component episode
    if (distinctCount > 0 || gateState === 'lab') {
      this.isDismissedInCurrentEpisode = false;
    }

    const isZeroComponentIdle =
      cameraReady && workerReady && gateState === 'idle' && distinctCount === 0;

    if (!isZeroComponentIdle) {
      this.clearTimer();
      if (this.isVisible) {
        this.isVisible = false;
        this.onChange?.(false);
      }
      return;
    }

    // In zero-component idle:
    // If user clicked "Try again" in this episode, keep it dismissed for the rest of the episode
    if (this.isDismissedInCurrentEpisode) {
      this.clearTimer();
      if (this.isVisible) {
        this.isVisible = false;
        this.onChange?.(false);
      }
      return;
    }

    // Already visible: nothing to schedule
    if (this.isVisible) {
      return;
    }

    // Schedule timer if not already active
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.isVisible = true;
        this.timer = null;
        this.onChange?.(true);
      }, this.delayMs);
    }
  }

  public dismiss(): void {
    this.isDismissedInCurrentEpisode = true;
    this.clearTimer();
    if (this.isVisible) {
      this.isVisible = false;
      this.onChange?.(false);
    }
  }

  public isSheetVisible(): boolean {
    return this.isVisible;
  }

  public isDismissed(): boolean {
    return this.isDismissedInCurrentEpisode;
  }

  public dispose(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * React hook connecting NotRecognizedController to component state.
 */
export function useNotRecognizedSheet(
  options: UseNotRecognizedSheetOptions
): UseNotRecognizedSheetReturn {
  const [isSheetVisible, setIsSheetVisible] = useState<boolean>(false);
  const controllerRef = useRef<NotRecognizedController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new NotRecognizedController(
      options.delayMs ?? UI_CONFIG.NOT_RECOGNIZED_DELAY_MS,
      (visible) => setIsSheetVisible(visible)
    );
  }

  useEffect(() => {
    controllerRef.current?.update({
      cameraReady: options.cameraReady,
      workerReady: options.workerReady,
      gateState: options.gateState,
      distinctCount: options.distinctCount,
    });
  }, [options.cameraReady, options.workerReady, options.gateState, options.distinctCount]);

  useEffect(() => {
    return () => {
      controllerRef.current?.dispose();
    };
  }, []);

  const dismissSheet = useCallback(() => {
    controllerRef.current?.dismiss();
  }, []);

  return {
    isSheetVisible,
    dismissSheet,
  };
}
