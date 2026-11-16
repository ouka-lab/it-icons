// Checks, in a temporary directory, that build.js validates icons/ and icons.config.js and writes dist/
const { test, expect, afterAll } = require('bun:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const buildScript = path.join(__dirname, '..', 'build.js');
const svg = body => `<svg viewBox="0 0 256 256">${body}</svg>`;
const dirs = [];

afterAll(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

// Runs build.js in a temporary directory with the given files in icons/ and the given icons.config.js
function build(files, config = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'it-icons-build-'));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, 'icons'));
  for (const [name, content] of Object.entries(files))
    fs.writeFileSync(path.join(dir, 'icons', name), content);
  fs.writeFileSync(
    path.join(dir, 'icons.config.js'),
    `module.exports = ${JSON.stringify(config)};`,
  );
  const result = Bun.spawnSync([process.execPath, buildScript], { cwd: dir });
  const out = path.join(dir, 'dist', 'icons.json');
  const builder = path.join(dir, 'dist', 'builder.js');
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    json: fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null,
    builderHtml: fs.existsSync(builder) ? require(builder) : null,
  };
}

const validIcons = {
  'Foo-Dark.svg': svg('dark'),
  'Foo-Light.svg': svg('light'),
  'Bar.svg': svg('bar'),
};

test('writes a JSON of the SVGs keyed by lowercased file name', () => {
  const result = build(validIcons, { foo: { aliases: ['f'] } });
  expect(result.exitCode).toBe(0);
  expect(result.json).toEqual({
    bar: svg('bar'),
    'foo-dark': svg('dark'),
    'foo-light': svg('light'),
  });
});

test('writes the Image Builder HTML to dist/builder.js with the catalog built from icons/ and icons.config.js', () => {
  const result = build(validIcons, { foo: { aliases: ['f'] } });
  expect(result.exitCode).toBe(0);
  expect(typeof result.builderHtml).toBe('string');
  expect(result.builderHtml.toLowerCase().startsWith('<!doctype html>')).toBe(
    true,
  );
  expect(result.builderHtml).toContain(
    '{"id":"bar","name":"bar","label":"Bar"}',
  );
  expect(result.builderHtml).toContain(
    '{"id":"foo","name":"foo","label":"Foo","aliases":["f"],"themed":true}',
  );
});

test.each([
  ['an SVG whose viewBox is not 256x256', { 'Bar.svg': '<svg>bar</svg>' }, {}],
  ['a file that is not an SVG', { 'Bar.svg': 'bar' }, {}],
  ['a file name containing "-"', { 'Foo-Bar.svg': svg('x') }, {}],
  ['a Dark icon without Light', { 'Foo-Dark.svg': svg('dark') }, {}],
  [
    'an icon both with and without themes',
    { ...validIcons, 'Foo.svg': svg('foo') },
    {},
  ],
  ['settings for an unknown icon', validIcons, { baz: { aliases: ['b'] } }],
  [
    'a short name equal to an icon name',
    validIcons,
    { foo: { aliases: ['bar'] } },
  ],
  [
    'a duplicated short name',
    validIcons,
    { foo: { aliases: ['x'] }, bar: { aliases: ['x'] } },
  ],
  [
    'a readmeId that is not a short name',
    validIcons,
    { foo: { readmeId: 'f' } },
  ],
  ['an unknown setting', validIcons, { foo: { alias: ['f'] } }],
])(
  'exits with an error and writes neither JSON nor HTML when there is %s',
  (_, files, config) => {
    const result = build(files, config);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('✖');
    expect(result.json).toBeNull();
    expect(result.builderHtml).toBeNull();
  },
);
