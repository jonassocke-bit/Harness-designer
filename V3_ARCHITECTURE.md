# V3.1 Modular Architecture

## Migration bridge
Der alte V1.9f2-Code hing an einem gemeinsamen Top-Level-Scope. Eine direkte Umwandlung in ES-Module
würde hunderte Referenzen gleichzeitig verändern.

Deshalb arbeitet V3.1.0 als sichere Zwischenstufe:
1. app.js importiert THREE + GLTFLoader.
2. alle V3-Blöcke werden zuerst vollständig geladen.
3. erst danach werden sie in Originalreihenfolge gemeinsam ausgeführt.
4. die Legacy-Quellen rekonstruieren – abgesehen von Buildtext im Tester – bytegenau den Golden-Code.

Damit sind die Quellblöcke bereits einzeln austauschbar, ohne gleichzeitig das Laufzeitverhalten neu zu schreiben.

## Aktuelle Blöcke
- coreBody
- nodesRouting
- panels
- strapsRuntime
- historyUI
- stripSolvers
- topologySymmetry
- interactionRuntime
- diagnostics
- guidedTest

## Zielarchitektur
Core/State/Scheduler
→ BodySurface/BodyProvider
→ Nodes/SnapMerge
→ StrapModel + PreviewSolver + StripSolver + Renderer
→ PanelModel + ExtractSolver + BoundaryResolver + Renderer
→ Build/Accessory/Photo modes
→ UI

## Reserviert
Body Lab Provider, AccessoryMode, PhotoMode, StrapPaint, PoseController,
MaterialRegistry, ExportService, GeneratorRegistry.
