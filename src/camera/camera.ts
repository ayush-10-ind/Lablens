/**
 * Core camera utilities and error classification for LabLens.
 * Pure functions and stream lifecycle helpers.
 */

import { CAMERA_CONFIG } from '../config';
import { CameraErrorInfo, CameraStatus } from './types';

/**
 * Builds the MediaStreamConstraints object using parameters from CAMERA_CONFIG.
 */
export function buildCameraConstraints(): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: CAMERA_CONFIG.FACING_MODE },
      width: { ideal: CAMERA_CONFIG.IDEAL_WIDTH },
      height: { ideal: CAMERA_CONFIG.IDEAL_HEIGHT },
    },
  };
}

export interface ClassifiedCameraResult {
  status: Extract<CameraStatus, 'denied' | 'error'>;
  errorInfo: CameraErrorInfo;
}

/**
 * Classifies an unknown error or DOMException into structured CameraErrorInfo.
 * Strictly guarantees that unknown errors are classified as 'error', never 'denied'.
 */
export function classifyCameraError(error: unknown): ClassifiedCameraResult {
  const errorName = error instanceof Error ? error.name : '';
  const rawMessage = error instanceof Error ? error.message : String(error);

  switch (errorName) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        status: 'denied',
        errorInfo: {
          type: 'NotAllowedError',
          title: 'Camera permission denied',
          message: 'LabLens requires camera access to detect components on your desk.',
          instruction: 'Please enable camera permission in your browser address bar or site settings.',
        },
      };

    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        status: 'error',
        errorInfo: {
          type: 'NotFoundError',
          title: 'No camera found',
          message: 'Could not find a connected camera on your device.',
          instruction: 'Ensure your device has a working rear or built-in camera.',
        },
      };

    case 'NotReadableError':
    case 'TrackStartError':
      return {
        status: 'error',
        errorInfo: {
          type: 'NotReadableError',
          title: 'Camera unavailable',
          message: 'The camera is currently locked or in use by another application.',
          instruction: 'Close any other apps or tabs using the camera and try again.',
        },
      };

    case 'OverconstrainedError':
      return {
        status: 'error',
        errorInfo: {
          type: 'OverconstrainedError',
          title: 'Resolution not supported',
          message: 'The requested camera resolution or facing mode is not supported by your device.',
          instruction: 'Try restarting the camera with default settings.',
        },
      };

    case 'SecurityError':
      return {
        status: 'error',
        errorInfo: {
          type: 'SecurityError',
          title: 'Insecure context',
          message: 'Camera access is only permitted over HTTPS or localhost.',
          instruction: 'Please open LabLens over a secure HTTPS connection.',
        },
      };

    case 'UnsupportedError':
      return {
        status: 'error',
        errorInfo: {
          type: 'UnsupportedError',
          title: 'Camera not supported',
          message: 'Your browser does not support the WebRTC MediaDevices API.',
          instruction: 'Please open LabLens in Chrome, Safari, or Firefox.',
        },
      };

    default:
      // Unknown errors must always classify as generic 'error', never as 'denied'
      return {
        status: 'error',
        errorInfo: {
          type: 'UnknownError',
          title: 'Camera error',
          message: rawMessage || 'An unexpected error occurred while starting the camera.',
          instruction: 'Please refresh the page or try again.',
        },
      };
  }
}

/**
 * Safely stops all tracks in a MediaStream.
 */
export function stopCameraStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore individual track stop errors
    }
  });
}

/**
 * Requests the camera stream from the browser.
 */
export async function requestCameraStream(constraints?: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const err = new Error('navigator.mediaDevices.getUserMedia is not supported');
    err.name = 'UnsupportedError';
    throw err;
  }
  return await navigator.mediaDevices.getUserMedia(constraints ?? buildCameraConstraints());
}
