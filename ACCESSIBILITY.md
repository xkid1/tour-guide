# Accessibility

A product tour interrupts what someone is doing, so it has to work for everyone: keyboard
users, screen reader users, people who zoom or use high-contrast modes, and people who are
sensitive to motion. This document describes what `<tour-guide>` does for accessibility,
what you are responsible for when you write a tour, and the gaps we know about.

**Target:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA, following the
[WAI-ARIA Authoring Practices dialog (modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
No component makes a page conformant on its own. Conformance also depends on your content,
your colours and the page around the tour.

## Contents

- [What the component provides](#what-the-component-provides)
- [Keyboard](#keyboard)
- [Screen readers](#screen-readers)
- [Visual design](#visual-design)
- [Motion](#motion)
- [Your responsibilities as a tour author](#your-responsibilities-as-a-tour-author)
- [Known limitations](#known-limitations)
- [Testing](#testing)
- [Checklist for contributors](#checklist-for-contributors)
- [Reporting an accessibility issue](#reporting-an-accessibility-issue)

## What the component provides

| Area          | Behaviour                                                                                                     | WCAG 2.2                            |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Semantics     | The popover is `role="dialog"` with `aria-modal="true"`. The title is an `<h2>`; buttons are real `<button>`s | 1.3.1 Info and Relationships, 4.1.2 |
| Name          | The dialog is named by the step title (`aria-labelledby`), or by `ariaLabel` when a step has no title         | 4.1.2 Name, Role, Value             |
| Description   | The body is linked with `aria-describedby`, so it's read when the dialog gets focus                           | 1.3.1                               |
| Icon buttons  | Close and Back have accessible names from `labels.close` / `labels.back`, and the same text as a tooltip      | 1.1.1, 4.1.2                        |
| Progress      | "2 of 5" is in an `aria-live="polite"` region                                                                 | 4.1.3 Status Messages               |
| Focus         | Focus moves to the dialog when a step shows, stays inside it while the tour runs, and returns afterwards      | 2.4.3 Focus Order, 2.1.2            |
| Keyboard      | Every action works from the keyboard: Tab, Enter/Space, Esc, ← / →                                            | 2.1.1 Keyboard                      |
| Focus visible | Buttons show a focus ring on `:focus-visible`                                                                 | 2.4.7 Focus Visible                 |
| Reflow        | The popover never exceeds the viewport. On narrow screens it becomes a screen-wide card or sheet              | 1.4.10 Reflow                       |
| Target size   | Buttons are at least 32×32 px on desktop and 44×44 px on mobile                                               | 2.5.8 Target Size (Minimum)         |
| Motion        | Animations and smooth scrolling are turned off under `prefers-reduced-motion: reduce`                         | 2.3.3 (AAA), good practice          |
| High contrast | In forced-colours mode (e.g. Windows High Contrast) the popover gets a border and the spotlight an outline    | 1.4.11 Non-text Contrast            |
| Text resize   | Text scales with browser zoom, wraps, and the body scrolls when content grows                                 | 1.4.4 Resize Text, 1.4.12           |
| Errors        | A failing hook never leaves the user stuck: the current step stays usable                                     | -                                   |

## Keyboard

| Key                 | Action                                                                                     | Option                                |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `Tab` / `Shift+Tab` | Move between the dialog's buttons and any focusable content. Focus wraps inside the dialog | `trapFocus` (default `true`)          |
| `Enter` / `Space`   | Activate the focused button                                                                | -                                     |
| `Esc`               | Close the tour                                                                             | `closeOnEsc` (default `true`)         |
| `→`                 | Next step (completes the tour on the last step)                                            | `keyboardNavigation` (default `true`) |
| `←`                 | Previous step                                                                              | `keyboardNavigation`                  |

The arrow keys are ignored while focus is in a text field, `<select>` or contenteditable
element, so they never interfere with typing in content you put inside a step. When the
tour ends, focus returns to the element that had it before the tour started
(`restoreFocus`, default `true`). If that element no longer exists, the browser's default
applies.

If you turn off `trapFocus` or `closeOnEsc`, make sure keyboard users still have a clear
way out of the tour.

## Screen readers

When a step shows, focus moves to the dialog, so screen readers announce its name (the
step title) and description (the step content). Moving to another step moves focus again,
so the new step is announced too, and the progress text is announced politely.

`aria-modal="true"` tells assistive technology that the rest of the page is unavailable
while the tour runs. That matches what sighted users experience: the backdrop blocks the
page, apart from the highlighted target.

The highlighted target itself is **not** described to screen reader users automatically.
The spotlight is purely visual. Write step content that makes sense without seeing it (see
below).

## Visual design

### Colour contrast of the default themes

Measured with the WCAG 2.x contrast formula:

| Pair                                          | Light theme | Dark theme | AA requirement |
| --------------------------------------------- | ----------- | ---------- | -------------- |
| Body text on popover                          | 14.63:1     | 14.48:1    | 4.5:1          |
| Secondary buttons (Skip, icons)               | 7.58:1      | 12.02:1    | 4.5:1          |
| Progress text                                 | 4.76:1      | 6.96:1     | 4.5:1          |
| Primary button text (white on `--tg-primary`) | 5.17:1      | **3.68:1** | 4.5:1          |
| Primary button text on hover                  | 6.70:1      | **2.54:1** | 4.5:1          |
| Focus ring against the popover                | **1.96:1**  | **1.65:1** | 3:1 (non-text) |

Values in **bold** fall short of AA. See [Known limitations](#known-limitations) for how
to fix them in your theme today.

When you customise colours with the `--tg-*` variables, check the contrast of every pair
above again. Common pitfalls are a light brand colour behind white button text, and
`--tg-muted-color` on a tinted background.

### Zoom, reflow and text size

The popover's width is limited to the viewport (`--tg-popover-max-width`), its height to
the viewport minus a margin, and the body scrolls when content is long. Below
`mobileBreakpoint` (640px by default) it switches to a screen-wide layout. That's also the
width a desktop browser reaches at 400% zoom on a 1280px screen, so zoomed users get the
same layout as phone users.

### Forced colours

In Windows High Contrast and other forced-colours modes, the dimmed backdrop isn't
visible, so the popover gets a `CanvasText` border and the spotlight a `Highlight` outline
to stay identifiable.

## Motion

- Enter, exit and step animations are short (280ms by default) and use opacity and small
  movements, never flashing.
- Under **`prefers-reduced-motion: reduce`**, all animations and transitions are turned
  off, and scrolling to off-screen targets is instant instead of smooth.
- Set `--tg-animation-duration: 0ms` to turn animations off for everyone, and
  `scrollBehavior: 'auto'` for instant scrolling.

## Your responsibilities as a tour author

The component handles structure and interaction. These are up to you:

1. **Give every step a short, specific `title`.** It's the dialog's accessible name and
   the first thing a screen reader says. If a step has no title, set `ariaLabel` to
   something meaningful.
2. **Write content that works without seeing the highlight.** Instead of "Click here", say
   "Use the **Workspace** menu in the top right to switch teams".
3. **Don't make clicking the target the only way forward.** `allowTargetInteraction` is a
   convenience for pointer users. Keyboard users can't reach the target while focus is
   trapped in the dialog. Always keep Next (or another dialog button) working.
4. **Give images in step content alt text**, and don't put essential information only in a
   GIF or video. Avoid autoplaying media.
5. **Translate everything.** Set `labels` (including `close` and `progress`) and
   `ariaLabel` in the page's language. Use `lang` on content in another language.
6. **Keep tours short and optional.** Users must always be able to skip or close the tour.
   Don't hide the Skip and Close buttons and turn off Esc at the same time.
7. **Check your colours** when you theme the tour (see [Visual design](#visual-design)).
8. **Start tours deliberately.** Opening a tour on page load moves focus unexpectedly.
   Prefer starting from a user action, or once per user (see the README recipes), and
   avoid starting a tour while the user is typing.
9. **Keep content in the page reachable.** For a native `<dialog>`, put `<tour-guide>`
   inside it so the tour sits above the dialog in the top layer.

## Known limitations

We track these openly. Contributions are welcome.

| Limitation                                                                                                                   | Workaround                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The **dark theme's primary button** is below AA contrast (3.68:1, 2.54:1 on hover)                                           | Override `--tg-primary: #2563eb; --tg-primary-hover: #1d4ed8;` (5.17:1 and 6.70:1 with white text)                                  |
| The **default focus ring** is semi-transparent and below 3:1 against the popover                                             | Set an opaque ring, e.g. `--tg-focus-ring: 0 0 0 3px #1d4ed8` (light) or `0 0 0 3px #93c5fd` (dark)                                 |
| The highlighted **target isn't reachable by keyboard** while the tour runs (focus is trapped)                                | Keep the tour's own buttons as the way forward; use `allowInteraction: true` with `trapFocus: false` if users must work in the page |
| **Right-to-left** layouts aren't handled specially: ← / → and `left` / `right` placements are physical                       | Choose placements that suit your layout; the buttons and text follow the page direction                                             |
| The page behind the tour isn't marked `inert`; `aria-modal` relies on screen reader support                                  | Usually fine in current screen readers. Report cases where the page stays reachable                                                 |
| Font sizes are in `px` (`--tg-font-size: 14px`), so they follow browser zoom but not the browser's default text-size setting | Set `--tg-font-size: 0.875rem` (and `--tg-title-size: 1rem`) to follow the user's text size                                         |
| Desktop icon buttons are 32×32 px: they meet 2.5.8 (24px) but not the 44px enhanced size (2.5.5, AAA)                        | Increase them with `tour-guide::part(close-button)` / `::part(back-button)`                                                         |

## Testing

### Automated

The unit and e2e suites check the accessibility structure: dialog role and modality,
accessible names, the focus trap, focus restore, keyboard handling and labels. Automated
tools catch only part of the problems, so changes that affect interaction also need manual
testing.

### Manual checklist

Use the demo (`yarn demo`) or your own app:

- [ ] Complete a whole tour with the keyboard only: Tab, Enter, Esc, ← / →.
- [ ] Focus is visible at every step and never escapes the dialog.
- [ ] After closing, focus is back where it was.
- [ ] With a screen reader, each step's title and content are announced when it appears.
      Recommended pairings: NVDA + Firefox or Chrome, JAWS + Chrome, VoiceOver + Safari
      (macOS and iOS), TalkBack + Chrome (Android).
- [ ] At 200% and 400% browser zoom, the popover stays readable and fully on screen.
- [ ] With reduced motion turned on in the OS, nothing animates and scrolling is instant.
- [ ] In Windows High Contrast (or Chrome's forced-colours emulation), the popover and
      spotlight are visible.
- [ ] On a phone, the buttons are easy to tap and the popover never covers its target.
- [ ] Colour contrast of any custom theme meets AA.

## Checklist for contributors

Every change to the component must keep these working. Reviewers check them, and many are
covered by tests:

- [ ] `role="dialog"`, `aria-modal="true"`, and an accessible name (`aria-labelledby` or
      `aria-label`) on the popover
- [ ] Icon-only buttons have an accessible name
- [ ] Focus moves into the dialog, is trapped while `trapFocus` is on, and is restored on
      close
- [ ] Every new action is available from the keyboard; new shortcuts don't fire while
      typing
- [ ] New animations are disabled under `prefers-reduced-motion: reduce`
- [ ] New colours are `--tg-*` variables with AA contrast in both themes
- [ ] New visual elements stay visible in forced-colours mode
- [ ] Interactive elements are at least 24×24 px (44×44 px on mobile)
- [ ] Nothing important is conveyed by colour or motion alone
- [ ] Tests cover the new behaviour, and the manual checklist above passes for interaction
      changes

## Reporting an accessibility issue

Accessibility bugs are treated as bugs, not feature requests. Please
[open an issue](https://github.com/xkid1/tour-guide/issues/new/choose) and include:

- what you were trying to do, and what happened instead
- the assistive technology and version (for example NVDA 2024.4), browser and OS
- a minimal reproduction, or the tour configuration you used

If you're not sure whether something is a problem, open an issue anyway. We'd rather hear
about it.
