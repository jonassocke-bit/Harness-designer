# Harness Designer V1.7d

## Panel performance
- committed panel keeps the dense surface mesh
- shared subdivided vertices are projected only once and cached during each fit
- this removes most duplicate body raycasts without lowering mesh density
- panel preview during drag remains cheap

## Panel / strap / ring hierarchy
- panels do not write to the depth buffer
- straps have explicit higher render order and a slight forward polygon offset
- rings render above straps
- panel ring opening now ends at the ring inner edge instead of cutting a large gap around the ring

## Cached automatic straps
`Auto` now activates an automatic surface-fit strap.
- pressing Auto calculates one body fit and caches it
- during endpoint drag the strap uses cheap standard preview geometry
- on pointer-up only affected auto straps are refitted
- linked mirror straps calculate only the master side and mirror the result
- Lockerheit changes reuse the cached surface route, so they remain responsive
- manual `+ Punkt` automatically leaves Auto mode

The manual waypoint system remains available.
