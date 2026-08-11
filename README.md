# Harness Designer V1.7g — minimal-contact straps + fixed panel borders

Built on V1.7f.

## Minimal-contact automatic straps
Auto straps no longer interpret "far from body surface" as a reason to hug the body.

For each candidate strap segment:
- sample 20/40/50/60/80%
- find the nearby body surface and its outward normal
- compute signed clearance `(candidate - surface) dot normal`
- only if the segment enters the body / safety clearance is a contact guide inserted
- recursive refinement occurs only around blocked sections

After refinement a simplification pass removes each internal contact guide whose two
neighbours can be connected collision-free.

Result:
- free span stays free / taut
- strap contacts a breast, shoulder or hip only while that body volume blocks it
- as soon as the body falls away, the strap leaves the body tangentially
- a lower ring can force a second contact region if necessary

## Hardware-locked panel boundary
Panel outer boundaries now follow actual hardware rather than a planar approximation.

For each boundary edge:
- if a strap exists, its actual current 3D curve is sampled
- samples are offset to the strap's inner edge
- at ring corners neighbouring edges are connected by an arc on the ring's inner edge

The committed panel fit keeps this hardware contour fixed in 3D.
Only interior vertices are projected to the mannequin. A transition band smoothly blends
from the fixed boundary to the fully body-fitted interior.

This prevents large curved panels from pulling their outer edge away from straps/rings.
The same hardware contour is used during the fast drag preview.
