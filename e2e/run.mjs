#!/usr/bin/env node
/**
 * End-user test suite for @xkid1/tour-guide.
 *
 * Tests the package exactly as people receive it from the registry: it packs the tarball
 * (`npm pack`, which runs `prepack` → `yarn build`), installs it into a fresh consumer project
 * next to the real frameworks (React, Vue, Svelte, Angular, Vite, TypeScript…), then imports it
 * through the public `exports` map only. Nothing here imports from `src/`.
 *
 *   node e2e/run.mjs                                  # pack + every default suite
 *   node e2e/run.mjs --tarball ./xkid1-tour-guide-0.1.0.tgz
 *   node e2e/run.mjs --suites react,vue               # a subset
 *   node e2e/run.mjs --browsers chromium,firefox,webkit   # + real browsers (Playwright)
 *   node e2e/run.mjs --electron                       # + a real Electron app (Playwright)
 *   node e2e/run.mjs --dep react@18 --dep react-dom@18    # override a consumer dependency
 *   node e2e/run.mjs --pm pnpm --keep                 # pnpm install, keep the temp project
 *
 * Plain Node (≥ 18), no dependencies, so CI can run it with a sparse checkout of e2e/.
 * See e2e/README.md.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const IS_WINDOWS = process.platform === 'win32';

// ------------------------------------------------------------------ suites

/** [major, minor] of the running Node.js. */
const NODE = process.versions.node.split('.').map(Number);
const atLeast = (major, minor = 0) =>
  NODE[0] > major || (NODE[0] === major && NODE[1] >= minor);

/** Angular 22: ^22.22.3 || ^24.15.0 || >=26. */
const angularNode = () =>
  (NODE[0] === 22 && atLeast(22, 22)) ||
  (NODE[0] === 24 && atLeast(24, 15)) ||
  atLeast(26);

/**
 * `needs` returns a reason to skip, or null. Suites with `optIn` only run when asked for
 * (they download browsers / Electron).
 */
const SUITES = [
  { name: 'exports', file: 'tests/exports.test.mjs', needs: () => null },
  { name: 'ssr', file: 'tests/ssr.test.mjs', needs: () => null },
  { name: 'types', run: runTypes, needs: () => null },
  { name: 'browser', file: 'tests/browser.test.mjs', needs: () => need(20) },
  { name: 'electron', file: 'tests/electron.test.mjs', needs: () => need(20) },
  { name: 'iife', file: 'tests/iife.test.mjs', needs: () => need(20) },
  { name: 'android', file: 'tests/android.test.mjs', needs: () => need(20) },
  { name: 'react', file: 'tests/react.test.mjs', needs: () => need(20) },
  { name: 'vue', file: 'tests/vue.test.mjs', needs: () => need(20) },
  {
    name: 'svelte',
    file: 'tests/svelte.test.mjs',
    // Svelte's client runtime (mount, $state…) is behind the "browser" export condition.
    nodeArgs: ['--conditions=browser'],
    needs: () => need(20),
  },
  {
    name: 'angular',
    file: 'tests/angular.test.mjs',
    needs: () => (angularNode() ? null : 'Angular 22 needs Node ^22.22, ^24.15 or >=26'),
  },
  {
    name: 'bundlers',
    file: 'tests/bundlers.test.mjs',
    needs: () => (atLeast(20, 19) ? null : 'Vite 8 needs Node >= 20.19'),
  },
  {
    name: 'real-browsers',
    file: 'browser/real-browsers.test.mjs',
    optIn: true,
    needs: () => need(20),
  },
  {
    name: 'electron-app',
    file: 'electron-app/electron-app.test.mjs',
    optIn: true,
    needs: () => need(20),
  },
];

function need(major) {
  return atLeast(major) ? null : `needs Node >= ${major} (happy-dom)`;
}

// --------------------------------------------------------------------- CLI

