---
description: Build, prepare a preview, and list what to test on a real phone
---
// turbo
1. Run `npm run build`.
2. Tell me how to open the deployed preview URL (HTTPS) on my phone. Never assume localhost works for the camera.
3. Give me a checklist for this build only, based on what changed. Always include:
   - Camera opens on the rear camera and permission denial shows the Virtual Builder fallback.
   - FPS is at least 10, or Lite mode appears.
   - Labels follow the parts without flicker.
   - Unsupported scene (textbook page, empty desk) shows the Not recognized sheet with zero labels (R9).
   - Single stray part shows "Add more parts to start the circuit lab."
   - Removing the resistor turns the status red with the fix message, and adding it turns green.
   - Assistant answers, and falls back to canned answers when offline.
4. Ask me to report results as: works, broken, or not tested, for each item.
