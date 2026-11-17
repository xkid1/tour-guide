#!/usr/bin/env node
/**
 * Zero-runtime-dependency guard (`yarn check:deps`, the `Package` CI check).
 *
 * `@xkid1/tour-guide` ships no runtime dependencies: framework adapters receive the framework
 * as an argument instead of importing it. This fails when package.json gains any entry that
 * end users would install, so that can only happen as a deliberate, reviewed change.
 */
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'bundleDependencies',
  'bundledDependencies',
];

const problems = FIELDS.flatMap((field) => {
  const value = manifest[field];
  const names = Array.isArray(value) ? value : Object.keys(value ?? {});
  return names.length > 0 ? [`"${field}" must be empty, found: ${names.join(', ')}`] : [];
});

if (problems.length > 0) {
  console.error('check-zero-deps: the package must have zero runtime dependencies.');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    'Adapters take the framework as an argument (e.g. createReactTourGuide(React)). ' +
      'Tooling belongs in devDependencies.',
  );
  process.exitCode = 1;
} else {
  console.log('check-zero-deps: no runtime dependencies. ✔');
}
