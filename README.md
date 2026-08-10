# Harness Designer V1.4i — Optional recursive surface-follow routing

This version deliberately preserves the V1.4h fast standard strap engine.

## Standard straps
- `Auflagepunkte = Standard` / level 0 uses the existing V1.4h strap code.
- No recursive surface projection is performed.
- Normal chest/waist/etc. straps keep the same performance and behavior.

## Optional surface-follow mode
Only the selected strap enters this mode when `+ Punkt` is used:

- level 1: 1 internal surface point / 2 sections
- level 2: 3 internal surface points / 4 sections
- level 3: 7 internal surface points / 8 sections
- level 4: 15 internal surface points / 16 sections

Every refinement step recursively halves every existing section and projects the
new midpoint to the mannequin surface.

The guides are NOT stored as fixed world points. They are regenerated from the
current endpoints whenever that strap is updated, so they follow moved rings.

## Orientation
Surface mode uses:
- curve tangent = strap length direction
- mannequin surface normal = strap face direction
- cross product = strap width direction

The frame is propagated continuously and explicitly rejects sudden 180-degree
flips. This targets the twisting/flaring visible around shoulders and other
tight routes.

## Projection continuity
Midpoint projection prefers surfaces whose normals agree with neighboring
surface normals. This reduces jumps from torso to a nearby arm/leg.

## Retained
- visible-only picking
- generous visible strap touch zones
- pair deletion/highlight
- one-shot connect
- mirror pairing
- anchors/crossings/split topology
- continuous axis merge/entmerge
