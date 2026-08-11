# Harness Designer V1.6d

Built on V1.6c.

## Lockerheit on waypoint straps
Manual waypoint straps now respond clearly to Lockerheit again:
- Lockerheit 0 follows the selected surface route closely
- increasing Lockerheit lifts the center of the waypoint route progressively
- endpoint-near controls lift less so ring connections remain stable

## Strap merge on the symmetry axis
If a mirrored strap pair ends up connected to the exact same two merged center
rings, the pair collapses into one physical strap. This is the strap equivalent
of merging a mirrored ring pair on X=0.

## Anchor -> Ring preserves the route
Converting an anchor/crossing point into a ring no longer creates two fresh
straight child straps.

Before the parent is split:
- the visible parent curve is sampled
- each child receives three hidden inherited route controls from its corresponding
  section of that exact parent curve
- width and Lockerheit are retained
- the inherited controls are not shown/count as user-added Auflagepunkte

The result is that adding an anchor and converting it to a ring should visually
leave the strap route in place, instead of making both children clip through the body.

Undo / Ring -> Point still restores the original parent snapshot.
