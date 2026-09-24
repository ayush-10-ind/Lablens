---
name: lablens-rules
description: Use when implementing or changing LabLens circuit rules, the scene gate (R9), rule messages, or rule tests. Covers rules R1 to R9, severities, and the staged test circuits.
---
# LabLens circuit rules

Source of truth: docs/rules.md Part B. Read it before editing rules.

## Model
- Rules are pure functions: `(circuit: CircuitModel) => RuleResult`.
- Overall status: any fail -> Error, else any warn -> Warning, else OK. `info` never changes color.
- Status changes only after 500 ms of stability (debounce).

## Rules
- R1 battery present (fail). R2 LED present (warn). R3 LED has a series resistor (fail).
- R4 switch present (warn). R5 loop can close (warn). R6 one resistor per LED (warn).
- R7 LED polarity, Virtual Builder only (fail). R8 unknown low-confidence item (info).
- R9 scene gate: enter lab mode only when at least 2 distinct supported types are stable for 5 frames.
  When R9 fails: no labels, no status chip, show the Not recognized sheet. Exit lab mode after 3 s with none.

## Wording
- Say "in series with the LED" or "in its path". Never say the resistor must come before the LED.
- Messages and fixes are in docs/design.md (message catalog). Reuse them, do not rephrase.

## Testing
- Every rule change needs a Vitest fixture. Staged circuits T1 to T14 are listed in docs/rules.md.
- T11 and T12 (textbook page, random desk) must produce zero labels.
