# Harness Designer V0.5c

Rebuilt from the last confirmed-loading V0.5 branch.

Fixes:
- strap anchors follow the exact rendered strap curve
- connect mode hides/disables strap midpoint handles
- ring taps are separated from ring dragging by a movement threshold
- build-mode visibility is refreshed consistently
- imported human models are auto-oriented only when one axis is clearly dominant
- orientation/scale logic is bounded to avoid pathological values

This release intentionally avoids the broader regex-generated structural changes from V0.5b.
