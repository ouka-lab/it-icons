// icons/ と readme のアイコン一覧の整合性を検証する
const { describe, test, expect } = require('bun:test');
const fs = require('node:fs');
const path = require('node:path');
const { iconNameList, parseShortNames } = require('../lib');

const root = path.join(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'icons'));
const names = files.map(f => f.replace(/\.svg$/, '').toLowerCase());

describe('icons/', () => {
  test('すべて .svg ファイル', () => {
    expect(files.filter(f => !f.endsWith('.svg'))).toEqual([]);
  });

  test('ファイル名は "<英数字>" か "<英数字>-Dark|Light" の形式', () => {
    // index.js は "-" で区切ってテーマを判定するため、それ以外の "-" は使えない
    expect(names.filter(n => !/^[a-z0-9]+(-(dark|light))?$/.test(n))).toEqual(
      []
    );
  });

  test('大文字小文字を無視してもファイル名が重複しない', () => {
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  test('テーマ付きのアイコンは Dark と Light が揃っていて、テーマなし版がない', () => {
    const problems = [];
    for (const n of names) {
      const [base, theme] = n.split('-');
      if (!theme) continue;
      const other = theme === 'dark' ? 'light' : 'dark';
      if (!names.includes(`${base}-${other}`))
        problems.push(`${base}-${other} がない`);
      if (names.includes(base)) problems.push(`${base} が重複している`);
    }
    expect(problems).toEqual([]);
  });

  test('中身は 256x256 の SVG', () => {
    const invalid = files.filter(f => {
      const svg = fs.readFileSync(path.join(root, 'icons', f), 'utf8');
      return !(
        svg.trimStart().startsWith('<svg') &&
        svg.includes('viewBox="0 0 256 256"') &&
        svg.trimEnd().endsWith('</svg>')
      );
    });
    expect(invalid).toEqual([]);
  });
});

describe('readme のアイコン一覧', () => {
  const readme = fs.readFileSync(path.join(root, 'readme.md'), 'utf8');
  const rows = [
    ...readme.matchAll(/^\|\s*`([^`]+)`\s*\|\s*<img src="\.\/([^"]+)"/gm),
  ].map(m => ({ id: m[1], src: m[2] }));

  test('一覧が読み取れる', () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  test('載っている名前はすべて API で使える', () => {
    expect(
      rows.filter(r => parseShortNames([r.id])[0] === undefined).map(r => r.id)
    ).toEqual([]);
  });

  test('画像ファイルがすべて存在する', () => {
    expect(
      rows.filter(r => !fs.existsSync(path.join(root, r.src))).map(r => r.src)
    ).toEqual([]);
  });

  test('すべてのアイコンが載っている', () => {
    // readme には別名 (js など) で載っているものがあるので正式名に変換して比べる
    const ids = new Set(
      rows.map(r => parseShortNames([r.id])[0]?.replace(/-(dark|light)$/, ''))
    );
    expect(iconNameList.filter(n => !ids.has(n))).toEqual([]);
  });
});
