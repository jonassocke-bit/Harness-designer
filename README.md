# Harness Designer V0.5d

## Editor modes
- Ring mode: ring taps open ring diameter/thickness editor; new rings can be placed.
- Connect mode: ring taps define connection endpoints; strap taps open strap editor.
- Strap midpoint handles are hidden in Connect mode as requested.
- Strap anchors are edited in Connect mode.

## Mirror toggle
- Mirror is independent from Ring/Connect mode.
- Tapping Mirror never changes the active construction tool.
- White = enabled, dark = disabled.

## Manual mannequin rotation
- New “Modell” rotation control with X/Y/Z sliders (-180° to +180°).
- Automatic orientation removed.
- Changing mannequin orientation clears the current harness so anchors cannot remain attached to stale surface coordinates.

## Existing features
- per-ring diameter and material thickness
- exact rendered-curve strap anchors
- flat straps, ring wraps, width/slack
