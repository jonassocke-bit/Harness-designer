# Harness Designer V1.8g

V1.8f plus local convex-surface refinement.

Base projection density remains ~1 sample every 1.7 cm.

New:
- each straight cyan segment between neighbouring projected samples is checked
- if that segment disappears into the mannequin, only that segment is subdivided
- the midpoint is projected back onto the mannequin
- local refinement repeats up to depth 2
- flat/simple regions receive no extra work
- shoulder/breast/high-curvature regions become locally denser
- Auto uses the same refined route before its normal simplification

This is intended to fix the case where valid projected endpoints were connected by
a straight line that cut through a convex shoulder/chest surface.
Panel logic is unchanged.
