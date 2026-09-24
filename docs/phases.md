# Phases: LabLens

Delivery plan from today to the Final Round. Dates are from the Unstop page (times in IST). Requirements are in `prd.md`, the technical design in `architecture.md`, and rules in `rules.md`.

## Timeline overview

| Date | Day | Milestone |
|------|-----|-----------|
| 24 Sep | Thu | Today: planning begins |
| 30 Sep | Wed | Round 1 closes |
| **2 Oct** | Fri | **Round 2 opens** (problem statement + PPT + ≥ 5 min prototype video) |
| **6 Oct** | Tue | **Round 2 deadline, 11:59 PM** |
| **9 Oct** | Fri | **Final Round**, 9 AM to 6 PM, 10-min working-model video |

> Whether you advance depends on Round 1 results, which I haven't seen. Phase 0 and 1 are worth doing regardless, since they are also good practice and most of the risk is in the model.

---

## Phase 0: Setup and decisions (24 to 25 Sep)

**Goal:** Everyone knows what is being built and the tools work.

- [ ] Confirm team size and assign owners (Vision, Frontend/3D, Assistant/Backend, Docs/PPT/Video). If solo, follow the "Solo cut" at the end.
- [ ] Read the full "Read More" section on Unstop. Note the judging criteria and any provided problem statements. Adjust `prd.md` if needed.
- [ ] Create the repo, Vite + TypeScript project, and deploy an empty page to Vercel/Netlify over HTTPS.
- [ ] Confirm the camera opens on a real phone from the deployed URL.
- [ ] Collect components: 9V battery + clip (or AA holder), 2 to 3 resistors, LEDs (2 colors), a switch, a breadboard, wires.
- [ ] Set up a Roboflow (or Colab) project with the 5 classes.

**Exit criteria:** Deployed "hello camera" page works on a phone. Roles are assigned. Rubric is read.

---

## Phase 1: Data and model (25 Sep to 30 Sep)

**Goal:** A detector that recognizes the components well enough to demo. This is the highest-risk item, so it starts first.

- [ ] Photograph 100 to 150 images per class: varied backgrounds, lighting, angles, distances, partial occlusion, multiple parts per image.
- [ ] Add 50 to 100 negative photos (desks, hands, books, phones, textbook diagrams) with no labels.
- [ ] Label in Roboflow. Split train/val/test (70/15/15). Keep the test set untouched.
- [ ] Train a YOLO nano model. Record mAP and per-class results.
- [ ] Export to ONNX (input 320 and 416) and measure the file size.
- [ ] Prototype inference in the browser (ONNX Runtime Web) with a static image, then live camera.
- [ ] Write the marker-mode fallback spike (AR.js or ArUco) in parallel, as a half-day timebox.

**Exit criteria (decision gate, 30 Sep):**
- mAP@0.5 ≥ 0.75 on the test set **and** ≥ 8 FPS on the phone → proceed with camera mode.
- Otherwise → make **marker mode the primary demo path** and keep ML detection as a "hybrid" feature.

---

## Phase 2: Core pipeline (1 Oct to 2 Oct)

**Goal:** Detection to rules to UI status works end-to-end.

- [ ] Implement the postprocess, tracker and smoothing (`vision/`).
- [ ] Implement the chain builder and rule engine with unit tests for T1 to T10 (`circuit/`).
- [ ] Draw overlay labels and boxes on the live feed (`ar/overlay.ts`).
- [ ] Build the status chip, hint strip, and the check details sheet.
- [ ] Tap a label to open the info card with content for all 4 to 5 components.
- [ ] Implement the R9 scene gate and the Not recognized sheet with the Choose experiment list. Pass staged tests T11 to T14 (textbook diagram, random desk, single part, manual pick).

**Exit criteria:** On a phone, showing battery + switch + resistor + LED gives a green status, and removing the resistor gives a red status with the correct fix message. *(This is the core demo moment. Screen-record a rough version now as insurance.)*

---

## Phase 3: 3D guide and assistant (3 Oct to 4 Oct)

**Goal:** The features that make it more than a labeller.

- [ ] Build the three.js scene: wires, four component models, current-flow particles, LED glow only on a closed loop.
- [ ] Add step mode, captions, play/pause, and reduced-motion handling.
- [ ] Implement the serverless `/api/ask` proxy with rate limiting and input limits.
- [ ] Build the assistant sheet, context line, and suggestion chips.
- [ ] Write the 6 canned answers and the timeout fallback.
- [ ] Add voice input and spoken replies with the Web Speech API (P1, skip if it eats more than half a day).

