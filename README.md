# Harness Designer V1.6b — moving waypoint fix

Built on V1.6a.

Manual surface waypoints no longer behave like fixed nails after an endpoint ring moves.

During drag:
- waypoints follow with cheap vector math
- old local offsets are softened

On pointer-up:
- each waypoint keeps only its relative t position along the strap
- its old spatial offset is discarded for this reprojection
- a new candidate is built from the new strap endpoints
- that candidate is projected once onto the mannequin
- paired straps receive the mirrored result

The user's manually chosen route is still preserved during normal editing and body changes.
