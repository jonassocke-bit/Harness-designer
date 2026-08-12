# Harness Designer V1.8m

Based directly on V1.8l / V1.8i stable runtime.

## Auto strap change: surface route -> taut route
The dense ~1 cm projected surface path remains the safe starting point.

Auto then performs a cheap simplification without additional raycasts:
- try to connect a current kept sample directly to a later sample
- compare that direct line with every already-known body sample in between
- accept the jump only if the line stays above the virtual body-clearance shell
- otherwise retain the required contact sample

Effect:
- convex obstacles such as breast/shoulder remain contacted
- concave body regions such as under-bust/waist can be bridged
- points are removed rather than added
- runtime stays low because the pass uses the already generated surface samples

## Global distance
The global mannequin offset now also contributes to waypoint/Auto strap clearance.
Rings already used this global offset in `syncNodeTransform()`.

The strap curve itself is NOT forced onto one rigid offset shell. Existing
V1.8i tension/slack behavior remains, with the global offset added on top.

Panels are unchanged.
