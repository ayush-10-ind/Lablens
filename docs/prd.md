# PRD: LabLens, AR Circuit Lab Assistant

**Hackathon:** Parallax 2026 – Reality, Reimagined (AR/VR/XR)
**Track:** Education (with a Healthcare/Industry extension story)
**Status:** Draft v1 (written 24 Sep 2026)
**Owner:** Ayush Trivedi

---

## 1. Summary

LabLens is a browser-based AR learning assistant. A student points a phone camera at a simple electronics setup on a table or breadboard. LabLens detects the components, labels them in AR, explains their purpose, checks the arrangement against circuit rules, warns about mistakes, plays a 3D guide of the correct circuit, and answers questions through an AI assistant grounded in what the camera sees.

**One-line pitch:** *A lab instructor in your pocket that sees your circuit, explains it, and catches your mistakes before you burn an LED.*

## 2. Problem

- Many schools and colleges have too few lab instructors and too little equipment per student.
- Beginners make repeatable mistakes (no current-limiting resistor, wrong component order, missing power source) that damage parts or teach wrong mental models.
- Textbook diagrams are 2D and abstract. Students cannot map them onto the physical parts in front of them.
- Existing AR apps mostly place a fixed 3D object on a marker. They do not understand what the student has built.

## 3. Goals

| ID | Goal |
|----|------|
| G1 | Recognize 4 to 5 common circuit components from a live camera feed in real time |
| G2 | Overlay names, purposes and safety info on detected components |
| G3 | Flag at least 3 common wiring mistakes with clear, actionable messages |
| G4 | Show an animated 3D guide of the correct circuit and current flow |
| G5 | Let the student ask questions by text or voice and get answers grounded in the detected setup |
| G6 | Run in a mobile browser with no app install |

## 4. Non-goals (for this hackathon)

- Detecting real wire-level connectivity from pixels (not reliably possible in 5 days).
- Supporting more than one circuit type. The MVP has one canonical circuit: *battery → switch → resistor → LED*.
- Headset (Quest/HoloLens) builds.
- Accounts, persistence, analytics or a teacher dashboard (listed as future work only).
- Certified safety guidance. LabLens is a learning aid, not a safety system.

## 5. Target users

- **Primary:** Class 8 to 12 and first-year engineering students doing basic electronics.
- **Secondary:** Teachers who want a low-cost way to give every student a guided lab assistant.

## 6. User stories

1. As a student, I point my phone at my components and see what each part is called, so I can learn the vocabulary.
2. As a student, I tap a labelled part and read what it does and how it is used.
3. As a student, I am warned when my setup is missing something or arranged wrongly, so I fix it before powering it on.
4. As a student, I watch a 3D animation of the correct circuit and current flow, so I understand why it works.
5. As a student, I ask "why does the LED need a resistor?" by voice and get a short answer that refers to my setup.
6. As a teacher, I can show the same experience to a whole class using only phones and a browser link.

## 7. Functional requirements

Priority: **P0** = must ship for the video, **P1** = should ship, **P2** = stretch.

### 7.1 Detection and AR overlay

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Open the rear camera in the browser with permission handling | P0 |
| F2 | Detect battery, resistor, LED, switch (and breadboard as P1) at ≥ 10 FPS on a mid-range phone | P0 |
| F3 | Draw bounding labels with class name and confidence on the live feed | P0 |
| F4 | Tapping a label opens an info card (name, purpose, one safety tip) | P0 |
| F5 | Detections are smoothed across frames to stop label flicker | P1 |
| F6 | Marker-based fallback mode (QR/ArUco or AR.js markers) when detection is unreliable | P1 |
| F6a | Entry gate (rule R9): enter lab mode only when ≥ 2 supported component types are stable for ≥ 5 frames; otherwise never label or guess | P0 |
| F6b | "Not recognized" screen with a Choose experiment list and Try again, so no scan ends in a dead end | P0 |
| F6c | Home screen states what is supported today (for example, "Supported today: LED circuit lab") | P1 |
| F6d | 3D content always comes from a prebuilt content library, never generated from the scan | P0 |

