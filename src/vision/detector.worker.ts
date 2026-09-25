/**
 * Web Worker for LabLens vision inference and tracking.
 * Runs off the main UI thread.
 *
 * Incoming messages: VisionWorkerRequest
 * Outgoing messages: VisionWorkerResponse
 */

import { VisionWorkerHandler } from './workerHandler';
import { VisionWorkerRequest } from './types';

const handler = new VisionWorkerHandler();

self.onmessage = async (event: MessageEvent<VisionWorkerRequest>) => {
  const response = await handler.handleMessage(event.data);
  if (response) {
    self.postMessage(response);
  }
};
