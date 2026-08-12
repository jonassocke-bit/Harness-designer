# Harness Designer V1.8p — CLEAN PUSH

Based directly on V1.8n 3-LINE.

This build deliberately removes later corridor/spline experiments.

## Clean Auto pipeline
1. Original naturally tensioned no-waypoint strap curve is the base.
2. Dense ~1 cm center projection is measured.
3. Left and right physical strap edges are measured too.
4. These measurements produce only a REQUIRED OUTWARD PUSH value.
5. Push values are softened over neighbouring samples.
6. The body may only push the tensioned base curve OUTWARD.
7. Concave regions therefore remain naturally overspanned.
8. Only meaningful push-envelope changes become Auto control points.

The measured body route no longer directly dictates the final strap path.

## Removed / avoided
- no route-corridor spline repair
- no extra spline reconstruction pass
- no extra longitudinal sampling
- no body-following simplifier controlling the final strap shape
- no smoothing of the mannequin surface route itself

## Ribbon orientation
The V1.8n waypoint-surface-normal orientation fix remains in place to prevent
the occasional 90-degree ribbon rotation.

## Manual guide
The visible +Punkt guide remains the 3-line diagnostic:
center + left edge + right edge.

Panels are unchanged.
