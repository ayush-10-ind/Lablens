# LabLens

Mobile-first web app (Vite + React + TypeScript + Tailwind): an AR-style circuit lab assistant.
A student points a phone camera at circuit parts. The app detects them on-device, labels them,
checks simple rules, shows a prebuilt 3D guide, and answers questions.

## Read first
Before any task, read: docs/prd.md, docs/architecture.md, docs/rules.md, docs/design.md.
Current plan and dates: docs/phases.md. Do not restate these files; follow them.

## Working rules
- One vertical slice per task. Give a short plan first, then implement.
- Rule engine, chain builder and postprocessing are pure functions with Vitest tests (T1 to T14 in docs/rules.md).
- Inference runs in a Web Worker. Never block the UI thread. Drop frames when busy.
- No new dependencies without saying why. All thresholds live in src/config.ts.
- Follow the design tokens and copy in docs/design.md (and DESIGN.md from Stitch, if present). Do not invent a new visual style.
- Rule R9: never guess and never generate 3D from a scan. Only load prebuilt scenes from the content library.
- Circuit checks in camera mode are layout-based approximations. Say so in UI copy and docs.
- Resistor rule wording: "in series with the LED", never "must come before". Order is not electrically required.
- Camera frames never leave the device. Only component names, rule titles and the question go to the server.
- No API keys in code. Use environment variables (see .env.example).

## Definition of done (per task)
Meets the requirement ID in docs/prd.md, runs on a real phone, has empty and error states, and has a test if it contains logic.

## Finish every task by
1. Running the tests and the build.
2. Committing with a message like `feat: short summary`.
3. Telling me in plain language how to test it on my phone.

## Do not
- Edit docs/ unless asked. Propose the change instead.
- Rewrite the architecture or rename core types (CircuitModel, RuleResult) without asking.
- Run destructive commands (rm -rf, force pushes, dependency wipes) without approval.
