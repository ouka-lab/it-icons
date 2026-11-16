// build.js が icons/ と icons.config.js を検証して dist/icons.json を生成することを、一時ディレクトリで検証する
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

// icons/ に files を置き、icons.config.js を書いた一時ディレクトリで build.js を実行する
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
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    json: fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null,
  };
}

const validIcons = {
  'Foo-Dark.svg': svg('dark'),
  'Foo-Light.svg': svg('light'),
  'Bar.svg': svg('bar'),
};

test('ファイル名を小文字にしたキーで SVG をまとめた JSON を出力する', () => {
  const result = build(validIcons, { foo: { aliases: ['f'] } });
  expect(result.exitCode).toBe(0);
  expect(result.json).toEqual({
    bar: svg('bar'),
    'foo-dark': svg('dark'),
    'foo-light': svg('light'),
  });
});

test.each([
  ['viewBox が 256x256 でない SVG', { 'Bar.svg': '<svg>bar</svg>' }, {}],
  ['SVG でないファイル', { 'Bar.svg': 'bar' }, {}],
  ['"-" を含むファイル名', { 'Foo-Bar.svg': svg('x') }, {}],
  ['Light がない Dark', { 'Foo-Dark.svg': svg('dark') }, {}],
  [
    'テーマ付きとテーマなしの両方がある',
    { ...validIcons, 'Foo.svg': svg('foo') },
    {},
  ],
  ['存在しないアイコンの設定', validIcons, { baz: { aliases: ['b'] } }],
  ['アイコン名と同じ短縮名', validIcons, { foo: { aliases: ['bar'] } }],
  [
    '重複した短縮名',
    validIcons,
    { foo: { aliases: ['x'] }, bar: { aliases: ['x'] } },
  ],
  ['短縮名でない readmeId', validIcons, { foo: { readmeId: 'f' } }],
  ['未知の設定項目', validIcons, { foo: { alias: ['f'] } }],
])('%s があるとエラーで終わり、JSON を出力しない', (_, files, config) => {
  const result = build(files, config);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain('✖');
  expect(result.json).toBeNull();
});
