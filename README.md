# Harness Designer V1.8d

Stable V1.8c base plus:
- repaired manual cyan projection guide: denser continuous chord-to-body projection
- Auto is now a real per-strap toggle
- Auto uses a cheap projected-chord route, not the discarded recursive collision solver
- Auto recomputes only after releasing a moved ring; dragging keeps the cheap existing geometry
- projected Auto route is simplified to a small number of meaningful surface points
- existing V1.7c panel/body-fit system is intentionally left intact in this build

This keeps the stable panel baseline while testing the new surface-extraction-style strap idea independently.
