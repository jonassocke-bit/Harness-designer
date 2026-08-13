# Harness Designer V3 architecture contract

Golden baseline: V1.9f2. Do not replace working behavior while modularizing it.

## Frozen reference modules
- Ring/UI behavior: legacy V1.9c → V1.9f2 lineage
- Strap reference: V1.9c Strip; V1.8n 3-line kept as comparison target
- Panel reference: V1.9f2 fast body-triangle extraction + filled boundary

## Migration rule
One subsystem is extracted at a time. Before and after extraction, visible behavior must match.
No feature work during migration.

## Planned stable modules
core/AppKernel
core/EventBus
core/DirtyScheduler
core/ProjectState
core/History
core/Persistence
body/BodySurface + BodyProvider
nodes/NodeModel + NodeRenderer + NodeHitbox
topology/SnapMergeService
straps/StrapModel + StrapPreviewSolver + StripSolverLegacy + StripSolverNext + StrapRenderer
panels/PanelModel + PanelPreviewSolver + PanelExtractSolverLegacy + PanelBoundaryResolver + PanelRenderer
modes/BuildMode + AccessoryMode + PhotoMode
tools/RingTool + ConnectTool + PanelTool + StrapPaintTool
accessories/AccessoryModel + AccessoryLibrary + AccessoryAttachment + AccessoryRenderer
photo/PoseController + CameraPreset + LightingRig + Background + PhotoRenderer
materials/MaterialRegistry
anchors/AnchorService
crossings/CrossingService
export/ExportService
generators/GeneratorRegistry

## Compatibility contract
Solvers return data only. Renderers render data only.
Body access occurs only through BodySurface after migration.
Nodes never calculate straps/panels directly; the scheduler invalidates dependents.
Legacy solvers are never overwritten by experimental solvers.


## Regression harness contract

Every patch declares `changedModules`.

The test harness derives its manual Impact tests from an explicit dependency map.

Test levels:
- Smoke: 1–3 fast checks after nearly every patch.
- Impact: only workflows that may be affected by the changed modules.
- Full: milestone regression.

Golden known issues are recorded separately from regressions.
A failure is marked as a regression only if the Golden baseline expected that workflow to pass.

Automatic state/invariant checks should replace manual testing wherever possible.
