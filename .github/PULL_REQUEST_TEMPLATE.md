# Pull Request

<!--
Thanks for contributing! Please read Contributing.md first.
The PR title must follow Conventional Commits, e.g. `fix(position): flip when clipped`.
-->

## Summary

<!-- What changed and why. Link the issue it fixes, e.g. "Fixes #123". -->

## Change type

- [ ] Bug fix
- [ ] Feature or behavior change
- [ ] Breaking change (public API: option, attribute, event, CSS variable, `part`, export)
- [ ] Refactor or maintenance
- [ ] Documentation or demo

## Screenshots / recording

<!-- For visual or interaction changes: before/after, desktop and mobile. Delete if not relevant. -->

## Verification

CI runs `yarn check` (deps guard, format, lint, typecheck, tests with coverage, build,
size) and `yarn e2e` (the packed package in a fresh project, real browsers and Electron).
All must pass.

- [ ] `yarn check` passes locally
- [ ] `yarn e2e` passes locally (for packaging, adapter or entry-point changes)
- [ ] Tests added or updated for every behavior change
- [ ] Checked by hand in the demo (`yarn demo`), in Chromium and Firefox, for visual or
      interaction changes

## Review checklist

- [ ] No runtime dependency added (`dependencies` / `peerDependencies` stay empty)
- [ ] Accessibility kept: dialog semantics, focus trap and restore, keyboard support,
      reduced motion ([checklist](../ACCESSIBILITY.md#checklist-for-contributors))
- [ ] Public API changes are documented in `README.md` and
      `scripts/custom-elements-manifest.mjs`
- [ ] New entry points, adapters, options or events are covered in `e2e/consumer/`
- [ ] `CHANGELOG.md` has an entry under **Unreleased**
- [ ] Bundle-size budget changes (`bench/size.mjs`) are explained
