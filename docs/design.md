# Design: LabLens

UX, visual and interaction design for the AR Circuit Lab Assistant. Behavior is specified in `prd.md`, rules in `rules.md`, and implementation in `architecture.md`.

---

## 1. Design principles

1. **Camera first.** The live camera view is the main screen. Everything else is an overlay or a sheet on top of it.
2. **Show, then tell.** A label or highlight appears before any paragraph of text.
3. **Calm feedback.** Green, amber and red mean the same thing everywhere. Never use red for something that is merely incomplete.
4. **One hand.** Every control is reachable with a thumb at the bottom of the screen.
5. **Fail gracefully.** If detection or the network fails, the user always has a next step (marker mode, virtual builder, canned answers).

## 2. User flow

```
Landing / permission
      │
      ▼
Live scan (camera + detection)
      │
      ├─► Tap label ───────► Info card (bottom sheet)
      │
      ├─► Status chip ─────► Check details sheet (rules, fixes)
      │
      ├─► "Show me" ───────► 3D guide view (animated circuit)
      │
      ├─► "Ask" ───────────► Assistant sheet (text / voice)
      │
      ├─► Mode switch ─────► Marker mode / Virtual Builder
      │
      └─► Nothing supported seen (R9 fails)
                 └────────► Not recognized sheet ─► Choose experiment / Try again
```

## 3. Screens

### 3.1 Landing / permission
- App name, one-line pitch, a single primary button: **Start scanning**.
- Short explanation: "Your camera stays on your phone. Nothing is uploaded."
- If permission is denied: show how to enable it and offer **Try Virtual Builder** instead.

### 3.2 Live scan (main screen)

```
┌──────────────────────────────┐
│ [status chip: ● Circuit OK ] │  ← top: status + mode switch
│                        [⚙]  │
│                              │
│   ┌────────┐   ┌───┐         │
│   │Battery │   │LED│         │  ← labels over detected parts
│   └────────┘   └───┘         │
│        ┌──────────┐          │
│        │ Resistor │          │
│        └──────────┘          │
│                              │
│                              │
│ ┌──────────────────────────┐ │
│ │ Hint: Add a switch.      │ │  ← single-line hint strip
│ └──────────────────────────┘ │
│  [ Show me ]  [ Ask ]  [ ⓘ ] │  ← bottom action bar
└──────────────────────────────┘
```

- **Label:** rounded rectangle anchored to the top-left of the bounding box. Shows class name and, in debug mode only, confidence.
- **Box outline:** thin 2 px stroke in the component's color, semi-transparent fill.
- **Status chip:** shows OK, Warning or Error and the count of issues. Tapping opens the check details sheet.
- **Hint strip:** the single most important next step, never more than one line.
- **Bottom action bar:** Show me (3D guide), Ask (assistant), Info.

### 3.3 Info card (bottom sheet)
- Component name, icon, a two-sentence purpose, one safety tip, and a "See in 3D" link.
- Example (Resistor): *"Limits how much current flows. Always place one in series with an LED. Value is read from the colored bands."*

### 3.4 Check details sheet
- List of rules with icon (✓ / ! / ✕), rule name, and a plain-language fix.
- Example: **✕ LED has no resistor**. *"Add a resistor in the same path as the LED so it isn't overloaded."*

### 3.5 3D guide view
- Full-screen three.js scene with a soft neutral background and a slowly orbiting camera.
- Controls: Play/Pause, Step ◀ ▶, Reset.
- Steps: 1 Battery pushes current → 2 Switch closes the loop → 3 Resistor limits current → 4 LED lights.
- Current flow shown as small moving particles along the wire path. LED emits a glow only when the loop is complete.
- Caption strip under the scene describes the current step in one sentence.

### 3.6 Assistant sheet
- Chat-style sheet with a text field, mic button and 3 suggestion chips such as *"Why do I need a resistor?"*, *"What does the switch do?"*, *"Is my circuit safe to power?"*.
- A small context line at the top: *"Using: Battery, Resistor, LED"* so the user sees what the AI knows.
- Replies are short, with a speaker icon to read aloud.

