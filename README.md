# Harness Designer V1.7h — coarse incremental auto straps

Built on V1.7f deliberately, so the panel system is back on the last stable panel geometry.

## Auto strap strategy
The automatic strap solver is intentionally less detailed than V1.7g.

After an endpoint move:
1. Reuse the previous auto guide chain if available.
2. Update only the two endpoints.
3. Check every current segment with 5 coarse collision samples.
4. If a segment collides, refine only around its worst sample with 3 extra probes.
5. Insert ONE contact point at the deepest collision.
6. Repeat until no collision remains, or a small point/repair budget is reached.
7. Simplify by deleting any guide whose neighbours can connect collision-free.

Limits:
- maximum 10 total guide points
- maximum 8 repair iterations
- 5 coarse + up to 3 local probes per tested segment

This means simple straps usually need one very cheap pass; complex straps cost more only where needed.

## Performance policy
- during drag: existing cheap strap preview only
- on release: only straps attached to the moved node are refitted
- existing auto guides are reused rather than solving from zero

## Panels
Panel code is intentionally back to V1.7f's stable implementation.
No V1.7g hardware-contour reconstruction is included.
