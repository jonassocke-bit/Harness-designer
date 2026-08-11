# Harness Designer V1.6a — Master/Mirror core

Built on V1.5f.

## Linked symmetry
Linked pairs now use a canonical left-side master for spatial calculations.
The opposite side remains materialized internally so undo, deletion and unlinking
remain compatible, but while linked it behaves as a visual mirror:

- paired ring position/normal is forced to exact X reflection of the master
- dragging the right-side visual partner mirrors the input into left/master space
- paired strap mesh geometry is calculated on the master and copied with X reflection
- paired waypoint surface positions/normals are mirrored from the master
- symmetry reconciliation re-enforces the exact mirrored state

Unlinking keeps the currently materialized mirrored state, so there should be no
visual jump when a pair becomes independent.

## Waypoint interaction
- `+ Punkt` guide uses 14 projection intervals instead of 28 to reduce entry delay
- while waiting for a waypoint, one-finger drag rotates the camera normally
- only a tap attempts to place a point; camera navigation keeps point mode active
- V1.5f automatic Lockerheit=0 remains active

The existing save/history representation is retained intentionally to minimize
migration risk.
