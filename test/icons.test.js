// Checks that the actual icons/ and icons.config.js satisfy the schemas and that the readme icon list is generated correctly
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

// Compare the issues as a string so that failures show the reason
const issuesOf = (schema, input) => {
  const result = v.safeParse(schema, input);
  return result.success ? '' : v.summarize(result.issues);
};

describe('icons/', () => {
  test('contains only .svg files', () => {
    expect(files.filter(f => !f.endsWith('.svg'))).toEqual([]);
  });

  test('has no duplicate file names, ignoring case', () => {
    expect(Object.keys(icons).length).toBe(files.length);
  });

  test('satisfies IconsSchema', () => {
    expect(issuesOf(IconsSchema, icons)).toBe('');
  });
});

describe('icons.config.js', () => {
  test('satisfies the schema', () => {
    const schema = createIconsConfigSchema(toIconNames(Object.keys(icons)));
    expect(issuesOf(schema, config)).toBe('');
  });
});

describe('readme icon list', () => {
  const table = renderIconsTable(files, config);
  const rows = [
    ...table.matchAll(/^\|\s*`([^`]+)`\s*\|\s*<img src="\.\/([^"]+)"/gm),
  ].map(m => ({ id: m[1], src: m[2] }));

  test('lists every icon once', () => {
    expect(rows.length).toBe(iconNameList.length);
    const names = rows.map(r =>
      parseShortNames([r.id])[0]?.replace(/-(dark|light)$/, ''),
    );
    expect([...names].sort()).toEqual([...iconNameList].sort());
  });

  test('every listed name works in the API', () => {
    expect(
      rows.filter(r => parseShortNames([r.id])[0] === undefined).map(r => r.id),
    ).toEqual([]);
  });

  test('every image file exists, and themed icons use Dark', () => {
    expect(
      rows.filter(r => !fs.existsSync(path.join(root, r.src))).map(r => r.src),
    ).toEqual([]);
    expect(rows.filter(r => /-Light\.svg$/.test(r.src))).toEqual([]);
  });

  test('is sorted by canonical name', () => {
    const names = rows.map(r =>
      r.src.replace(/^icons\/|(-Dark)?\.svg$/g, '').toLowerCase(),
    );
    expect(names).toEqual([...names].sort());
  });

  test('readme.md has the markers to replace', () => {
    const readme = fs.readFileSync(path.join(root, 'readme.md'), 'utf8');
    expect(() => replaceIconsTable(readme, table)).not.toThrow();
  });

  test('throws without the markers', () => {
    expect(() => replaceIconsTable('# readme', table)).toThrow();
  });
});
