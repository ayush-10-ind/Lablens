import { useState, useEffect, useCallback, useRef } from 'react';
import { CameraErrorInfo, CameraState, CameraStatus, VideoDimensions } from './types';
import { classifyCameraError, requestCameraStream, stopCameraStream } from './camera';

export interface UseCameraOptions {
  autoStart?: boolean;
}

export interface UseCameraReturn extends CameraState {
  start: () => Promise<void>;
  stop: () => void;
  retry: () => Promise<void>;
  updateDimensions: (dimensions: VideoDimensions) => void;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { autoStart = false } = options;

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraErrorInfo | null>(null);
  const [dimensions, setDimensions] = useState<VideoDimensions | null>(null);

  // Keep refs for active stream and status to stabilize callbacks and prevent race conditions
  const streamRef = useRef<MediaStream | null>(null);
  const statusRef = useRef<CameraStatus>('idle');
  const isMountedRef = useRef<boolean>(true);

  const stop = useCallback(() => {
    if (streamRef.current) {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    }
    statusRef.current = 'idle';
    if (isMountedRef.current) {
      setStream(null);
      setStatus('idle');
      setError(null);
      setDimensions(null);
    }
  }, []);

  const start = useCallback(async () => {
    // If already active with live tracks, don't start duplicate stream
    const hasLiveTracks = streamRef.current
      ?.getVideoTracks()
      .some((track) => track.readyState === 'live');
    if (streamRef.current && hasLiveTracks && statusRef.current === 'ready') {
      return;
    }

    // Guard against concurrent start calls
    if (statusRef.current === 'requesting') {
      return;
    }

    // Stop any existing stream before starting a new request
    if (streamRef.current) {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    }

    statusRef.current = 'requesting';
    setStatus('requesting');
    setError(null);

    try {
      const newStream = await requestCameraStream();

      // Guard against race conditions if unmounted while permission dialog was active
      if (!isMountedRef.current) {
        stopCameraStream(newStream);
        return;
      }

      // Verify the stream contains at least one active video track
      const videoTracks = newStream.getVideoTracks();
      if (videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
        throw new DOMException('No live video track found in stream', 'TrackStartError');
      }

      streamRef.current = newStream;
      statusRef.current = 'ready';
      setStream(newStream);
      setStatus('ready');
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      const classified = classifyCameraError(err);
      statusRef.current = classified.status;
      setStatus(classified.status);
      setError(classified.errorInfo);
      setStream(null);
      streamRef.current = null;
    }
  }, []);

  const retry = useCallback(async () => {
    stop();
    await start();
  }, [start, stop]);

  const updateDimensions = useCallback((dims: VideoDimensions) => {
    if (isMountedRef.current) {
      setDimensions(dims);
    }
  }, []);

  // Isolate unmount cleanup: only run teardown when component actually unmounts
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        stopCameraStream(streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  // Handle autoStart if requested, decoupled from unmount cleanup
  useEffect(() => {
    if (autoStart) {
      void start();
    }
  }, [autoStart, start]);

  return {
    status,
    stream,
    error,
    dimensions,
    start,
    stop,
    retry,
    updateDimensions,
  };
}
