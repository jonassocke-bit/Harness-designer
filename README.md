# Harness Designer V1.8q — SMOOTH PUSH

Based on V1.8p. 3-line collision checks and ~1 cm raycast spacing are unchanged.

Changes:
- up to 30 regularly distributed final curve controls instead of 16 event-like controls
- strongest push peaks preserved
- broader smoothing of only the outward push scalar
- smoothing never drops below the collision-safe requirement
- softer CatmullRom interpolation (.28 instead of .45)

Panels unchanged.