**Exit criteria:** Full P0 flow works: scan → info → warning → fix → 3D guide → ask a question. Works offline for the assistant via canned answers.

---

## Phase 4: Round 2 submission (5 Oct to 6 Oct)

**Goal:** A clean submission before the 6 Oct 11:59 PM deadline. Aim to submit by the evening of **5 Oct** to leave a buffer.

- [ ] Feature freeze at the start of 5 Oct. Only bug fixes after that.
- [ ] Run the 10 staged test circuits and record results for the PPT.
- [ ] Rehearse the demo script from `design.md` five times in the recording setup (lighting, background, phone mount).
- [ ] Record the ≥ 5 min prototype video (screen mirror + external camera view is ideal). Add captions and clear audio.
- [ ] Build the PPT using the outline in `design.md` (problem, solution, pipeline diagram, screenshots, results, limitations, roadmap).
- [ ] Verify the video plays, the link is accessible, and the file sizes/formats meet the Unstop requirements.
- [ ] Submit on Unstop and screenshot the confirmation.

**Exit criteria:** Submission confirmed, video and PPT downloadable from the submitted links.

---

## Phase 5: Final Round polish (7 Oct to 9 Oct)

**Goal:** A stronger, more convincing 10-minute working-model video.

- [ ] **7 Oct:** Address judge-visible weaknesses: retrain with hard cases (dim light, cluttered table), fix false positives, tune thresholds.
- [ ] **7 Oct:** Add Virtual Builder mode (exact validation, LED polarity rule R7) if not yet done.
- [ ] **8 Oct:** Add one or two stretch items, in this order: marker fallback polish, second circuit (e.g. LED with two resistors in series), multilingual captions.
- [ ] **8 Oct:** Prepare the extended script (see below) and rehearse twice end-to-end.
- [ ] **9 Oct (morning):** Record the 10-minute video, review, re-record if needed.
- [ ] **9 Oct (before 6 PM):** Submit with buffer. Do not wait for the last hour.

**Final video structure (10 min):**

| Time | Content |
|------|---------|
| 0:00 to 1:00 | Problem and impact |
| 1:00 to 4:00 | Live camera demo: detect, label, info cards |
| 4:00 to 6:00 | Failure and fix, rule engine, 3D guide |
| 6:00 to 7:30 | AI assistant (voice) |
| 7:30 to 8:30 | Architecture walk-through and accuracy numbers |
| 8:30 to 9:30 | Fallback modes (marker, Virtual Builder) |
| 9:30 to 10:00 | Limitations, roadmap, close |

**Exit criteria:** Final video submitted before the deadline.

---

## Cut lines (if time runs short)

Cut in this order and never cut anything above the line:

**Never cut:** live detection with labels · one rule-based warning (R3) · 3D guide · text Q&A (with canned fallback) · demo video.

**Cut first → last:**
1. Spoken replies (TTS)
2. Voice input
3. Breadboard class
4. Step-through mode in the 3D guide
5. Virtual Builder
6. Marker fallback (only if camera mode is solid)
7. Suggestion chips

## Solo cut (if you're working alone)

- Use **marker mode plus a smaller ML model** rather than perfecting one detector.
- Use canned answers first, and add the LLM proxy only if there is time.
- Use simple three.js primitives instead of loading glTF models.
- Skip Virtual Builder and voice.
- Keep the PPT to 8 slides.

## Risk checkpoints

| Checkpoint | Date | Question | If "no" |
|------------|------|----------|---------|
| Camera on phone over HTTPS | 25 Sep | Does it work? | Fix hosting before anything else |
| Model gate | 30 Sep | mAP ≥ 0.75 and ≥ 8 FPS? | Switch to marker-primary |
| Core demo moment | 2 Oct | Green → red → green on a phone? | Drop everything else and fix this |
| Feature freeze | 5 Oct | Are P0 items all working? | Apply cut lines |
| Submission buffer | 5 Oct evening | Submitted early? | Submit no later than the morning of 6 Oct |

## Daily rhythm

- 15-minute stand-up: what's done, what's blocked, what's next.
- End-of-day deploy to the production URL and test on a phone.
- Update this file's checkboxes daily so the state is visible.
