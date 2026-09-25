import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { NotRecognizedController } from './useNotRecognizedSheet';
import { NotRecognizedSheet } from './NotRecognizedSheet';
import { SceneGate } from '../circuit/sceneGate';

describe('Not Recognized Presentation Timing (NotRecognizedController)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Fresh idle with zero components: sheet is initially hidden at t = 0', () => {
    const controller = new NotRecognizedController();
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });

    expect(controller.isSheetVisible()).toBe(false);
    controller.dispose();
  });

  it('2. Continuous zero-component idle reaches 2000ms: sheet becomes visible', () => {
    const controller = new NotRecognizedController();
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });

    vi.advanceTimersByTime(1999);
    expect(controller.isSheetVisible()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(controller.isSheetVisible()).toBe(true);
    controller.dispose();
  });

  it('3. Zero-component idle below 2000ms: sheet remains hidden', () => {
    const controller = new NotRecognizedController();
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });

    vi.advanceTimersByTime(1900);
    expect(controller.isSheetVisible()).toBe(false);
    controller.dispose();
  });

  it('4. Single supported component: Not Recognized remains hidden', () => {
    const controller = new NotRecognizedController();

    // Zero components for 1000ms
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });
    vi.advanceTimersByTime(1000);
    expect(controller.isSheetVisible()).toBe(false);

    // Single resistor appears (distinctCount === 1)
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 1,
    });

    // Advance past 2000ms: must remain hidden because distinctCount === 1
    vi.advanceTimersByTime(2000);
    expect(controller.isSheetVisible()).toBe(false);
    controller.dispose();
  });

  it('5. Scene becomes recognized before 2 seconds: timer resets and sheet never appears', () => {
    const controller = new NotRecognizedController();

    // 0 components for 1500ms
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });
    vi.advanceTimersByTime(1500);
    expect(controller.isSheetVisible()).toBe(false);

    // 2 distinct components appear at t = 1500ms
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 2,
    });
    vi.advanceTimersByTime(1000);
    expect(controller.isSheetVisible()).toBe(false);
    controller.dispose();
  });

  it('6. Scene enters lab: Not Recognized is immediately hidden', () => {
    const controller = new NotRecognizedController();

    // Let sheet open at 2000ms
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });
    vi.advanceTimersByTime(2000);
    expect(controller.isSheetVisible()).toBe(true);

    // SceneGate transitions to lab
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'lab',
      distinctCount: 2,
    });
    expect(controller.isSheetVisible()).toBe(false);
    controller.dispose();
  });

  it('7. Lab exits to idle: a fresh 2-second period is required before sheet appears', () => {
    const controller = new NotRecognizedController();

    // In lab mode
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'lab',
      distinctCount: 2,
    });
    expect(controller.isSheetVisible()).toBe(false);

    // After 3s with no components, SceneGate exits lab -> idle with 0 components
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });
    expect(controller.isSheetVisible()).toBe(false);

    // Advance 1000ms: still hidden
    vi.advanceTimersByTime(1000);
    expect(controller.isSheetVisible()).toBe(false);

    // Advance another 1000ms (total 2000ms): visible
    vi.advanceTimersByTime(1000);
    expect(controller.isSheetVisible()).toBe(true);
    controller.dispose();
  });

  it('8. Unsupported/random clutter: treated by SceneGate as 0 supported components and triggers sheet without labels', () => {
    const gate = new SceneGate();
    const controller = new NotRecognizedController();

    // Fake random objects (keys, mug, pen) not in SUPPORTED_CIRCUIT_COMPONENTS
    const randomObjects = [
      { id: '1', type: 'unknown_object' as any, box: { x: 10, y: 10, w: 20, h: 20 }, confidence: 0.9 },
    ];

    const gateStatus = gate.update(randomObjects, 100);
    expect(gateStatus.distinctCount).toBe(0);
    expect(gateStatus.gatedComponents).toHaveLength(0);
    expect(gateStatus.state).toBe('idle');

    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: gateStatus.state,
      distinctCount: gateStatus.distinctCount,
    });

    vi.advanceTimersByTime(2000);
    expect(controller.isSheetVisible()).toBe(true);
    controller.dispose();
  });

  it('9. Model-loading state: remains hidden while worker is uninitialized', () => {
    const controller = new NotRecognizedController();

    // Camera ready but worker uninitialized (loading detector)
    controller.update({
      cameraReady: true,
      workerReady: false,
      gateState: 'idle',
      distinctCount: 0,
    });

    vi.advanceTimersByTime(3000);
    expect(controller.isSheetVisible()).toBe(false);

    // Worker completes initialization (workerReady = true)
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });

    // Fresh 2000ms required after worker is ready
    vi.advanceTimersByTime(1999);
    expect(controller.isSheetVisible()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(controller.isSheetVisible()).toBe(true);
    controller.dispose();
  });

  it('10. Try again dismissal: episode-scoped dismissal remains closed for current zero-component episode', () => {
    const controller = new NotRecognizedController();

    // Zero components -> sheet opens at 2000ms
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });
    vi.advanceTimersByTime(2000);
    expect(controller.isSheetVisible()).toBe(true);

    // User clicks Try again
    controller.dismiss();
    expect(controller.isSheetVisible()).toBe(false);
    expect(controller.isDismissed()).toBe(true);

    // Further continuous zero-component frames do NOT re-open the sheet in the same episode
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });
    vi.advanceTimersByTime(5000);
    expect(controller.isSheetVisible()).toBe(false);

    // A supported component appears -> ends the zero-component episode
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 1,
    });
    expect(controller.isDismissed()).toBe(false);
    expect(controller.isSheetVisible()).toBe(false);

    // Component is removed -> a NEW zero-component episode begins
    controller.update({
      cameraReady: true,
      workerReady: true,
      gateState: 'idle',
      distinctCount: 0,
    });
    expect(controller.isSheetVisible()).toBe(false);

    // 2000ms of continuous zero components in the new episode re-opens the sheet
    vi.advanceTimersByTime(2000);
    expect(controller.isSheetVisible()).toBe(true);
    controller.dispose();
  });
});

