// Spec of the icon catalog embedded in the Image Builder (builder/catalog.js)
const { describe, test, expect } = require('bun:test');
const fs = require('node:fs');
const path = require('node:path');
const { buildCatalog } = require('../builder/catalog');
const { parseShortNames } = require('../lib');

describe('buildCatalog', () => {
  test('builds a catalog sorted by canonical name from the file names in icons/ and icons.config.js', () => {
    const files = [
      'JavaScript.svg',
      'Foo-Light.svg',
      'Bar.svg',
      'Foo-Dark.svg',
    ];
    const config = { javascript: { aliases: ['js'], readmeId: 'js' } };
    expect(buildCatalog(files, config)).toEqual([
      { id: 'bar', name: 'bar', label: 'Bar' },
      { id: 'foo', name: 'foo', label: 'Foo', themed: true },
      { id: 'js', name: 'javascript', label: 'JavaScript', aliases: ['js'] },
    ]);
  });

  test('id is the readmeId or the canonical name, and label keeps the file name casing', () => {
    const [entry] = buildCatalog(
      ['GitHubActions-Dark.svg', 'GitHubActions-Light.svg'],
      {
        githubactions: { aliases: ['ghactions'] },
      },
    );
    expect(entry).toEqual({
      id: 'githubactions',
      name: 'githubactions',
      label: 'GitHubActions',
      aliases: ['ghactions'],
      themed: true,
    });
  });
});

describe('catalog built from the actual icons/ and icons.config.js', () => {
  const root = path.join(__dirname, '..');
  const catalog = buildCatalog(
    fs.readdirSync(path.join(root, 'icons')),
    require('../icons.config'),
  );

  test('every id works in the /icons API (so the URLs from the builder never break)', () => {
    expect(
      catalog
        .filter(e => parseShortNames([e.id])[0] === undefined)
        .map(e => e.id),
    ).toEqual([]);
  });

  test('has no duplicate ids or canonical names', () => {
    const ids = catalog.map(e => e.id);
    const names = catalog.map(e => e.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });
});