const { values: args } = parseArgs({
  options: {
    'tarball': { type: 'string' },
    'pm': { type: 'string', default: 'npm' },
    'suites': { type: 'string' },
    'browsers': { type: 'string' },
    'electron': { type: 'boolean', default: false },
    'dep': { type: 'string', multiple: true, default: [] },
    'keep': { type: 'boolean', default: false },
    'skip-install-browsers': { type: 'boolean', default: false },
    'help': { type: 'boolean', short: 'h', default: false },
  },
});

if (args.help) {
  const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(
    source
      .split('*/')[0]
      .replace(/^#!.*\n\/\*\*\n/, '')
      .replace(/^ \* ?/gm, ''),
  );
  process.exit(0);
}

if (!['npm', 'pnpm'].includes(args.pm))
  fail(`--pm must be npm or pnpm, got "${args.pm}".`);

const browsers = (args.browsers ?? process.env.E2E_BROWSERS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const electron = args.electron || process.env.E2E_ELECTRON === '1';

const requested = args.suites?.split(',').map((value) => value.trim());
if (requested) {
  const unknown = requested.filter(
    (name) => !SUITES.some((suite) => suite.name === name),
  );
  if (unknown.length) fail(`Unknown suite(s): ${unknown.join(', ')}.`);
}
const selected = SUITES.filter((suite) => {
  if (requested) return requested.includes(suite.name);
  if (suite.name === 'real-browsers') return browsers.length > 0;
  if (suite.name === 'electron-app') return electron;
  return !suite.optIn;
});
if (selected.some((s) => s.name === 'real-browsers') && browsers.length === 0)
  browsers.push('chromium');

// -------------------------------------------------------------------- main

const work = mkdtempSync(join(tmpdir(), 'tour-guide-e2e-'));
let exitCode = 1;
try {
  const tarball = args.tarball ? resolve(args.tarball) : pack(work);
  const project = createProject(work, tarball);
  install(project);
  const results = selected.map((suite) => runSuite(suite, project));
  exitCode = report(results);
} finally {
  if (args.keep || process.env.E2E_KEEP === '1')
    console.log(`\nKept consumer project: ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
process.exitCode = exitCode;

// ----------------------------------------------------------------- helpers

function pack(dir) {
  step('npm pack (prepack → yarn build)');
  const out = join(dir, 'pack');
  mkdirSync(out);
  const result = exec('npm', ['pack', '--pack-destination', out, '--loglevel=error'], {
    cwd: REPO,
    capture: true,
  });
  const name = result.stdout.trim().split('\n').pop();
  return join(out, name);
}

function createProject(dir, tarball) {
  step(`consumer project ← ${basename(tarball)}`);
  const project = join(dir, 'consumer');
  cpSync(join(HERE, 'consumer'), project, {
    recursive: true,
    filter: (source) => !/[\\/](node_modules|\.vite|dist-bundles)([\\/]|$)/.test(source),
  });

  const manifestPath = join(project, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.dependencies['@xkid1/tour-guide'] = `file:${tarball.replaceAll('\\', '/')}`;
  if (browsers.length || electron) manifest.devDependencies.playwright = '^1.50.0';
  if (electron) manifest.devDependencies.electron = '>=30.0.0';
  for (const spec of args.dep) {
    const at = spec.lastIndexOf('@');
    if (at <= 0) fail(`--dep expects name@range, got "${spec}".`);
    const name = spec.slice(0, at);
    const range = spec.slice(at + 1);
    const group = name in manifest.devDependencies ? 'devDependencies' : 'dependencies';
    manifest[group][name] = range;
    console.log(`  override ${name}@${range}`);
  }
  // React 18 has no @types/react 18 pairing issue at runtime, but keep the types aligned.
  const react = manifest.dependencies.react;
  if (/^\^?~?18/.test(react)) manifest.devDependencies['@types/react'] = '^18.0.0';
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return project;
}

function install(project) {
  step(`${args.pm} install`);
  if (args.pm === 'npm') {
    exec('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], {
      cwd: project,
    });
  } else {
    // An app with its own lockfile-less install; hoisting stays pnpm's default (isolated).
    exec('pnpm', ['install', '--no-frozen-lockfile', '--reporter=append-only'], {
      cwd: project,
    });
  }
  if (browsers.length && !args['skip-install-browsers']) {
    step(`playwright install ${browsers.join(' ')}`);
    const deps = process.env.CI && process.platform === 'linux' ? ['--with-deps'] : [];
    exec(playwrightBin(project), ['install', ...deps, ...browsers], { cwd: project });
  }
}

function playwrightBin(project) {
  return join(
    project,
    'node_modules',
    '.bin',
    IS_WINDOWS ? 'playwright.cmd' : 'playwright',
  );
}

function runSuite(suite, project) {
  const skip = suite.needs();
  if (skip) {
    step(`${suite.name}: skipped (${skip})`);
    return { name: suite.name, status: 'skipped', note: skip };
  }
  step(suite.name);
  const started = Date.now();
  const ok = suite.run
    ? suite.run(project)
    : exec(
        process.execPath,
        [...(suite.nodeArgs ?? []), '--test', '--test-reporter=spec', suite.file],
        {
          cwd: project,
          allowFailure: true,
          env: { E2E_BROWSERS: browsers.join(',') },
        },
      ).status === 0;
  return {
    name: suite.name,
    status: ok ? 'passed' : 'failed',
    note: `${((Date.now() - started) / 1000).toFixed(1)}s`,
  };
}

/** Type-checks consumer code against the published .d.ts with several TS versions and modes. */
function runTypes(project) {
  const compilers = [
    ['typescript-5', 'TS 5.9'],
    ['typescript', 'TS 6'],
    ['typescript-7', 'TS 7'],
  ];
  const configs = [
    'tsconfig.bundler.json',
    'tsconfig.node16.json',
    'tsconfig.nodenext.json',
  ];
  let ok = true;
  for (const [pkg, label] of compilers) {
    const tsc = join(project, 'node_modules', pkg, 'bin', 'tsc');
    const version = readJson(join(project, 'node_modules', pkg, 'package.json')).version;
    for (const config of configs) {
      const result = exec(process.execPath, [tsc, '-p', join('types', config)], {
        cwd: project,
        allowFailure: true,
        capture: true,
      });
      const passed = result.status === 0;
      ok &&= passed;
      console.log(`  ${passed ? '✔' : '✖'} ${label} (${version}) ${config}`);
      if (!passed) console.log(indent(result.stdout + result.stderr));
    }
  }
  return ok;
}

function report(results) {
  console.log('\nEnd-user suite summary');
  console.log(
    `  Node ${process.versions.node}, ${args.pm}${args.dep.length ? `, ${args.dep.join(' ')}` : ''}`,
  );
  for (const { name, status, note } of results) {
    const icon = { passed: '✔', failed: '✖', skipped: '-' }[status];
    console.log(`  ${icon} ${name.padEnd(14)} ${status.padEnd(8)} ${note}`);
  }
  const failed = results.filter((r) => r.status === 'failed');
  if (failed.length) {
    console.log(
      `\n${failed.length} suite(s) failed: ${failed.map((r) => r.name).join(', ')}`,
    );
    return 1;
  }
  if (
    process.env.E2E_FAIL_ON_SKIP === '1' &&
    results.some((r) => r.status === 'skipped')
  ) {
    console.log('\nE2E_FAIL_ON_SKIP=1 and some suites were skipped.');
    return 1;
  }
  return 0;
}

function exec(
  command,
  argv,
  { cwd, capture = false, allowFailure = false, env = {} } = {},
) {
  const result = spawnSync(command, argv, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: IS_WINDOWS && !command.endsWith('.exe'),
    env: { ...process.env, ...env },
  });
  if (result.error) fail(`${command} ${argv.join(' ')}: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    if (capture) console.error(result.stdout, result.stderr);
    fail(`${command} ${argv.join(' ')} exited with ${result.status}.`);
  }
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function indent(text) {
  return text
    .trim()
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');
}

function step(message) {
  console.log(`\n▶ ${message}`);
}

function fail(message) {
  console.error(`\ne2e: ${message}`);
  throw new Error(message);
}
