/**
 * The published package itself: manifest, `exports` map, files and import specifiers.
 * Runs in plain Node with no DOM.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { Script } from 'node:vm';

const require = createRequire(import.meta.url);
const NAME = '@xkid1/tour-guide';
const ROOT = dirname(require.resolve(`${NAME}/package.json`));
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const ROOT_API = [
  'DEFAULT_ICONS',
  'DEFAULT_LABELS',
  'DEFAULT_OPTIONS',
  'DEFAULT_TAG_NAME',
  'TOUR_STYLES',
  'TourGuideElement',
  'TourGuideError',
  'TourManager',
  'computePosition',
  'defineTourGuide',
  'isTourGuideError',
  'resolveOptions',
  'setLogLevel',
  'validateOptions',
  'validateSteps',
];

/** Subpath → names an end user imports from it. */
const ENTRIES = {
  '.': ROOT_API,
  './browser': [...ROOT_API, 'createTour', 'connectNativeBridge'],
  './electron': [...ROOT_API, 'createTour', 'connectNativeBridge'],
  './react': ['createReactTourGuide'],
  './vue': ['createVueTourGuide'],
  './svelte': ['tourGuide', 'createSvelteTourGuide'],
  './angular': ['registerTourGuide', 'TourGuideController'],
  './resume': ['enableResume'],
  './android': [
    'connectNativeBridge',
    'detectNativeChannel',
    'parseCommand',
    'runCommand',
    'serializeEvent',
  ],
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const distFiles = walk(join(ROOT, 'dist'));

/** Drops block and whole-line comments, so JSDoc usage examples are not read as imports. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('package manifest', () => {
  it('has zero runtime dependencies', () => {
    for (const field of [
      'dependencies',
      'peerDependencies',
      'optionalDependencies',
      'bundleDependencies',
      'bundledDependencies',
    ]) {
      assert.deepEqual(Object.keys(manifest[field] ?? {}), [], `${field} is empty`);
    }
  });

  it('is an ES module package with types', () => {
    assert.equal(manifest.type, 'module');
    assert.ok(existsSync(join(ROOT, manifest.types)), 'root types exist');
    assert.ok(existsSync(join(ROOT, manifest.main)), 'main exists');
  });

  it('every file named in exports, unpkg, jsdelivr and customElements exists', () => {
    const targets = [manifest.unpkg, manifest.jsdelivr, manifest.customElements];
    for (const value of Object.values(manifest.exports)) {
      if (typeof value === 'string') targets.push(value);
      else targets.push(...Object.values(value));
    }
    for (const target of targets) {
      assert.ok(existsSync(join(ROOT, target)), `${target} is in the tarball`);
    }
  });

  it('ships the README, LICENSE and CHANGELOG', () => {
    for (const file of ['README.md', 'LICENSE', 'CHANGELOG.md']) {
      assert.ok(existsSync(join(ROOT, file)), file);
    }
  });

  it('marks the self-registering entries as side effects (bundlers keep them)', () => {
    for (const entry of ['./browser', './electron']) {
      const file = manifest.exports[entry].import;
      assert.ok(manifest.sideEffects.includes(file), `${file} is in sideEffects`);
    }
  });
});

describe('published files', () => {
  it('contains no tests, specs or TypeScript sources', () => {
    const isTestFile = (file) => /\.(?:test|spec)\./.test(file);
    const isTypeScriptSource = (file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts');
    const offenders = distFiles.filter(
      (file) => isTestFile(file) || isTypeScriptSource(file),
    );
    assert.deepEqual(
      offenders.map((file) => relative(ROOT, file)),
      [],
    );
  });

  it('resolves every import to a real relative .js file (no leaked aliases)', () => {
    const specifier =
      /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    const problems = [];
    for (const file of distFiles.filter((f) => /\.(js|d\.ts)$/.test(f))) {
      if (file.includes(`${join('dist', 'browser')}`)) continue; // bundled, no imports
      for (const match of stripComments(readFileSync(file, 'utf8')).matchAll(specifier)) {
        const spec = match[1] ?? match[2];
        const where = relative(ROOT, file);
        if (!spec.startsWith('.')) {
          problems.push(`${where}: bare import "${spec}"`);
          continue;
        }
        if (!spec.endsWith('.js')) {
          problems.push(`${where}: extensionless import "${spec}"`);
          continue;
        }
        const resolved = join(dirname(file), spec);
        const target = file.endsWith('.d.ts')
          ? resolved.replace(/\.js$/, '.d.ts')
          : resolved;
        if (!existsSync(target)) problems.push(`${where}: "${spec}" does not exist`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it('the IIFE and ES bundles are standalone, valid scripts', () => {
    const iife = readFileSync(join(ROOT, 'dist/browser/tour-guide.iife.js'), 'utf8');
    assert.doesNotThrow(() => new Script(iife, { filename: 'tour-guide.iife.js' }));
    assert.match(iife, /TourGuide/);
    const es = readFileSync(join(ROOT, 'dist/browser/tour-guide.es.js'), 'utf8');
    assert.doesNotMatch(
      stripComments(es),
      /(?:^|[;}\n])\s*import\s*[\w*{"'$]/,
      'the ES bundle has no import statements',
    );
  });

  it('the custom elements manifest declares <tour-guide>', () => {
    const cem = require(`${NAME}/custom-elements.json`);
    const tags = cem.modules
      .flatMap((module) => module.declarations ?? [])
      .map((declaration) => declaration.tagName)
      .filter(Boolean);
    assert.ok(tags.includes('tour-guide'), `tags: ${tags.join(', ')}`);
  });
});

describe('exports map', () => {
  for (const [subpath, names] of Object.entries(ENTRIES)) {
    const specifier = subpath === '.' ? NAME : `${NAME}/${subpath.slice(2)}`;

    it(`import "${specifier}" exposes ${names.length} name(s)`, async () => {
      const module = await import(specifier);
      for (const name of names) assert.ok(name in module, `${specifier} exports ${name}`);
      assert.ok(existsSync(join(ROOT, manifest.exports[subpath].types)), 'types exist');
    });
  }

  it('the root entry does not leak internals', async () => {
    const module = await import(NAME);
    assert.deepEqual(Object.keys(module).sort(), [...ROOT_API].sort());
  });

  it('blocks deep imports that are not exported', async () => {
    await assert.rejects(import(`${NAME}/dist/index.js`), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
    await assert.rejects(import(`${NAME}/libs/tour-manager/tour-manager`), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
  });

  it('resolves "./package.json" and "./iife"', () => {
    assert.equal(require(`${NAME}/package.json`).name, NAME);
    assert.ok(existsSync(require.resolve(`${NAME}/iife`)));
  });

  it('every adapter shares one TourGuideElement class (no duplicated module graph)', async () => {
    const root = await import(NAME);
    const browser = await import(`${NAME}/browser`);
    const electron = await import(`${NAME}/electron`);
    assert.equal(browser.TourGuideElement, root.TourGuideElement);
    assert.equal(electron.TourGuideElement, root.TourGuideElement);
    assert.equal(electron.createTour, browser.createTour);
  });
});