### 3.7 Virtual Builder (fallback / P1)
- 2D canvas with draggable component tokens and snap-to-slot positions in a chain.
- Same rule engine and same status chip, but with exact validation.

### 3.8 Not recognized / Choose experiment

Shown when rule R9 (see `rules.md`) fails: the camera sees nothing LabLens supports (a textbook diagram, a random desk, one stray part). The app **never guesses** and never puts labels on unrecognized objects.

```
┌──────────────────────────────┐
│  (camera view, no labels)    │
│                              │
├──────────────────────────────┤
│  I don't recognize this yet. │  ← headline
│  LabLens works with circuit  │  ← one-line explanation
│  parts for now.              │
│                              │
│  Supported today             │
│  ┌────────────────────────┐  │
│  │ LED circuit lab      › │  │  ← Choose experiment list
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ More coming soon       │  │  ← disabled-looking info row
│  └────────────────────────┘  │
│                              │
│  [ Try again ]               │
└──────────────────────────────┘
```

- **Layout:** a bottom sheet over the live camera view. The camera keeps running so pointing at the right thing works instantly.
- **Trigger:** R9 fails for 2 seconds after the app opens or after leaving lab mode. Not shown while models are still loading.
- **Headline and body:** "I don't recognize this yet." plus "LabLens works with circuit parts for now."
- **Choose experiment list:** each row is an available experiment from the content library. Picking one opens it directly, in Virtual Builder mode if the camera can't see the parts. The MVP has one row: **LED circuit lab**.
- **Coming soon row:** a plain informational row, not a button, so the list doesn't look empty and the roadmap is visible.
- **Try again:** a secondary button that dismisses the sheet and resumes scanning.
- **Single stray part:** if exactly one supported component is seen, show the softer hint strip instead of this sheet: "Add more parts to start the circuit lab."
- **No dead ends:** every path from this screen leads to scanning again or opening an experiment.
- **Never shown:** any 3D model generated from the unrecognized scan. 3D content only comes from the prebuilt library.
- **Optional feedback (P2):** a small "Tell us what you scanned" link that sends the text, never the image, to help decide which experiments to add next.

**Home screen addition:** show a "Supported today: LED circuit lab" line under the Start scanning button, so students know what to point at before they try.

## 4. Visual system

### 4.1 Color tokens

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#0B1220` | App background, sheets |
| `--surface` | `#141C2F` | Cards, sheets |
| `--text` | `#F2F5FA` | Primary text |
| `--muted` | `#9AA6BD` | Secondary text |
| `--accent` | `#3DD6C6` | Primary buttons, active state |
| `--ok` | `#39D98A` | Rule passed |
| `--warn` | `#FFB84D` | Incomplete / advisory |
| `--error` | `#FF5C6C` | Rule failed |
| `--battery` | `#F5C542` | Battery overlay |
| `--resistor` | `#C08A5B` | Resistor overlay |
| `--led` | `#FF6B9E` | LED overlay |
| `--switch` | `#7AA2FF` | Switch overlay |
| `--breadboard` | `#B8C2D6` | Breadboard overlay |

Rules: overlay label text must have ≥ 4.5:1 contrast against its label background. Color is never the only indicator (always pair with an icon or word).

### 4.2 Typography
- UI: **Inter** (fallback: system-ui, sans-serif).
- Labels on the camera view: 14 px, semi-bold.
- Sheet body text: 16 px, line-height 1.5.
- Numbers and codes: **JetBrains Mono** (fallback: monospace).

### 4.3 Shape, spacing, motion
- 8 px spacing grid. Corner radius 12 px for cards, 999 px for chips.
- Labels fade in over 150 ms, and move with smoothing (no jumping).
- Status chip color change animates over 200 ms.
- Respect `prefers-reduced-motion`: disable orbiting camera and particle motion, show static arrows instead.

