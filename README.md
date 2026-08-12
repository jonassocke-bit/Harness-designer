# Harness Designer V1.8n — 3-LINE experiment

Based directly on V1.8m.

## Width-aware Auto
The projection now evaluates three lanes at every existing ~1 cm sample:
1. centerline
2. left physical strap edge
3. right physical strap edge

The two outer lanes use the actual current strap width.
If either edge would need to sit farther outside the mannequin, the center
sample is lifted by the minimum amount needed to keep BOTH edges clear.

No additional longitudinal sample density is added for this feature.

The existing tension/simplification pass then runs on the corrected center route.

## Visible test guide
During +Punkt the cyan centerline is shown together with two fainter cyan
outer-edge lines so the three-line constraint can be inspected directly.

## 90-degree ribbon fix
Waypoint/Auto ribbon orientation now interpolates the stored mannequin surface
normals along the route. This normal is projected perpendicular to the curve
tangent and parallel-transported for continuity.

This addresses the case where the path itself was correct but the visible strap
was rotated ~90 degrees around its centerline.

Panels are unchanged.
