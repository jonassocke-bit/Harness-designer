# Harness Designer V1.8b CLEAN — startup repair

Based on V1.8a CLEAN.

Startup failure cause:
V1.8a still contained orphan fragments from the later automatic strap solver,
including an undefined auto-mode branch and a malformed extra body following
`updateAttachedStraps()`.

V1.8b:
- reapplies the critical strap functions directly from V1.6e
- removes every later auto-solver helper/call/property
- keeps the isolated panel implementation from the clean build
- changes no intended panel feature

This is the corrected clean baseline.
