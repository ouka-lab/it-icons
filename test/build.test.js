// build.js が icons/ から dist/icons.json を生成することを、一時ディレクトリで検証する
const { test, expect, beforeAll, afterAll } = require('bun:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const buildScript = path.join(__dirname, '..', 'build.js');
let dir;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'it-icons-build-'));
  fs.mkdirSync(path.join(dir, 'icons'));
  fs.writeFileSync(path.join(dir, 'icons', 'Foo-Dark.svg'), '<svg>dark</svg>');
  fs.writeFileSync(
    path.join(dir, 'icons', 'Foo-Light.svg'),
    '<svg>light</svg>'
  );
  fs.writeFileSync(path.join(dir, 'icons', 'Bar.svg'), '<svg>bar</svg>');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('ファイル名を小文字にしたキーで SVG をまとめた JSON を出力する', () => {
  const result = Bun.spawnSync([process.execPath, buildScript], { cwd: dir });
  expect(result.exitCode).toBe(0);

  const json = JSON.parse(
    fs.readFileSync(path.join(dir, 'dist', 'icons.json'), 'utf8')
  );
  expect(json).toEqual({
    bar: '<svg>bar</svg>',
    'foo-dark': '<svg>dark</svg>',
    'foo-light': '<svg>light</svg>',
  });
});
