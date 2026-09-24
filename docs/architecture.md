# Architecture: LabLens

Technical design for the AR Circuit Lab Assistant. Requirements are in `prd.md`, UX in `design.md`, coding and domain rules in `rules.md`.

---

## 1. Architecture at a glance

LabLens is a **client-heavy web app**. All vision and rendering runs in the phone's browser. A tiny serverless function proxies LLM calls so the API key never ships to the client.

```
┌──────────────────────────── Phone browser ────────────────────────────┐
│                                                                       │
│  Camera (getUserMedia)                                                │
│        │ frames                                                       │
│        ▼                                                              │
│  Vision Worker ── ONNX Runtime Web / TF.js (YOLO-nano)                │
│        │ raw detections [{cls, conf, box}]                            │
│        ▼                                                              │
│  Tracker + Smoother  ──► stable detections                            │
│        │                                                              │
│        ├──────────────► Circuit Builder ──► Circuit graph             │
│        │                                        │                     │
│        │                                        ▼                     │
│        │                                  Rule Engine ──► results     │
│        ▼                                        │                     │
│  App State Store  ◄─────────────────────────────┘                     │
│        │                                                              │
│        ├──► Overlay Renderer (Canvas 2D on top of <video>)            │
│        ├──► 3D Guide (three.js scene)                                 │
│        ├──► UI Layer (sheets, chips, action bar)                      │
│        └──► Assistant Client ──► /api/ask ──► LLM  (fallback: canned) │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                   │ HTTPS (component list + question only)
                                   ▼
                    Serverless function (Vercel/Netlify/Cloudflare)
                                   │
                                   ▼
                              LLM provider
```

## 2. Technology choices

| Concern | Choice | Why | Fallback |
|---------|--------|-----|----------|
| Language | TypeScript | Type safety across modules | JavaScript |
| Build | Vite | Fast dev loop, static output | none |
| UI | React (or Preact) + Tailwind | Fast to build sheets and state | Vanilla JS |
| Detector | YOLO nano-size model (e.g. YOLOv8n/YOLO11n) exported to ONNX | Small, fast, trainable on Roboflow | TF.js COCO-SSD for demo of pipeline |
| Inference runtime | ONNX Runtime Web (WebGL/WASM), or TF.js | Runs in the browser, no server | Marker mode |
| 3D | three.js | Well-known, works on mobile | A-Frame |
| Marker fallback | AR.js or js-aruco2 | Reliable tracking | none |
| Voice | Web Speech API (SpeechRecognition + speechSynthesis) | No cost, no server | Text only |
| LLM | Any hosted LLM via serverless proxy | Grounded Q&A | Canned answers |
| Hosting | Vercel / Netlify / Cloudflare Pages | HTTPS is required for camera access | Local tunnel for demos |
| Training | Roboflow (label, augment, train) or Colab | No local GPU needed | Colab notebook |

## 3. Module design

Suggested repo layout:

```
lablens/
├── public/
│   ├── models/lablens-yolo.onnx
│   └── assets/            # glTF models, icons, sounds
├── src/
│   ├── camera/            # camera.ts (stream, resolution, torch)
│   ├── vision/
│   │   ├── detector.worker.ts   # inference in a Web Worker
│   │   ├── preprocess.ts        # resize/letterbox to model input
│   │   ├── postprocess.ts       # decode outputs, NMS
│   │   └── tracker.ts           # IoU tracking + smoothing
│   ├── circuit/
│   │   ├── builder.ts           # detections → circuit graph
│   │   ├── rules.ts             # rule definitions
│   │   └── engine.ts            # run rules, produce results
│   ├── ar/
│   │   ├── overlay.ts           # Canvas 2D labels and boxes
│   │   └── markers.ts           # marker fallback mode
│   ├── guide3d/
│   │   ├── scene.ts             # three.js scene
│   │   └── flow.ts              # current-flow particles
│   ├── assistant/
│   │   ├── client.ts            # calls /api/ask
│   │   ├── prompt.ts            # context builder
│   │   ├── canned.ts            # offline answers
│   │   └── voice.ts             # STT and TTS
│   ├── state/store.ts           # Zustand or simple store
│   ├── ui/                      # React components
│   └── main.tsx
├── api/ask.ts                   # serverless proxy
├── training/                    # notebook, data.yaml, notes
└── docs/                        # prd.md, design.md, architecture.md, rules.md, phases.md
```

## 4. Detection pipeline