### 7.2 Circuit checking

| ID | Requirement | Priority |
|----|-------------|----------|
| F7 | Build a "detected circuit" from the component list and their left-to-right layout | P0 |
| F8 | Run rule checks (see `rules.md`) and show status: OK / Warning / Error | P0 |
| F9 | Show a plain-language fix for every failed rule | P0 |
| F10 | Virtual Builder mode: student arranges components on screen and gets exact validation | P1 |

### 7.3 3D guide

| ID | Requirement | Priority |
|----|-------------|----------|
| F11 | One animated 3D scene of the correct circuit with current-flow particles | P0 |
| F12 | Play/pause and step-through (Battery → Switch → Resistor → LED) | P1 |
| F13 | LED lights up only when the loop is complete and switch is closed | P1 |
| F14 | Place the 3D guide anchored near the detected setup | P2 |

### 7.4 AI assistant

| ID | Requirement | Priority |
|----|-------------|----------|
| F15 | Text Q&A grounded in the detected component list and rule results | P0 |
| F16 | Voice input via Web Speech API and optional spoken reply | P1 |
| F17 | Answers limited to about 60 words, in simple language | P1 |
| F18 | Offline fallback: canned answers for the 6 most likely questions | P0 |

## 8. Non-functional requirements

- **Performance:** ≥ 10 FPS detection, first meaningful load < 8 s on 4G, model file < 15 MB.
- **Compatibility:** Chrome on Android (primary), Safari on iOS (best effort), desktop Chrome for the recording.
- **Reliability:** The demo must complete end-to-end with no network if the AI call fails.
- **Privacy:** Camera frames are processed on-device. Only the component list and the user's question are sent to the LLM.
- **Accessibility:** Text labels are high contrast, tap targets ≥ 44 px, captions for any spoken output.

## 9. Success metrics

| Metric | Target |
|--------|--------|
| Detection accuracy (mAP@0.5) on own test set | ≥ 0.80 |
| Correct rule verdict on 10 staged test setups | ≥ 9 of 10 |
| Live-demo run with zero crashes across 5 rehearsals | 5 of 5 |
| Q&A answers judged correct and relevant on 10 test questions | ≥ 8 of 10 |
| Video length and submission validity | ≥ 5 min (Round 2), 10 min (Final) |

## 10. Deliverables mapped to the hackathon rounds

| Round | Deliverable | Source in this PRD |
|-------|-------------|--------------------|
| Round 2 (2 to 6 Oct) | Problem statement, detailed PPT, working prototype video (≥ 5 min) | Sections 2, 3, 7 and the demo script in `design.md` |
| Final (9 Oct) | Working model video (10 min) | Full MVP plus polish and stretch items |

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Detector misclassifies under phone-camera lighting | High | Diverse training photos, marker fallback (F6), fixed demo lighting |
| Layout-based circuit inference is only an approximation | Medium | Be honest about it in the PPT; offer Virtual Builder (F10) for exact checks |
| LLM API fails or is slow on camera | Medium | Canned fallback answers (F18), pre-warmed request |
| Model too heavy for the phone | Medium | YOLO nano-size model, 320 to 416 px input, WebGL/WASM backend |
| Not enough time (5-day window) | High | Strict phases and cut lines in `phases.md` |
| iOS Safari quirks with camera or speech | Low | Record the demo on Android or desktop Chrome |

## 12. Assumptions and open questions

- Assumed the team can train a YOLO-family detector on Roboflow (no local GPU needed).
- Unknown: team size and each member's skills. Confirm and adjust task ownership in `phases.md`.
- Unknown: the official problem-statement list and judging rubric. Check the "Read More" section on Unstop and map LabLens onto it.
- Unknown: whether LLM API usage is allowed or free for the team. If not, use the canned-answer mode plus a small rules-based explainer.

## 13. Future work (mention in the PPT only)

Camera-based wire tracing, more circuits (series/parallel, transistor switch), multilingual voice, teacher dashboard with class-level mistake analytics, headset support, and extension to first-aid and equipment-maintenance domains.
