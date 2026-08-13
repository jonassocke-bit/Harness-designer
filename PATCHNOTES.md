# Patchnotes

## V3.2.0 RING MERGE

### Ring-Auswahl
- Kleine Ringe erhalten eine größere, weiterhin ringförmige Touch-Hitbox.
- Die Hitbox skaliert dynamisch mit Ringgröße und Ringstärke.
- Hitbox-Debug zeigt jetzt dieselbe tatsächliche Auswahlzone.

### Ring ↔ Ring Soft-Merge
- Snap-In-Zone für kleine Ringe vergrößert, bleibt aber auf Beinahe-Überlappung begrenzt.
- Soft-Merge bleibt weiterhin reversibel über `Trennen`.
- Same-drag Pullout bleibt erhalten.
- Maximal zwei Ringe dürfen gleichzeitig in einem reversiblen Soft-Merge stecken.
- Versuch eines dritten Soft-Merges zeigt eine einmalige Meldung statt still zu scheitern.

### Endgültig verschmelzen
- Neuer Button `Ringe endgültig verschmelzen` erscheint nur bei einem Soft-Merge.
- Finalisierung entfernt die reversible Gast-Ring-Identität.
- Bereits remappte Riemen und Panel-Boundaries bleiben am Host.
- Danach kann der verbleibende Ring erneut mit einem weiteren Ring soft-gemerged werden.
- Undo/Redo bleibt weiterhin erlaubt; „endgültig“ bedeutet: nicht mehr über den normalen Trennen-Button lösbar.

### Tests
- Guided Test auf 15 ausführliche, ausschließlich ring-/merge-relevante Impact-Tests umgestellt.
- Tests prüfen kleine Hitboxen, Snap-Schwelle, Soft-Merge, Same-gesture Pullout, Trennen, Third-Merge-Block,
  Finalisieren, erneutes Merge, Riemen-/Flächen-Attachments, Mirror-Regressions, Undo/Redo und Reload.

### Unverändert
- Kein Riemen-Solver- oder Panel-Algorithmus absichtlich verändert.
- Bekannte Riemenprobleme bleiben Backlog für den nächsten Solver-Schritt.
