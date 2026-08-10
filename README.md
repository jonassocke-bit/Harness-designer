# Harness Designer V1.4l — manual couple / uncouple

Built on working V1.4k without changing strap geometry.

## Toggle in object header
A new ⇄ button sits beside Lock and Delete.

### Rings / points
Linked:
- parameters stay synchronized
- movement remains mirrored

Unlink:
- remembers `previousPartnerId`
- clears active mirror coupling
- both objects can move/edit independently
- automatic symmetry reconciliation will NOT immediately link them again

Reconnect:
- selected object is the master
- former partner is moved to the exact mirrored position
- former partner receives the selected diameter/thickness/point properties
- attached straps update through the existing endpoint topology
- normal automatic symmetry logic resumes

### Straps
Linked:
- only properties are synchronized:
  - width
  - slack
  - surface-follow level / controls
- strap geometry, length and position are ALWAYS determined by its own endpoint rings

Unlink:
- properties can be edited independently
- endpoints are untouched

Reconnect:
- selected strap is master
- former partner receives its properties
- endpoint positions are NOT changed
- straps may therefore have different length/shape while remaining property-coupled

## Automatic grouping
Existing V1.4k geometric symmetry remains:
- symmetric objects automatically form pairs
- geometrically broken automatic pairs can re-form later
- explicitly manually unlinked objects are excluded until the user presses ⇄ again