1. **Capture:** `getUserMedia({ video: { facingMode: "environment", width: 1280, height: 720 } })`.
2. **Frame grab:** every frame, draw video to an offscreen canvas; skip frames if the worker is busy (drop, don't queue).
3. **Preprocess:** letterbox to 320×320 or 416×416, normalize to `[0,1]`, convert to CHW tensor.
4. **Inference:** run the ONNX model in a Web Worker so the UI thread stays smooth.
5. **Postprocess:** decode boxes, apply confidence threshold (default 0.45), run NMS (IoU 0.5), map back to video coordinates.
6. **Track and smooth:** match detections to previous tracks by IoU; apply exponential smoothing to box coordinates; a track must be seen in ≥ 3 of the last 5 frames to be "stable", and expires after 10 missed frames.
7. **Publish:** write stable detections into the store.

**Performance budget (per frame at ~10 FPS = 100 ms):**

| Stage | Budget |
|-------|--------|
| Preprocess | 8 ms |
| Inference | 60 ms |
| Postprocess and tracking | 10 ms |
| Render overlay | 10 ms |
| Slack | 12 ms |

If measured FPS < 8 for 3 seconds, drop the input size (416 → 320) and show a "Lite mode" badge.

### Detection classes

| ID | Class | Notes |
|----|-------|-------|
| 0 | battery | 9V or AA holder or coin cell holder, keep to one or two forms |
| 1 | resistor | Through-hole, with visible bands |
| 2 | led | Any single color, on and off states |
| 3 | switch | Slide or push button |
| 4 | breadboard | P1 |

### Data and training notes
- 100 to 150 labelled images per class, different backgrounds, lighting, distances and angles, plus some photos with multiple components at once.
- Add 50 to 100 **negative images** (desks, hands, books, phones, textbook pages with diagrams) with no labels, so the model learns what is *not* a component. This supports the R9 "supported scene" gate in `rules.md`.
- Hold out 15% as a test set that is never used for training.
- Augment: brightness, blur, rotation ±15°, mosaic.
- Export ONNX at the fixed input size. Quantize to FP16 or INT8 if size or speed is a problem.

## 5. Circuit builder and rule engine

### 5.0 Scene gate and content library

- **Scene gate (R9):** a small state machine sits between the tracker and the circuit builder. It moves `idle → lab` when ≥ 2 distinct supported types are stable for ≥ 5 frames, and `lab → idle` after 3 s with none. While `idle`, no labels are drawn and no rules run; the UI shows the Not recognized sheet after 2 s.
- **Content library:** a static registry of experiments, for example `{ id: "led-circuit", name: "LED circuit lab", scene: "scenes/led.ts", rules: [...] }`. Each entry has its own recognizer classes, rules and prebuilt 3D scene. The MVP ships one entry. The Choose experiment list renders from this registry, so adding an experiment later means adding a registry entry and its assets, not changing the pipeline.
- **No generative 3D:** the app never creates 3D geometry from camera input. It only loads models from the library.

### 5.1 Circuit model

```ts
type ComponentType = "battery" | "resistor" | "led" | "switch" | "breadboard";

interface DetectedComponent {
  id: string;            // track id
  type: ComponentType;
  box: { x: number; y: number; w: number; h: number };
  confidence: number;
}

interface CircuitModel {
  components: DetectedComponent[];
  chain: DetectedComponent[];   // ordered by layout (see 5.2)
  mode: "camera" | "marker" | "virtual";
}

interface RuleResult {
  id: string;
  status: "pass" | "warn" | "fail";
  title: string;
  fix?: string;
}
```

### 5.2 Layout-based chain inference (camera mode)
- Ignore the breadboard for chain building (it is only context).
- Sort components by the x-coordinate of their box center (left to right). If the spread in y is larger than in x, sort by y.
- The sorted list is the **assumed series chain**. The circuit is assumed to close back to the battery.
- This is an **approximation**, since real wires are not detected. The UI and PPT must describe it that way. **Virtual Builder mode** provides exact chains.

### 5.3 Engine
- Rules are pure functions: `(circuit: CircuitModel) => RuleResult`.
- The engine runs all rules, sorts results by severity, and derives the overall status: any fail → error, else any warn → warning, else OK.
- Results are debounced: a status only changes after it has been stable for 500 ms, so the chip doesn't flicker.
- The full rule list and messages are in `rules.md`.

## 6. 3D guide

- **Scene:** a simple loop of wires on a plane with four low-poly models (battery, switch, resistor, LED). Use glTF assets under 500 KB each, or build them from three.js primitives to avoid loading issues.
- **Current flow:** 30 to 60 small spheres moving along a `CatmullRomCurve3` closed loop; speed is lower after the resistor stage to hint at limited current.
- **LED glow:** emissive material and a point light, enabled only when `switch = closed` and the loop is complete.
- **Step mode:** a timeline object holds four steps; each step highlights one component and changes the caption.
- **Rendering:** cap the pixel ratio at 2, use `powerPreference: "high-performance"`, dispose geometries and materials on exit.

## 7. Assistant

### 7.1 Client flow
1. The user types or speaks a question.
2. The client builds a **context object**: detected component types, rule results, and the current mode.
3. Send `POST /api/ask` with `{ question, context }`.
4. Show the reply. On timeout (> 6 s) or error, use `canned.ts` and label it "Offline answer".

### 7.2 Serverless proxy contract

```http
POST /api/ask
Content-Type: application/json

{
  "question": "Why does the LED need a resistor?",
  "context": {
    "components": ["battery", "led", "switch"],
    "rules": [
      { "id": "R2", "status": "fail", "title": "LED has no resistor" }
    ],
    "mode": "camera"
  }
}
```

```http
200 OK
{ "answer": "Your LED is missing a resistor. Without one, too much current flows and the LED can burn out. Add a resistor in the same path as the LED." }
```

- The function validates input length (question ≤ 300 chars), adds the system prompt, calls the LLM with a low `max_tokens`, and returns only the text.
- Rate limit per IP and add a simple shared-secret header to discourage abuse.
- The API key lives only in the function's environment variables.

### 7.3 System prompt (outline)
- Role: a friendly electronics lab assistant for beginners.
- Use only the provided context about the student's setup; if something is not in the context, say you can't see it.
- Answers ≤ 60 words, simple language, mention a safety tip when relevant.
- Refuse to give guidance on mains voltage or anything hazardous; redirect to a teacher.

### 7.4 Canned answers (offline)
Prepare 6 answers: why resistor, what switch does, what LED polarity means, what battery does, how to fix the current warning, what current flow is.

## 8. State management

Single store with these slices:

| Slice | Contents |
|-------|----------|
| `camera` | permission, resolution, fps |
| `detections` | stable tracks |
| `circuit` | model, rule results, overall status |
| `ui` | active sheet, selected component, mode |
| `assistant` | messages, loading, offline flag |
| `settings` | debug on/off, lite mode, voice on/off |

## 9. Modes and fallbacks

| Mode | When | What changes |
|------|------|--------------|
| **Camera (default)** | Detection works well | ML detection + layout inference |
| **Marker** | Detection is unreliable or lighting is bad | Each component has a printed marker; identity and position come from markers |
| **Virtual Builder** | No camera or for exact validation | Student arranges components on screen, exact chain |
| **Lite** | FPS too low | Smaller model input, less frequent inference |
| **Offline assistant** | LLM fails | Canned answers |

All modes feed the same `CircuitModel`, so the rule engine, 3D guide and UI do not change.

## 10. Security and privacy

- Frames never leave the device.
- Only component names, rule titles and the question are sent to the server.
- No cookies, accounts or analytics in the MVP.
- Serverless proxy has input validation, rate limiting and no logging of question text beyond what the host does by default.
- Serve over HTTPS (required for camera access).
- Only load third-party scripts from trusted CDNs, and pin versions.

## 11. Testing strategy

| Level | What | How |
|-------|------|-----|
| Unit | Rule engine, chain builder, postprocess/NMS | Vitest with fixture circuits |
| Model | mAP, per-class precision/recall, confusion matrix | Held-out test set, report in PPT |
| Integration | Detection → rules → UI status | Replay recorded frames through the pipeline |
| Device | FPS and memory | Test on at least 2 phones (one mid-range Android) |
| Demo | Full script × 5 | Rehearse in the recording environment |

## 12. Deployment

1. `npm run build` → static bundle.
2. Deploy to Vercel/Netlify/Cloudflare Pages; serverless function in `api/`.
3. Set environment variables (`LLM_API_KEY`, `APP_SECRET`).
4. Test the production URL on a phone before every recording.
5. Keep a local build and a screen recording of a good run as a backup in case of network trouble.

## 13. Key decisions and trade-offs

| Decision | Alternative | Reason |
|----------|-------------|--------|
| Web app, not Unity | Unity AR Foundation | No install, faster iteration, easy judge access |
| On-device detection | Server inference | Privacy, no latency, works offline |
| Layout-based chain inference | Wire tracing | Achievable in the time; be transparent that it is approximate |
| Serverless LLM proxy | Direct client calls | Keeps the API key safe |
| One canonical circuit | Many circuits | Depth beats breadth for a 5-day build |
