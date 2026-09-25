/**
 * Camera module types for LabLens.
 */

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

export type CameraErrorType =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'SecurityError'
  | 'UnsupportedError'
  | 'UnknownError';

export interface CameraErrorInfo {
  type: CameraErrorType;
  title: string;
  message: string;
  instruction: string;
}

export interface VideoDimensions {
  width: number;
  height: number;
}

export interface CameraState {
  status: CameraStatus;
  stream: MediaStream | null;
  error: CameraErrorInfo | null;
  dimensions: VideoDimensions | null;
}
