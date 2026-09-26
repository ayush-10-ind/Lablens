import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GuideController } from './guideController';
import { createCircuitGuideScene, GuideSceneHandle } from './scene';
import { LED_CIRCUIT_GUIDE_CONTENT } from './content';
import { RuleEngineOutput } from '../circuit/types';

export interface GuideViewProps {
  isOpen: boolean;
  onClose: () => void;
  ruleOutput: RuleEngineOutput | null;
}

export const GuideView: React.FC<GuideViewProps> = ({ isOpen, onClose, ruleOutput }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneHandleRef = useRef<GuideSceneHandle | null>(null);
  const pointerStartRef = useRef<number | null>(null);

  const [controller] = useState<GuideController>(() => new GuideController(ruleOutput));
  const [controllerState, setControllerState] = useState(() => controller.getState());

  const syncState = useCallback(() => {
    const nextState = controller.getState();
    setControllerState(nextState);

    if (sceneHandleRef.current) {
      sceneHandleRef.current.setStep(nextState.currentStepIndex + 1);
    }
  }, [controller]);

  // Initialize Three.js scene when opened
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handle = createCircuitGuideScene(containerRef.current, { reducedMotion });
    sceneHandleRef.current = handle;

    // Sync initial step & highlight
    handle.setStep(controller.getCurrentStepNumber());

    // Window resize handler
    const handleResize = () => {
      if (containerRef.current && sceneHandleRef.current) {
        sceneHandleRef.current.onResize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      handle.dispose();
      sceneHandleRef.current = null;
    };
  }, [isOpen, controller]);

  // Auto-play timer loop
  useEffect(() => {
    if (!controllerState.isPlaying) return;

    const intervalId = setInterval(() => {
      controller.advancePlayback();
      syncState();
    }, 3200);

    return () => clearInterval(intervalId);
  }, [controllerState.isPlaying, controller, syncState]);

  if (!isOpen) return null;

  const handleNext = () => {
    controller.next();
    syncState();
  };

  const handlePrevious = () => {
    controller.previous();
    syncState();
  };

  const handleStepSelect = (index: number) => {
    controller.setStep(index);
    syncState();
  };

  const handleReset = () => {
    controller.reset();
    syncState();
  };

  const handleTogglePlay = () => {
    controller.togglePlay();
    syncState();
  };

  // Simple touch drag rotation (zero external dependencies)
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartRef.current !== null && sceneHandleRef.current) {
      const deltaX = e.clientX - pointerStartRef.current;
      pointerStartRef.current = e.clientX;
      sceneHandleRef.current.handlePointerDrag(deltaX);
    }
  };

  const handlePointerUp = () => {
    pointerStartRef.current = null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none"
    >
      {/* 1. Header Bar */}
      <header className="relative z-10 p-4 pt-safe flex items-center justify-between border-b border-muted/20 bg-surface/60 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          <h2 id="guide-title" className="text-sm font-bold text-text tracking-wide">
            {LED_CIRCUIT_GUIDE_CONTENT.title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close 3D guide"
          className="p-1.5 rounded-chip bg-surface hover:bg-muted/20 text-muted hover:text-text border border-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* 2. Three.js Canvas Container (Touch interactive) */}
      <main
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing touch-none"
      >
        {/* Subtle 3D drag hint */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-chip bg-surface/80 border border-muted/20 text-[10px] text-muted pointer-events-none">
          Drag to rotate view
        </div>
      </main>

      {/* 3. Footer Control Bar */}
      <footer className="relative z-10 p-4 pb-safe bg-surface/90 border-t border-muted/20 backdrop-blur-md flex flex-col space-y-3">
        {/* Step Progression Pills */}
        <div className="grid grid-cols-4 gap-1.5">
          {LED_CIRCUIT_GUIDE_CONTENT.steps.map((step, idx) => {
            const isActive = controllerState.currentStepIndex === idx;
            return (
              <button
                key={step.componentId}
                type="button"
                onClick={() => handleStepSelect(idx)}
                className={`min-h-[40px] px-2 py-1.5 rounded-card text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                  isActive
                    ? 'bg-accent/20 border border-accent text-accent shadow-sm'
                    : 'bg-bg/60 border border-muted/20 text-muted hover:text-text hover:bg-bg/90'
                }`}
              >
                <span className="text-[10px] opacity-75">{step.stepNumber}</span>
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Caption Strip */}
        <div className="px-3.5 py-2.5 rounded-card bg-bg/80 border border-muted/20 text-center min-h-[48px] flex items-center justify-center">
          <p className="text-xs text-text leading-relaxed font-medium">
            {controllerState.activeCaption}
          </p>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-chip bg-surface hover:bg-muted/10 border border-muted/30 text-xs font-medium text-muted hover:text-text transition-colors"
          >
            Reset
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={controllerState.currentStepIndex === 0}
              className="px-3 py-1.5 rounded-chip bg-surface hover:bg-muted/10 disabled:opacity-30 border border-muted/30 text-xs font-semibold text-text transition-colors"
              aria-label="Previous step"
            >
              Step ◀
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="px-4 py-1.5 rounded-chip bg-accent text-bg font-semibold text-xs transition-opacity hover:opacity-90 shadow-md"
            >
              {controllerState.isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={controllerState.currentStepIndex === LED_CIRCUIT_GUIDE_CONTENT.steps.length - 1}
              className="px-3 py-1.5 rounded-chip bg-surface hover:bg-muted/10 disabled:opacity-30 border border-muted/30 text-xs font-semibold text-text transition-colors"
              aria-label="Next step"
            >
              Step ▶
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
