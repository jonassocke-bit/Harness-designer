# Harness Designer V1.6c — waypoint route-preserving endpoint drag

Built from V1.6a intentionally. V1.6b's chord-reset behavior was removed because
it weakened manually placed surface routes and caused straps to clip through the body.

## Behavior
When a ring attached to waypoint straps starts moving:
- the original user-defined waypoint surface positions are snapshotted

During drag:
- no body raycasts are performed for those waypoints
- each waypoint follows the endpoint deformation by weighted translation:
  `(1-t) * deltaA + t * deltaB`
- therefore the full manually defined route moves with the strap rather than
  remaining fixed in world space

On release:
- the already-moved route is projected once back to the body using the original
  V1.6a waypoint reprojection logic
- it is NOT reset to the straight A-B chord
- paired straps receive the exact mirrored master result

This keeps the strong body-following behavior of V1.6a while removing the
"waypoint as fixed nail" effect.

V1.6a master/mirror symmetry, constrained cyan guide, camera movement in point
mode and automatic Lockerheit=0 remain unchanged.
