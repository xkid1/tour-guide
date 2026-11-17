# Security Policy

`@xkid1/tour-guide` runs inside other people's applications, so we take security reports
seriously. Thank you for helping keep it and its users safe.

## Supported versions

The project is pre-1.0. Security fixes are released for the **latest minor version** only.

| Version          | Supported |
| ---------------- | --------- |
| 0.x (latest)     | ✅        |
| older 0.x minors | ❌        |

Once 1.0 ships, the latest major version will receive security fixes, and the previous
major will receive fixes for critical issues for 6 months after the new major is released.

## Reporting a vulnerability

**Please do not report security issues in public GitHub issues, discussions or pull
requests.**

Report them privately through GitHub's private vulnerability reporting:

1. Go to <https://github.com/xkid1/tour-guide/security/advisories/new> (the repository's
   **Security** tab, then **Report a vulnerability**).
2. Describe the issue. The more of the following you can include, the faster we can act:
   - the affected version(s) and entry point (`/browser`, `/react`, the IIFE bundle…)
   - the impact: what an attacker can do, and under what conditions
   - a minimal proof of concept (an HTML page or a small repository)
   - the browser or WebView, and any relevant configuration (CSP, options used)
   - any fix or mitigation you suggest

If you can't use GitHub's reporting form, open a public issue that says only that you'd
like a private channel. Don't include any details.

### What to expect

This is a small, volunteer-maintained project. We aim to:

| Step                                                | Target                  |
| --------------------------------------------------- | ----------------------- |
| Acknowledge your report                             | within 3 business days  |
| Confirm the issue, or explain why it isn't one      | within 10 business days |
| Release a fix for confirmed high or critical issues | within 30 days          |

We'll keep you updated as we go, agree a disclosure date with you, and credit you in the
advisory and release notes, unless you prefer to stay anonymous. Fixes are announced as
GitHub Security Advisories (which feed `npm audit`) and noted in
[CHANGELOG.md](CHANGELOG.md).

Please give us a reasonable chance to release a fix before disclosing publicly, and don't
access, modify or delete other people's data while researching.

## Scope

**In scope**: code in this repository and the packages published from it:

- the `<tour-guide>` element and every published entry point (`@xkid1/tour-guide`,
  `/browser`, `/react`, `/vue`, `/svelte`, `/angular`, `/electron`, `/android`, `/resume`)
  and the IIFE bundle
- the native WebView bridge (`connectNativeBridge`)
- the release pipeline (GitHub Actions workflows, npm publishing)

Examples of in-scope issues: script execution from string `content` while `allowHtml` is
off, a way to bypass the bridge's `acceptMessage` filter or command allow-list, or a
compromised build artifact.

**Out of scope**:

- XSS through features that are documented as trusted-only, such as `allowHtml: true` with
  untrusted input, untrusted `icons` markup, or untrusted CSS in the `styles` option. See
  [Using the component securely](#using-the-component-securely).
- Vulnerabilities in your application, your framework, or the browser itself.
- The demo page (`demo/`), which is a local development aid and is not published.
- Reports from automated scanners with no demonstrated impact.

## Using the component securely

The component is designed to be safe by default. These are the places where you hand it
something it has to trust.

### Content and HTML

- **Strings render as text.** `title`, string `content`, `labels` and `ariaLabel` are
  inserted as text nodes, so user-provided strings are safe there.
- **`allowHtml: true`** (option, step field or `allow-html` attribute) parses string
  `content` as HTML. Only use it with content you control, or sanitize it first (for
  example with DOMPurify). Scripts in parsed HTML don't execute, but event-handler
  attributes and other HTML injection can.
- **`icons`** are inserted as markup. Only pass SVG you wrote or bundled yourself.
- **Content functions and nodes**: when `content` is a function or a DOM node, you build
  the DOM yourself, so the usual rules for your own code apply.
- **Slotted content** (`slot="step-<id>"`) is part of your page and is sanitized the way
  your page or framework sanitizes everything else.
- **Declarative `<tour-step>` children** are cloned from your own markup. Don't build that
  markup from untrusted input on the server without escaping it.

### CSS

- The **`styles`** option is injected into the shadow root as CSS. Untrusted CSS can
  restyle or hide the tour, and can load external resources through `url()`. Only pass CSS
  you control.
- The component never builds CSS selectors from user input. Step `target` selectors are
  passed to `querySelector` as written, so don't build them from untrusted strings.

### Content Security Policy

- The component never uses `eval`, `new Function` or inline scripts.
- Styles, including CSS from the `styles` option, are applied through constructable
  stylesheets (`adoptedStyleSheets`), which need no `style-src 'unsafe-inline'` in current
  browsers. In older WebViews without constructable stylesheets it falls back to `<style>`
  elements, which a strict `style-src` would block.
- **Trusted Types:** the built-in icons, and `content` when `allowHtml` is on, are parsed
  by assigning strings to `innerHTML` (on a `<template>`). Pages that enforce
  `require-trusted-types-for 'script'` need a default Trusted Types policy that allows
  this markup, or the tour can't render.

### Native bridge (Android / iOS / React Native)

`connectNativeBridge()` listens for `message` events and runs a fixed list of commands
(`start`, `next`, `back`, `goTo`, `skip`, `complete`, `close`, `refresh`). Anything else
is ignored. Any script in the page or in an embedding frame can post messages, so **set
`acceptMessage`** to check `event.origin` (and `event.source`, where it applies):

```js
TourGuide.connectNativeBridge(tour, {
  acceptMessage: (event) => event.origin === '' || event.origin === location.origin,
});
```

Pass `commands: false` if the native side only needs to receive events.

### Saved progress (`/resume`)

`enableResume()` stores only the step index and step `id` in `localStorage`, under
`tour-guide:<key>`. Any script on the same origin can read and change it, so don't put
sensitive data in step ids. Invalid stored values are ignored.

## Supply chain

- **Zero runtime dependencies.** `dependencies` and `peerDependencies` are empty, and
  framework adapters receive the framework as an argument instead of importing it.
- Releases are published from GitHub Actions with **npm provenance**, so you can verify
  that a tarball was built from this repository (`npm audit signatures`).
- **CodeQL** runs on every pull request and weekly. **Dependency Review** checks pull
  requests for vulnerable dev dependencies, and **Dependabot** proposes updates weekly. An
  **OpenSSF Scorecard** tracks repository security practices.
- Every release is tested as a packed tarball in a fresh consumer project (`yarn e2e`)
  before it is published.