### 4.4 Iconography
- Simple line icons, 24 px, 2 px stroke (e.g. Lucide). Component icons are custom simple SVGs.

## 5. Copy guidelines

- Short, friendly, imperative: *"Add a resistor next to the LED."*
- Explain the why in one clause: *"…so the LED doesn't draw too much current."*
- Never blame the user. Use "Looks like…" for uncertain detections.
- Low-confidence detections say "Looks like a resistor?" and have a dashed outline.

### Message catalog (sample)

| Situation | Message |
|-----------|---------|
| No components detected | "Point the camera at your components on a well-lit surface." |
| Only battery detected | "Battery found. Add a switch, resistor and LED to build the circuit." |
| LED without resistor | "LED found, but no resistor in its path. Add one to protect the LED." |
| No power source | "No battery detected. The circuit needs a power source." |
| No switch | "Add a switch so you can turn the circuit on and off safely." |
| All rules pass | "Circuit looks good. Tap **Show me** to see how current flows." |
| Unsupported scene | "I don't recognize this yet. LabLens works with circuit parts for now." |
| Choose experiment heading | "Supported today" |
| Coming-soon row | "More experiments coming soon." |
| Single stray part | "Add more parts to start the circuit lab." |
| Home screen support line | "Supported today: LED circuit lab" |

## 6. States and edge cases

| State | Behavior |
|-------|----------|
| Camera permission denied | Explain, then offer Virtual Builder |
| Model loading | Skeleton with progress bar and a tip |
| Low light | Banner: "Too dark. Add light or move closer." |
| Low FPS (< 8) | Auto-switch to smaller input size, show small "Lite mode" badge |
| LLM offline / error | Use canned answers and show "Offline answers" note |
| Detection unsure | Dashed outline and a "?" in the label |
| Unsupported scene (R9 fails) | Bottom sheet "Not recognized" with Choose experiment list and Try again (see 3.8). No labels, no status chip |
| Only one supported part seen | Hint strip: "Add more parts to start the circuit lab." No sheet |

## 7. Accessibility

- All buttons have text labels or `aria-label`.
- Tap targets ≥ 44×44 px.
- Warnings are announced through an `aria-live="polite"` region.
- Spoken replies always have visible text.
- Support portrait orientation first, landscape as best effort.

## 8. Demo video storyboard (for Round 2, target ≈ 5 to 6 min)

| Time | Scene | What the viewer sees |
|------|-------|----------------------|
| 0:00 to 0:30 | Problem | Quick voice-over with one statistic on lab access and beginner errors |
| 0:30 to 1:15 | Live detection | Phone scans battery, resistor, LED and switch. Labels appear |
| 1:15 to 2:00 | Info cards | Tap Resistor and LED, show purpose and safety tip |
| 2:00 to 3:00 | **Failure case** | Remove the resistor. Status turns red with the fix message |
| 3:00 to 3:30 | Fix it | Add the resistor. Status turns green |
| 3:30 to 4:15 | 3D guide | "Show me": animated current flow, LED lights up |
| 4:15 to 5:00 | AI assistant | Ask *"Why does the LED need a resistor?"* by voice |
| 5:00 to 5:30 | Impact and roadmap | Slide: who benefits, how it scales, what comes next |

For the **Final round (10 min)**, add: architecture walk-through, Virtual Builder mode, marker fallback, accuracy numbers, and a second circuit if time allows.

## 9. PPT outline (Round 2)

1. Title and team
2. Problem, with one data point
3. Solution overview (one screenshot)
4. How it works (pipeline diagram from `architecture.md`)
5. Key features (detection, rule checks, 3D guide, AI assistant)
6. Live prototype screenshots
7. Tech stack
8. Why AR/XR beats a normal app for this
9. Impact and scalability
10. Accuracy and testing results
11. Limitations, honestly stated, and roadmap
12. Demo video link and thank-you
