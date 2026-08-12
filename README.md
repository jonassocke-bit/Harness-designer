# Harness Designer V1.8o

Based on the successful V1.8n 3-line branch.

## What stays unchanged
- ~1 cm longitudinal projection density
- center + left + right strap-edge checks
- actual strap width is used
- concave regions can still be overspanned
- Auto remains the default
- panels unchanged

## New smoothing
The body/surface route itself is NOT smoothed.
Only the outward correction required by the two outer strap edges is smoothed.

Safety rule:
the smoothed correction may be larger than the raw requirement,
but never smaller.

This removes small saw-tooth / bumpy edge corrections without reintroducing clipping.

## Better final spline
The tensioned route now allows up to 18 route points.
The actual CatmullRom result is checked against the already-computed
3-line-safe route, without new raycasts.

If the final spline swings too far away from that corridor, the most relevant
missing sample is added and the spline is tried again.

This preserves the desired overspanning behavior while making the visible strap
follow the measured route more faithfully.

CatmullRom tension was also reduced from .45 to .32 for a smoother visible strap.
