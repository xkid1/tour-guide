/**
 * Writes dist/custom-elements.json (Custom Elements Manifest) so IDEs, Storybook and
 * framework tooling can autocomplete <tour-guide> attributes, events and parts.
 */
import { writeFileSync } from 'node:fs';

/**
 * @param {string} name
 * @param {string} type
 * @param {string} description
 */
const attr = (name, type, description) => ({ name, type: { text: type }, description });

/**
 * @param {string} name
 * @param {string} description
 */
const event = (name, description) => ({
  name,
  type: { text: 'CustomEvent' },
  description,
});

const manifest = {
  schemaVersion: '2.1.0',
  modules: [
    {
      kind: 'javascript-module',
      path: 'dist/libs/tour-element/tour-element.js',
      declarations: [
        {
          kind: 'class',
          name: 'TourGuideElement',
          tagName: 'tour-guide',
          customElement: true,
          description: 'Accessible, responsive product-tour custom element.',
          attributes: [
            attr(
              'open',
              'boolean',
              'Starts the tour when present; reflects active state.',
            ),
            attr('start-at', 'number', 'Step index to start at.'),
            attr('theme', "'light' | 'dark' | 'auto'", 'Colour theme.'),
            attr(
              'placement',
              "'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center'",
              'Default placement.',
            ),
            attr(
              'mobile-breakpoint',
              'number',
              'Below this width (px) the popover is a sheet.',
            ),
            attr(
              'mobile-placement',
              "'follow' | 'auto' | 'top' | 'bottom'",
              'Mobile layout: follow the target (default) or dock a sheet to a screen edge.',
            ),
            attr(
              'missing-target',
              "'center' | 'skip'",
              'What to do when a target is missing.',
            ),
            attr('scroll-behavior', "'auto' | 'smooth' | 'instant'", 'Scroll behaviour.'),
            attr('aria-label', 'string', 'Dialog name when a step has no title.'),
            attr('offset', 'number', 'Gap between target and popover in px.'),
            attr(
              'viewport-margin',
              'number',
              'Minimum distance to the viewport edge in px.',
            ),
            attr(
              'spotlight-padding',
              'number',
              'Padding around the highlighted target in px.',
            ),
            attr('allow-html', 'boolean', 'Render string content as trusted HTML.'),
            attr('scroll-into-view', 'boolean', 'Scroll targets into view.'),
            attr('restore-focus', 'boolean', 'Restore focus when the tour ends.'),
            attr('backdrop', 'boolean', 'Dim the page ("false" to disable).'),
            attr('allow-interaction', 'boolean', 'Let clicks pass through the backdrop.'),
            attr(
              'allow-target-interaction',
              'boolean',
              'Let clicks reach the highlighted target (default true).',
            ),
            attr('close-on-esc', 'boolean', 'Close on Escape.'),
            attr(
              'close-on-backdrop-click',
              'boolean',
              'Close when the backdrop is clicked.',
            ),
            attr('keyboard-navigation', 'boolean', 'Arrow-key navigation.'),
            attr('show-progress', 'boolean', 'Show "1 of N".'),
            attr('show-back', 'boolean', 'Show the back icon button.'),
            attr('show-skip', 'boolean', 'Show the skip button.'),
            attr('show-close', 'boolean', 'Show the close icon in the header.'),
            attr('trap-focus', 'boolean', 'Trap Tab focus inside the popover.'),
            attr('label-back', 'string', 'Back button label.'),
            attr('label-next', 'string', 'Next button label.'),
            attr('label-skip', 'string', 'Skip button label.'),
            attr('label-complete', 'string', 'Complete button label.'),
            attr('label-close', 'string', 'Close button label.'),
          ],
          events: [
            event('tour-start', 'Tour started.'),
            event('tour-before-change', 'Before a step change (cancelable).'),
            event('tour-step-change', 'A step was shown.'),
            event('tour-complete', 'Completed via the last step.'),
            event('tour-skip', 'Skipped.'),
            event('tour-close', 'Closed (icon, Escape, backdrop or API).'),
            event('tour-end', 'Ended for any reason; detail.reason tells which.'),
            event(
              'tour-error',
              'A hook, content() or target() threw (cancelable: silences the console log).',
            ),
          ],
          cssParts: [
            'root',
            'backdrop',
            'spotlight',
            'popover',
            'arrow',
            'header',
            'title',
            'close-button',
            'body',
            'footer',
            'progress',
            'actions',
            'back-button',
            'skip-button',
            'primary-button',
            'next-button',
            'complete-button',
          ].map((name) => ({ name })),
          slots: [
            {
              name: 'step-<id>',
              description: 'Custom content for the step with that id (or index).',
            },
          ],
        },
      ],
      exports: [
        {
          kind: 'custom-element-definition',
          name: 'tour-guide',
          declaration: { name: 'TourGuideElement' },
        },
      ],
    },
  ],
};

writeFileSync('dist/custom-elements.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log('custom-elements-manifest: dist/custom-elements.json');
