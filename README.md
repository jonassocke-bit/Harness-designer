# Harness Designer V0.10d

Critical startup hotfix for V0.10c.

Cause:
V0.10c removed the visible top header, but it also removed DOM elements still
referenced by JavaScript (`modelBtn`, `resetBtn`, `moreBtn`, `moreMenu`,
`modeTitle`). The first unconditional addEventListener on a missing element
stopped JavaScript immediately in Safari.

Fix:
- top title/header remains visually removed
- required model/reset controls now live in the small ••• overflow menu
- hidden modeTitle retained for internal mode state
- automatic DOM-reference validation added before packaging
- V0.10c compact panel, inline presets, large resize hot-zone retained
