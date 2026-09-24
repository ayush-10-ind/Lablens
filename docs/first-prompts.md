# First prompts for the agent

Paste one at a time. Use /slice for each. Keep Flash for small tasks and a stronger model for the hard ones.

## Phase 0: setup
1. "Set up Vite + React + TypeScript + Tailwind + Vitest with the folder layout in docs/architecture.md section 3. Add src/config.ts with the thresholds from docs/rules.md B6. Give me a plan first."
2. "Open the rear camera with getUserMedia in a full-screen video view, handle permission denial with the fallback message from docs/design.md, and draw a test rectangle on a canvas over the video. Then tell me how to deploy it over HTTPS."

## Phase 1: model in the browser (after you have a trained model)
3. "Add a Web Worker that loads public/models/lablens-yolo.onnx with ONNX Runtime Web, runs inference on frames at 320x320, and returns detections. Implement preprocess and postprocess (decode plus NMS) as pure functions with tests. Drop frames when the worker is busy."
4. "Add a test mode that runs the detector on a saved image or a looping video instead of the live camera, so we can verify the pipeline without a camera."

## Phase 2: core
5. "Implement the tracker and smoothing from docs/architecture.md section 4 with tests."
6. "Implement the scene gate (R9), the chain builder, and rules R1 to R6 and R8 using the lablens-rules skill. Add fixtures for T1 to T14."
7. "Draw overlay labels and boxes on the canvas, plus the status chip, hint strip, and check details sheet from docs/design.md."
8. "Add the Not recognized bottom sheet with the Choose experiment list and Try again button (docs/design.md section 3.8)."

## Phase 3: features
9. "Build the three.js 3D guide: closed wire loop, four simple component shapes, current-flow particles, LED glow only on a closed loop, step mode with captions, and reduced-motion handling."
10. "Add the assistant sheet, the canned offline answers, and a serverless /api/ask proxy following docs/architecture.md section 7. Time out after 6 s and fall back to canned answers."

## Phase 4: polish
11. "Review the whole app against docs/prd.md P0 items and list anything missing or untested. Do not change code yet."
