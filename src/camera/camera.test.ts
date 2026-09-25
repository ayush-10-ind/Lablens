import { describe, it, expect, vi } from 'vitest';
import { buildCameraConstraints, classifyCameraError, stopCameraStream } from './camera';
import { CAMERA_CONFIG } from '../config';

describe('Camera Constraints (src/camera/camera.ts)', () => {
  it('generates constraints matching CAMERA_CONFIG without hardcoded values', () => {
    const constraints = buildCameraConstraints();

    expect(constraints.audio).toBe(false);
    expect(constraints.video).toEqual({
      facingMode: { ideal: CAMERA_CONFIG.FACING_MODE },
      width: { ideal: CAMERA_CONFIG.IDEAL_WIDTH },
      height: { ideal: CAMERA_CONFIG.IDEAL_HEIGHT },
    });
  });
});

describe('Camera Error Classification (classifyCameraError)', () => {
  it('correctly classifies NotAllowedError as denied', () => {
    const notAllowed = new DOMException('Permission dismissed', 'NotAllowedError');
    const result = classifyCameraError(notAllowed);

    expect(result.status).toBe('denied');
    expect(result.errorInfo.type).toBe('NotAllowedError');
    expect(result.errorInfo.title).toContain('permission denied');
  });

  it('correctly classifies PermissionDeniedError as denied', () => {
    const permDenied = new DOMException('Denied', 'PermissionDeniedError');
    const result = classifyCameraError(permDenied);

    expect(result.status).toBe('denied');
    expect(result.errorInfo.type).toBe('NotAllowedError');
  });

  it('classifies NotFoundError as error', () => {
    const notFound = new DOMException('No device', 'NotFoundError');
    const result = classifyCameraError(notFound);

    expect(result.status).toBe('error');
    expect(result.errorInfo.type).toBe('NotFoundError');
  });

  it('classifies DevicesNotFoundError as error', () => {
    const devNotFound = new DOMException('No device found', 'DevicesNotFoundError');
    const result = classifyCameraError(devNotFound);

    expect(result.status).toBe('error');
    expect(result.errorInfo.type).toBe('NotFoundError');
  });

  it('classifies NotReadableError / TrackStartError as error', () => {
    const notReadable = new DOMException('Hardware in use', 'NotReadableError');
    const result = classifyCameraError(notReadable);

    expect(result.status).toBe('error');
    expect(result.errorInfo.type).toBe('NotReadableError');

    const trackStart = new DOMException('Track failed', 'TrackStartError');
    const trackResult = classifyCameraError(trackStart);
    expect(trackResult.status).toBe('error');
    expect(trackResult.errorInfo.type).toBe('NotReadableError');
  });

  it('classifies OverconstrainedError as error', () => {
    const overconstrained = new DOMException('Constraint not satisfied', 'OverconstrainedError');
    const result = classifyCameraError(overconstrained);

    expect(result.status).toBe('error');
    expect(result.errorInfo.type).toBe('OverconstrainedError');
  });

  it('classifies SecurityError as error', () => {
    const security = new DOMException('Insecure context', 'SecurityError');
    const result = classifyCameraError(security);

    expect(result.status).toBe('error');
    expect(result.errorInfo.type).toBe('SecurityError');
  });

  it('classifies UnsupportedError as error', () => {
    const unsupported = new Error('Not supported');
    unsupported.name = 'UnsupportedError';
    const result = classifyCameraError(unsupported);

    expect(result.status).toBe('error');
    expect(result.errorInfo.type).toBe('UnsupportedError');
  });

  it('strictly classifies unknown errors as generic error and NEVER as denied', () => {
    const arbitraryError = new Error('Unusual hardware glitch');
    const result = classifyCameraError(arbitraryError);

    expect(result.status).toBe('error');
    expect(result.errorInfo.type).toBe('UnknownError');
    expect(result.status).not.toBe('denied');

    // Also test non-Error primitives
    const stringError = classifyCameraError('Unexpected string rejection');
    expect(stringError.status).toBe('error');
    expect(stringError.errorInfo.type).toBe('UnknownError');
    expect(stringError.status).not.toBe('denied');
  });
});

describe('Camera Stream Teardown (stopCameraStream)', () => {
  it('calls stop() on all tracks and handles null streams safely', () => {
    expect(() => stopCameraStream(null)).not.toThrow();

    const mockTrack1 = { stop: vi.fn() } as unknown as MediaStreamTrack;
    const mockTrack2 = { stop: vi.fn() } as unknown as MediaStreamTrack;
    const mockStream = {
      getTracks: () => [mockTrack1, mockTrack2],
    } as unknown as MediaStream;

    stopCameraStream(mockStream);

    expect(mockTrack1.stop).toHaveBeenCalledTimes(1);
    expect(mockTrack2.stop).toHaveBeenCalledTimes(1);
  });
});
