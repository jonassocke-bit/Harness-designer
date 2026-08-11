# Harness Designer V1.5d

## Manual surface waypoint placement
Select a strap -> `+ Punkt` -> tap the desired location directly on the mannequin.

The tapped 3D body surface position becomes the waypoint. The app only derives
the waypoint order (`t`) from the current strap curve. The user therefore tells
the strap where it should pass, rather than merely which part of the strap is bad.

Waypoint mode is one-shot and returns to normal interaction after one valid tap.
A paired strap receives the mirrored body-space waypoint and projects it onto its
own side of the mannequin.

## Immediate symmetry reconciliation
New mirrored rings and newly created mirrored straps now run dynamic symmetry
reconciliation in the same creation transaction, rather than waiting for a later
move/add action.

Built on V1.5c; V1.5a picking fix, V1.5b center-axis orientation and V1.5 body
system are retained.
