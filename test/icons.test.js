// 実際の icons/ と icons.config.js がスキーマを満たすこと、readme のアイコン一覧が正しく生成されることを検証する
const { describe, test, expect } = require('bun:test');
const fs = require('node:fs');
const path = require('node:path');
const v = require('valibot');
const {
  IconsSchema,
  createIconsConfigSchema,
  toIconNames,
} = require('../schema');
const { iconNameList, parseShortNames } = require('../lib');
const { renderIconsTable, replaceIconsTable } = require('../scripts/readme');
const config = require('../icons.config');

const root = path.join(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'icons'));
const icons = Object.fromEntries(
  files.map(f => [
    f.replace(/\.svg$/, '').toLowerCase(),
    fs.readFileSync(path.join(root, 'icons', f), 'utf8'),
  ]),
);

// 失敗したときに理由が読めるよう、issues を文字列にして比べる
const issuesOf = (schema, input) => {
  const result = v.safeParse(schema, input);
  return result.success ? '' : v.summarize(result.issues);
};

describe('icons/', () => {
  test('すべて .svg ファイル', () => {
    expect(files.filter(f => !f.endsWith('.svg'))).toEqual([]);
  });

  test('大文字小文字を無視してもファイル名が重複しない', () => {
    expect(Object.keys(icons).length).toBe(files.length);
  });

  test('IconsSchema を満たす', () => {
    expect(issuesOf(IconsSchema, icons)).toBe('');
  });
});

describe('icons.config.js', () => {
  test('スキーマを満たす', () => {
    const schema = createIconsConfigSchema(toIconNames(Object.keys(icons)));
    expect(issuesOf(schema, config)).toBe('');
  });
});

describe('readme のアイコン一覧', () => {
  const table = renderIconsTable(files, config);
  const rows = [
    ...table.matchAll(/^\|\s*`([^`]+)`\s*\|\s*<img src="\.\/([^"]+)"/gm),
  ].map(m => ({ id: m[1], src: m[2] }));

  test('すべてのアイコンが 1 行ずつ載る', () => {
    expect(rows.length).toBe(iconNameList.length);
    const names = rows.map(r =>
      parseShortNames([r.id])[0]?.replace(/-(dark|light)$/, ''),
    );
    expect([...names].sort()).toEqual([...iconNameList].sort());
  });

  test('載っている名前はすべて API で使える', () => {
    expect(
      rows.filter(r => parseShortNames([r.id])[0] === undefined).map(r => r.id),
    ).toEqual([]);
  });

  test('画像ファイルがすべて存在し、テーマ付きは Dark を使う', () => {
    expect(
      rows.filter(r => !fs.existsSync(path.join(root, r.src))).map(r => r.src),
    ).toEqual([]);
    expect(rows.filter(r => /-Light\.svg$/.test(r.src))).toEqual([]);
  });

  test('正式名の順に並ぶ', () => {
    const names = rows.map(r =>
      r.src.replace(/^icons\/|(-Dark)?\.svg$/g, '').toLowerCase(),
    );
    expect(names).toEqual([...names].sort());
  });

  test('readme.md に差し替え用の目印がある', () => {
    const readme = fs.readFileSync(path.join(root, 'readme.md'), 'utf8');
    expect(() => replaceIconsTable(readme, table)).not.toThrow();
  });

  test('目印がないとエラーになる', () => {
    expect(() => replaceIconsTable('# readme', table)).toThrow();
  });
});
