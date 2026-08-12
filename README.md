# Harness Designer V1.8j — unified global surface offset

Based on V1.8i.

The previous build used several unrelated distances:
- ring visual: global surface offset + ring tube radius
- cyan guide: fixed magic lift
- waypoint strap: length-dependent base clearance
- Auto preview: another surface clearance

V1.8j defines one virtual design shell above the mannequin.

Global surface offset means:
- ring underside sits on BODY + global offset
- strap underside sits on BODY + global offset
- strap centreline therefore uses global offset + half strap thickness
- cyan raycast guide displays on that exact strap centreline shell
- Auto projection uses the same shell
- manual surface waypoints use the same shell
- ring attachment points use the actual rendered ring centre plane

Slack remains an additional strap-only bulge; it no longer replaces or conflicts
with the global surface offset.

Projection spacing remains ~1 cm and Auto remains ON by default.
Panels are unchanged.
