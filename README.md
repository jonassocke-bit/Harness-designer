# Harness Designer V1.4d — Startup Recovery

Fixes the V1.4c startup freeze.

Root cause:
- `globalAnchorSize` called `setupParam(...)`
- its PRESETS configuration was missing
- `setupParam` attempted to read `cfg.min` from `undefined`
- JavaScript stopped before the render loop, making it look like the mannequin failed to load

Fixes:
- adds `globalAnchorSize` presets: 8 / 12 / 16 / 20
- hardens `setupParam` with a slider-derived fallback configuration
- future missing PRESETS entries therefore cannot crash app startup
- all V1.4c UX/topology functionality is otherwise unchanged
