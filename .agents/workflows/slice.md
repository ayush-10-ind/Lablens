---
description: Build one small vertical slice of LabLens, test it, and commit it
---
1. Read AGENTS.md and the docs/ files relevant to the slice (prd requirement IDs, architecture module, rules).
2. Write a short plan: the requirement IDs covered, the files to touch, and how it will be tested. Wait for approval if the plan changes the architecture.
3. Implement only that slice. Keep changes small and in the module folders described in docs/architecture.md.
4. Add or update Vitest tests for any logic (rules, chain builder, postprocess).
// turbo
5. Run `npm test` and `npm run build`. Fix failures before continuing.
// turbo
6. Run `git status` and review the diff for anything unrelated to the slice.
7. Commit with `feat:`, `fix:` or `test:` and a short summary.
8. Report: what changed, what to test on the phone, and anything left undone.
