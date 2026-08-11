# Harness Designer V1.5c — lightweight strap surface waypoints

Built on V1.5b.

## New +Point behavior
The recursive SurfaceLevel subdivision is no longer used by the UI.

`+ Punkt` now adds one real surface waypoint:
A -> P1 -> P2 -> B

Waypoints:
- are hidden / not directly draggable
- store a relative position in the current strap frame
- follow endpoint movement with vector math only
- do NOT raycast against the mannequin during drag
- reproject once onto the body when the endpoint drag ends
- are added at the midpoint of the currently largest uncovered strap section

`- Punkt` removes the last added waypoint.
`Auto` returns to the ordinary zero-waypoint fast strap.

## Paired straps
Paired straps share waypoint count + t positions only.
Each strap projects those points independently onto its own body path, so paired
straps may have different length/shape.

## Performance
Ordinary zero-waypoint straps are completely unchanged.
Waypoint straps stay on the existing cheap standard geometry path and use
Catmull-Rom through explicit waypoint positions.
Recursive body-surface subdivision remains only for backwards compatibility
with old saved projects.

## Body changes
On committed body morph/height changes, waypoints are reprojected once.

No picking, center-axis orientation, body morph, split, crossing, coupling or
normal zero-waypoint strap logic was otherwise rewritten.
