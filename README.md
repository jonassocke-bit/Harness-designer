# Harness Designer V1.5e

Built on V1.5d.

## Exact design symmetry
The bundled Female and Male source meshes/morphs are already mathematically
symmetric around X=0. V1.5e now also enforces symmetry in the SURFACE-PROJECTION
pipeline:

- mirrored node pairs use one canonical surface projection
- the partner point and normal are exact X mirrors
- body morph/height reprojection cannot let paired rings drift apart
- paired strap waypoints are likewise mirrored exactly rather than independently
  raycast on each side

This removes small triangle/raycast differences that previously broke an otherwise
symmetric harness.

## Constrained surface waypoint placement
Select strap -> `+ Punkt`.

The app now computes a cyan surface guideline once:
- current strap is sampled at 28 sections
- samples are projected to the mannequin surface
- a visible cyan line/point guide is drawn on the body
- hidden/back-side sections remain occluded by the body in the render

A waypoint can only be placed within a 34 px touch corridor around this guide.
The tap snaps to the nearest point of the guide, so a strap can no longer be
pulled arbitrarily across the mannequin.

The guide calculation occurs only when entering `+ Punkt` mode, not during normal
building or dragging.

V1.5a picking fix, V1.5b center-axis orientation, V1.5d immediate symmetry
reconciliation and the V1.5 body system are retained.
