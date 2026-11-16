// Checks that each schema in schema.js accepts valid input and rejects invalid input
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
  test.each(['react', 'c', 'd3', 'java-dark', 'java-light'])('accepts %s', id =>
    expect(ok(IconIdSchema, id)).toBe(true),
  );
  test.each(['React', 'java-dim', 'foo-bar-dark', 'foo.png', 'foo_bar', ''])(
    'rejects %s',
    id => expect(ok(IconIdSchema, id)).toBe(false),
  );
});

describe('SvgSchema', () => {
  test('accepts a 256x256 SVG (surrounding whitespace is allowed)', () => {
    expect(ok(SvgSchema, `\n${svg('x')}\n`)).toBe(true);
  });
  test.each([
    ['has no viewBox', '<svg>x</svg>'],
    ['has a different viewBox', '<svg viewBox="0 0 24 24">x</svg>'],
    ['does not start with <svg', `<?xml version="1.0"?>${svg('x')}`],
    ['does not end with </svg>', '<svg viewBox="0 0 256 256">x'],
  ])('rejects an SVG that %s', (_, input) => {
    expect(ok(SvgSchema, input)).toBe(false);
  });
  test('does not modify the input (so that dist/icons.json stays the same)', () => {
    const input = `\n${svg('x')}\n`;
    expect(v.parse(SvgSchema, input)).toBe(input);
  });
});

describe('IconsSchema', () => {
  test('accepts themed icons with both Dark and Light, and icons without themes', () => {
    expect(
      ok(IconsSchema, {
        'foo-dark': svg('d'),
        'foo-light': svg('l'),
        bar: svg('b'),
      }),
    ).toBe(true);
  });
  test('rejects an icon with only one theme and names the missing file', () => {
    expect(messages(IconsSchema, { 'foo-light': svg('l') })).toEqual([
      'foo-dark is missing for foo-light',
    ]);
  });
  test('rejects an icon that exists both with and without themes', () => {
    expect(
      messages(IconsSchema, {
        'foo-dark': svg('d'),
        'foo-light': svg('l'),
        foo: svg('f'),
      }),
    ).toEqual(['foo exists both with and without themes']);
  });
});

describe('createIconsConfigSchema', () => {
  const schema = createIconsConfigSchema(['foo', 'bar']);

  test('accepts a valid config', () => {
    expect(
      ok(schema, {
        foo: { aliases: ['f', 'fo'], readmeId: 'f' },
        bar: { readmeId: 'bar' },
      }),
    ).toBe(true);
  });
  test.each([
    ['an unknown icon', { baz: {} }, 'There is no icon named baz'],
    [
      'a short name equal to an icon name',
      { foo: { aliases: ['bar'] } },
      'Short name bar of foo cannot be used because an icon has the same name',
    ],
    [
      'a duplicated short name',
      { foo: { aliases: ['x'] }, bar: { aliases: ['x'] } },
      'Short name x is used by both foo and bar',
    ],
    [
      'a readmeId that is neither the canonical name nor an alias',
      { foo: { aliases: ['f'], readmeId: 'x' } },
      'readmeId x of foo must be the canonical name or one of the aliases',
    ],
  ])('rejects %s', (_, config, message) => {
    expect(messages(schema, config)).toEqual([message]);
  });
  test.each([
    ['an unknown setting', { foo: { alias: ['f'] } }],
    ['empty aliases', { foo: { aliases: [] } }],
    ['an uppercase short name', { foo: { aliases: ['F'] } }],
  ])('rejects %s', (_, config) => {
    expect(ok(schema, config)).toBe(false);
  });
});

test('toIconNames merges theme variants into one canonical name', () => {
  expect(toIconNames(['foo-dark', 'foo-light', 'bar'])).toEqual(['foo', 'bar']);
});
