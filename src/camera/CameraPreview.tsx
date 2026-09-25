import React, { useRef, useEffect, useState } from 'react';
import { CameraErrorInfo, CameraStatus, VideoDimensions } from './types';
import { CAMERA_CONFIG, UI_CONFIG } from '../config';
import { useVisionWorker } from '../vision';
import { useCircuitPipeline, COMPONENT_THEME_TOKENS } from '../circuit';
import { NotRecognizedSheet } from './NotRecognizedSheet';
import { useNotRecognizedSheet } from './useNotRecognizedSheet';

export interface CameraPreviewProps {
  status: CameraStatus;
  stream: MediaStream | null;
  error: CameraErrorInfo | null;
  dimensions: VideoDimensions | null;
  onRetry: () => void;
  onClose: () => void;
  onDimensionsUpdate: (dims: VideoDimensions) => void;
  onSelectExperiment?: (experimentId: string) => void;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  status,
  stream,
  error,
  dimensions,
  onRetry,
  onClose,
  onDimensionsUpdate,
  onSelectExperiment,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [experimentNotice, setExperimentNotice] = useState<string | null>(null);

  // Attach MediaStream to <video> when available
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      // Explicitly set DOM properties for autoplay policy compliance
      video.muted = true;
      video.playsInline = true;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play().catch(() => {
        // Autoplay may be pending or controlled by browser gesture
      });
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  const updateDimensionsFromVideo = () => {
    if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      if (videoWidth > 0 && videoHeight > 0) {
        onDimensionsUpdate({ width: videoWidth, height: videoHeight });
      }
    }
  };

  const handleLoadedMetadata = () => {
    updateDimensionsFromVideo();
  };

  const { stats: workerStats, latestTracks, processFrame, sendBurstTest } = useVisionWorker(status === 'ready');

  // Downstream circuit pipeline: SceneGate (R9) -> CircuitBuilder -> RuleEngine
  const { gateStatus, ruleOutput, labels, primaryHint } = useCircuitPipeline(
    status === 'ready' ? latestTracks : []
  );

  // Not Recognized sheet (docs/design.md §3.8): appears when idle with 0 components for 2s
  const { isSheetVisible, dismissSheet } = useNotRecognizedSheet({
    cameraReady: status === 'ready',
    workerReady: workerStats.workerStatus === 'ready',
    gateState: gateStatus.state,
    distinctCount: gateStatus.distinctCount,
  });

  const handleSelectExperiment = (experimentId: string) => {
    if (onSelectExperiment) {
      onSelectExperiment(experimentId);
    } else {
      setExperimentNotice('Virtual Builder is coming in Phase 3.');
      setTimeout(() => setExperimentNotice(null), 3500);
    }
  };

  // Development frame pumping: send video frames to vision worker at UI_CONFIG.TARGET_FPS (~10 FPS = 100ms)
  useEffect(() => {
    if (status !== 'ready') return;

    let isSubscribed = true;
    const intervalMs = Math.round(1000 / UI_CONFIG.TARGET_FPS);

    const intervalId = setInterval(() => {
      if (!isSubscribed || !videoRef.current) return;
      void processFrame(videoRef.current);
    }, intervalMs);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [status, processFrame]);

  const handleCanPlay = () => {
    updateDimensionsFromVideo();
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  };

  const cal = CAMERA_CONFIG.DEV_CALIBRATION_RECT;

  return (
    <div className="fixed inset-0 z-50 bg-bg text-text flex flex-col overflow-hidden select-none">
      {/* 1. Video Element (Hardware-rendered, strictly local, zero frame egress) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        className="absolute inset-0 w-full h-full object-cover"
        aria-label="Live camera preview"
      />

      {/* 2. AR Overlay Layer (Pure vector SVG, never reads/serializes camera pixels) */}
      {status === 'ready' && (
        <div className="absolute inset-0 pointer-events-none">
          <svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Normalized calibration test bounding rectangle */}
            <rect
              x={cal.x * 100}
              y={cal.y * 100}
              width={cal.width * 100}
              height={cal.height * 100}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="0.5"
              strokeDasharray="1.5 1.5"
              rx="1.5"
            />
            {/* Center target crosshair */}
            <line
              x1={(cal.x + cal.width / 2) * 100 - 3}
              y1={(cal.y + cal.height / 2) * 100}
              x2={(cal.x + cal.width / 2) * 100 + 3}
              y2={(cal.y + cal.height / 2) * 100}
              stroke="var(--accent)"
              strokeWidth="0.5"
            />
            <line
              x1={(cal.x + cal.width / 2) * 100}
              y1={(cal.y + cal.height / 2) * 100 - 3}
              x2={(cal.x + cal.width / 2) * 100}
              y2={(cal.y + cal.height / 2) * 100 + 3}
              stroke="var(--accent)"
              strokeWidth="0.5"
            />

            {/* R9 Gated Component Labels (ZERO rendered when SceneGate is idle) */}
            {labels.map((comp) => {
              const colorToken = COMPONENT_THEME_TOKENS[comp.type] || 'var(--accent)';
              const normBox =
                'normalizedBox' in comp && (comp as any).normalizedBox
                  ? (comp as any).normalizedBox
                  : {
                      x: dimensions ? comp.box.x / dimensions.width : comp.box.x / 1280,
                      y: dimensions ? comp.box.y / dimensions.height : comp.box.y / 720,
                      w: dimensions ? comp.box.w / dimensions.width : comp.box.w / 1280,
                      h: dimensions ? comp.box.h / dimensions.height : comp.box.h / 720,
                    };

              return (
                <g key={comp.id}>
                  <rect
                    x={normBox.x * 100}
                    y={normBox.y * 100}
                    width={normBox.w * 100}
                    height={normBox.h * 100}
                    fill="none"
                    stroke={colorToken}
                    strokeWidth="0.5"
                    rx="1"
                  />
                  <text
                    x={normBox.x * 100 + 0.5}
                    y={Math.max(2.5, normBox.y * 100 - 1)}
                    fill={colorToken}
                    fontSize="2.2"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {comp.type} {Math.round(comp.confidence * 100)}%
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Calm Hint Strip (Single-line prompt, calm feedback; suppressed when Not Recognized sheet is open) */}
          {primaryHint && !isSheetVisible && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 max-w-sm w-full px-4 pointer-events-none">
              <div className="mx-auto px-4 py-2 rounded-chip bg-surface/90 border border-muted/30 text-xs font-medium text-text text-center shadow-lg backdrop-blur-md">
                {primaryHint}
              </div>
            </div>
          )}

          {/* Dev calibration and Worker diagnostic info tag */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-chip bg-surface/90 border border-muted/30 text-xs font-mono text-muted flex items-center space-x-2 shadow-lg backdrop-blur-sm whitespace-nowrap">
            <span
              className={`h-2 w-2 rounded-full ${
                gateStatus.state === 'lab'
                  ? 'bg-ok'
                  : workerStats.workerStatus === 'ready'
                  ? 'bg-accent'
                  : 'bg-warn'
              }`}
            />
            <span>
              DEV • R9: {gateStatus.state} ({gateStatus.consecutiveStableFrames}/5) | Worker:{' '}
              {workerStats.workerStatus} | {workerStats.framesProcessed}ok/{workerStats.framesDropped}drop |{' '}
              {labels.length} labels
            </span>
            <button
              type="button"
              onClick={() => videoRef.current && void sendBurstTest(videoRef.current)}
              className="ml-2 px-2 py-0.5 rounded bg-surface hover:bg-muted/20 text-[10px] text-accent pointer-events-auto border border-accent/40 transition-colors"
              title="Send 2 frames concurrently to verify worker immediately drops the busy frame"
            >
              Test Drop
            </button>
          </div>
        </div>
      )}

      {/* 3. Top Navigation & Status Bar */}
      <header className="relative z-10 p-4 pt-safe flex items-center justify-between pointer-events-auto">
        <div className="flex items-center space-x-2">
          {/* Camera Status Pill */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-chip bg-surface/80 border border-muted/20 backdrop-blur-md text-xs font-medium">
            {status === 'ready' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
                <span className="text-text">Camera Active</span>
              </>
            ) : status === 'requesting' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-warn animate-pulse" />
                <span className="text-text">Opening Camera...</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-error" />
                <span className="text-text">Camera Offline</span>
              </>
            )}
          </div>

          {/* Circuit Status Chip (Rendered only when SceneGate is in Lab mode and rules evaluate) */}
          {ruleOutput && (
            <div
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-chip bg-surface/90 border backdrop-blur-md text-xs font-semibold ${
                ruleOutput.status === 'ok'
                  ? 'border-ok/40 text-ok'
                  : ruleOutput.status === 'warning'
                  ? 'border-warn/40 text-warn'
                  : 'border-error/40 text-error'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  ruleOutput.status === 'ok'
                    ? 'bg-ok'
                    : ruleOutput.status === 'warning'
                    ? 'bg-warn'
                    : 'bg-error'
                }`}
              />
              <span>
                {ruleOutput.status === 'ok'
                  ? 'Circuit OK'
                  : ruleOutput.status === 'warning'
                  ? 'Circuit Warning'
                  : 'Circuit Error'}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera preview"
          className="px-3.5 py-1.5 rounded-chip bg-surface/80 hover:bg-surface border border-muted/30 text-xs font-semibold text-text backdrop-blur-md transition-colors"
        >
          Exit
        </button>
      </header>

      {/* 4. Requesting State Overlay */}
      {status === 'requesting' && (
        <div className="absolute inset-0 z-20 bg-bg/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text">Requesting Camera Access</h2>
            <p className="text-sm text-muted max-w-xs">
              Please grant camera permission in your browser prompt to scan circuit components.
            </p>
          </div>
        </div>
      )}

      {/* 5. Permission Denied State Overlay */}
      {status === 'denied' && (
        <div className="absolute inset-0 z-20 bg-bg/95 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full bg-surface border border-error/40 rounded-card p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-error/10 border border-error/30 flex items-center justify-center text-error">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-text">{error?.title || 'Camera Permission Denied'}</h2>
              <p className="text-sm text-muted">{error?.message}</p>
            </div>
            <p className="text-xs text-muted/80 bg-bg/60 p-3 rounded-lg border border-muted/20">
              {error?.instruction}
            </p>
            <div className="flex flex-col space-y-2 pt-2">
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-2.5 px-4 rounded-chip bg-accent text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-chip bg-surface border border-muted/30 text-text text-sm hover:bg-surface/80 transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Camera Error / Unavailable State Overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 z-20 bg-bg/95 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full bg-surface border border-error/40 rounded-card p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-error/10 border border-error/30 flex items-center justify-center text-error">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-text">{error?.title || 'Camera Error'}</h2>
              <p className="text-sm text-muted">{error?.message}</p>
            </div>
            <p className="text-xs text-muted/80 bg-bg/60 p-3 rounded-lg border border-muted/20">
              {error?.instruction}
            </p>
            <div className="flex flex-col space-y-2 pt-2">
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-2.5 px-4 rounded-chip bg-accent text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-chip bg-surface border border-muted/30 text-text text-sm hover:bg-surface/80 transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Not Recognized Bottom Sheet (docs/design.md §3.8) */}
      <NotRecognizedSheet
        isOpen={status === 'ready' && isSheetVisible}
        onTryAgain={dismissSheet}
        onSelectExperiment={handleSelectExperiment}
        notice={experimentNotice}
      />
    </div>
  );
};

export default CameraPreview;
