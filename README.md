# Harness Designer V0.11 — Strap Engine 2.0

The old adaptive surface-following strap solver has been removed.

New strap model:
- logical path: Ring/Node A -> one automatic control point -> Ring/Node B
- one midpoint surface query only
- QuadraticBezierCurve3 for a clean, predictable strap path
- slack moves the automatic control point away from the body and slightly down
- rendered endpoints are still trimmed dynamically to the ring edge
- ring wraps remain dynamic
- no per-ribbon-point body raycasts
- ribbon orientation uses a continuous raycast-free transported frame
- only ~16 render samples per full strap
- no iterative 3–5 pass surface solver
- dynamic strap nodes / split rings / crossings remain connected to the new curve
- drag preview from V0.10M/N remains: no full strap rebuild during finger movement

This intentionally favors design stability, speed and visual cleanliness over
physical leather simulation accuracy.
