# Harness Designer V1.4c — UX workflow update

- Build/ring placement is now the permanent default mode.
- `Verbinden` is a one-shot toggle: activate, select two nodes, create one strap, automatically return to build mode.
- Pressing Verbinden again while active cancels it.
- Existing objects remain selectable/editable by default.
- Stronger whole-object selection glow; mirrored partner receives a weaker glow.
- Connect mode subtly marks valid nodes and strongly marks the first selected endpoint.
- Global anchor size in 3D model settings; default 12 mm and applies to all non-ring anchors/crossing points.
- New rings use the last actively edited ring diameter/thickness.
- New straps use the last actively edited width/slack.
- These tool defaults persist in localStorage.
- Merely selecting an object does not change the remembered defaults.
- V1.4b topology/split/crossing logic retained.