describe('Not Recognized Bottom Sheet Component (NotRecognizedSheet)', () => {
  it('renders null when isOpen is false', () => {
    const onTryAgain = vi.fn();
    const element = NotRecognizedSheet({
      isOpen: false,
      onTryAgain,
    });

    expect(element).toBeNull();
  });

  it('renders documented copy and structure when isOpen is true', () => {
    const onTryAgain = vi.fn();
    const onSelectExperiment = vi.fn();

    const element = NotRecognizedSheet({
      isOpen: true,
      onTryAgain,
      onSelectExperiment,
      notice: 'Virtual Builder coming in Phase 3',
    });

    expect(element).not.toBeNull();
    const section = element as React.ReactElement;
    expect(section.type).toBe('section');
    expect(section.props.role).toBe('dialog');

    // Recursively collect text content to verify documented strings
    const collectText = (node: any): string[] => {
      if (!node) return [];
      if (typeof node === 'string') return [node];
      if (typeof node === 'number') return [String(node)];
      if (Array.isArray(node)) return node.flatMap(collectText);
      if (node.props && node.props.children) return collectText(node.props.children);
      return [];
    };

    const textNodes = collectText(section);
    const combinedText = textNodes.join(' ');

    // Exact documented copy (docs/design.md §3.8)
    expect(combinedText).toContain("I don't recognize this yet.");
    expect(combinedText).toContain('LabLens works with circuit parts for now.');
    expect(combinedText).toContain('Supported today');
    expect(combinedText).toContain('LED circuit lab');
    expect(combinedText).toContain('More coming soon');
    expect(combinedText).toContain('Try again');
    expect(combinedText).toContain('Virtual Builder coming in Phase 3');
  });
});
