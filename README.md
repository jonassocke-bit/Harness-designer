# Harness Designer V1.9a — AUTO CORE

A deliberate strap-core simplification based on the successful V1.8n 3-line detector.

## Straps
- Manual +/- waypoint workflow removed from the UI.
- Auto is always active.
- One dense ~1 cm route is calculated from:
  tensioned base curve -> center/left/right collision measurement -> outward push envelope.
- The final visible ribbon is swept directly along that dense route.
- No reduction to a small waypoint set before rendering.
- 48 render cross-sections for a smoother visible band.
- Route normals drive ribbon orientation.
- Debug toggle optionally shows centerline, both edge traces and a reduced set of path dots.
- Debug is OFF by default.

## Ring-on-ring snap
- ordinary visible rings snap only when centers are almost exactly overlapping
- snap-in radius: .028 scene units
- snap-out radius: .048 scene units
- moved ring is stored as Guest; stationary ring is Host
- attached strap topology is remembered
- a former Host<->Guest strap is restored on separation
- pulling away in the same drag gesture immediately restores the Guest
- the existing link/separate button separates a merged Guest next to its Host
- panel boundary slots use the existing merge-stack mechanism

Axis mirror merge remains separate and unchanged.
