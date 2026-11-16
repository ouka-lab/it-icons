// schema.js の各スキーマが正常な入力を通し、異常な入力を落とすことを検証する
const { describe, test, expect } = require('bun:test');
const v = require('valibot');
const {
  IconIdSchema,
  SvgSchema,
  IconsSchema,
  createIconsConfigSchema,
  toIconNames,
} = require('../schema');

const ok = (schema, input) => v.safeParse(schema, input).success;
const messages = (schema, input) =>
  (v.safeParse(schema, input).issues ?? []).map(i => i.message);
const svg = body => `<svg viewBox="0 0 256 256">${body}</svg>`;

describe('IconIdSchema', () => {
  test.each(['react', 'c', 'd3', 'java-dark', 'java-light'])('%s を通す', id =>
    expect(ok(IconIdSchema, id)).toBe(true),
  );
  test.each(['React', 'java-dim', 'foo-bar-dark', 'foo.png', 'foo_bar', ''])(
    '%s を落とす',
    id => expect(ok(IconIdSchema, id)).toBe(false),
  );
});

describe('SvgSchema', () => {
  test('256x256 の SVG を通す (前後の空白は許す)', () => {
    expect(ok(SvgSchema, `\n${svg('x')}\n`)).toBe(true);
  });
  test.each([
    ['viewBox がない', '<svg>x</svg>'],
    ['viewBox が違う', '<svg viewBox="0 0 24 24">x</svg>'],
    ['<svg で始まらない', `<?xml version="1.0"?>${svg('x')}`],
    ['</svg> で終わらない', '<svg viewBox="0 0 256 256">x'],
  ])('%s ものを落とす', (_, input) => {
    expect(ok(SvgSchema, input)).toBe(false);
  });
  test('入力を書き換えない (dist/icons.json の内容が変わらないように)', () => {
    const input = `\n${svg('x')}\n`;
    expect(v.parse(SvgSchema, input)).toBe(input);
  });
});

describe('IconsSchema', () => {
  test('Dark と Light がそろったテーマ付きアイコンとテーマなしアイコンを通す', () => {
    expect(
      ok(IconsSchema, {
        'foo-dark': svg('d'),
        'foo-light': svg('l'),
        bar: svg('b'),
      }),
    ).toBe(true);
  });
  test('片方のテーマしかないと、足りないファイルを示して落とす', () => {
    expect(messages(IconsSchema, { 'foo-light': svg('l') })).toEqual([
      'foo-light に対応する foo-dark がありません',
    ]);
  });
  test('テーマ付きとテーマなしの両方があると落とす', () => {
    expect(
      messages(IconsSchema, {
        'foo-dark': svg('d'),
        'foo-light': svg('l'),
        foo: svg('f'),
      }),
    ).toEqual(['foo はテーマ付きとテーマなしの両方があります']);
  });
});

describe('createIconsConfigSchema', () => {
  const schema = createIconsConfigSchema(['foo', 'bar']);

  test('正しい設定を通す', () => {
    expect(
      ok(schema, {
        foo: { aliases: ['f', 'fo'], readmeId: 'f' },
        bar: { readmeId: 'bar' },
      }),
    ).toBe(true);
  });
  test.each([
    ['存在しないアイコン', { baz: {} }, 'baz というアイコンはありません'],
    [
      'アイコン名と同じ短縮名',
      { foo: { aliases: ['bar'] } },
      'foo の短縮名 bar は、同名のアイコンがあるので使えません',
    ],
    [
      '重複した短縮名',
      { foo: { aliases: ['x'] }, bar: { aliases: ['x'] } },
      '短縮名 x が foo と bar で重複しています',
    ],
    [
      '正式名でも短縮名でもない readmeId',
      { foo: { aliases: ['f'], readmeId: 'x' } },
      'foo の readmeId x は、正式名か aliases のいずれかにしてください',
    ],
  ])('%s を落とす', (_, config, message) => {
    expect(messages(schema, config)).toEqual([message]);
  });
  test.each([
    ['未知の設定項目', { foo: { alias: ['f'] } }],
    ['空の aliases', { foo: { aliases: [] } }],
    ['大文字の短縮名', { foo: { aliases: ['F'] } }],
  ])('%s を落とす', (_, config) => {
    expect(ok(schema, config)).toBe(false);
  });
});

test('toIconNames はテーマ違いを 1 つの正式名にまとめる', () => {
  expect(toIconNames(['foo-dark', 'foo-light', 'bar'])).toEqual(['foo', 'bar']);
});
