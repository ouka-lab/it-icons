// Spec of the DOM-independent logic of the Image Builder (builder/core.js)
const { describe, test, expect } = require('bun:test');
const {
  DEFAULT_ICONS,
  DEFAULT_PERLINE,
  parseParams,
  toImageQuery,
  toBuilderQuery,
  renderOutput,
  searchIcons,
} = require('../builder/core');

// A small catalog for the tests, in the same shape that buildCatalog in builder/catalog.js returns
const catalog = [
  { id: 'css', name: 'css', label: 'CSS' },
  { id: 'html', name: 'html', label: 'HTML' },
  { id: 'java', name: 'java', label: 'Java', themed: true },
  { id: 'js', name: 'javascript', label: 'JavaScript', aliases: ['js'] },
  {
    id: 'kubernetes',
    name: 'kubernetes',
    label: 'Kubernetes',
    aliases: ['k8s'],
  },
  { id: 'tsdown', name: 'tsdown', label: 'TSDown', themed: true },
  { id: 'ts', name: 'typescript', label: 'TypeScript', aliases: ['ts'] },
  { id: 'wasm', name: 'webassembly', label: 'WebAssembly', aliases: ['wasm'] },
];

const parse = query => parseParams(new URLSearchParams(query), catalog);
const state = overrides => ({
  names: ['javascript', 'html'],
  all: false,
  theme: 'dark',
  perline: DEFAULT_PERLINE,
  format: 'md',
  center: false,
  ...overrides,
});
const ORIGIN = 'https://it-icons.example';

describe('defaults', () => {
  test('15 icons per line, and the default icons match the README example', () => {
    expect(DEFAULT_PERLINE).toBe(15);
    expect(DEFAULT_ICONS).toEqual(['javascript', 'html', 'css', 'webassembly']);
  });
});

describe('parseParams: builds the initial input state from the URL parameters', () => {
  test('uses the defaults without parameters', () => {
    expect(parse('')).toEqual({
      state: {
        names: DEFAULT_ICONS,
        all: false,
        theme: 'dark',
        perline: 15,
        format: 'md',
        center: false,
      },
      ignored: [],
    });
  });

  test('selects no icons when i is empty', () => {
    expect(parse('i=').state.names).toEqual([]);
  });

  test('accepts canonical names, short names and readme IDs, and normalizes them to canonical names', () => {
    expect(parse('i=javascript,k8s,ts,html').state.names).toEqual([
      'javascript',
      'kubernetes',
      'typescript',
      'html',
    ]);
  });

  test('ignores case and surrounding spaces, and keeps only the first of duplicates', () => {
    expect(parse('i= JS ,html,javascript,HTML').state.names).toEqual([
      'javascript',
      'html',
    ]);
  });

  test('accepts the parameter aliases (icons for i, t for theme)', () => {
    expect(parse('icons=css&t=light').state).toMatchObject({
      names: ['css'],
      theme: 'light',
    });
  });

  test('i=all means every icon', () => {
    expect(parse('i=all').state).toMatchObject({ all: true, names: [] });
  });

  test('reads theme, perline, format and center', () => {
    expect(
      parse('i=css&theme=light&perline=3&format=html&center=1').state,
    ).toEqual({
      names: ['css'],
      all: false,
      theme: 'light',
      perline: 3,
      format: 'html',
      center: true,
    });
  });

  test.each(['1', '50'])('accepts perline=%s because it is in range', value => {
    expect(parse(`i=css&perline=${value}`).state.perline).toBe(Number(value));
  });

  test('keeps the defaults for invalid values and returns the ignored values in parameter order', () => {
    expect(
      parse('i=css,nope,java&theme=blue&perline=0&format=pdf&center=yes'),
    ).toEqual({
      state: {
        names: ['css', 'java'],
        all: false,
        theme: 'dark',
        perline: 15,
        format: 'md',
        center: false,
      },
      ignored: [
        { kind: 'icon', value: 'nope' },
        { kind: 'theme', value: 'blue' },
        { kind: 'perline', value: '0' },
        { kind: 'format', value: 'pdf' },
        { kind: 'center', value: 'yes' },
      ],
    });
  });

  test.each(['51', '3.5', 'abc', '-1'])('ignores perline=%s', value => {
    expect(parse(`i=css&perline=${value}`)).toMatchObject({
      state: { perline: 15 },
      ignored: [{ kind: 'perline', value }],
    });
  });

  test('theme is case-sensitive (same as /icons in the Worker)', () => {
    expect(parse('i=css&theme=Light').ignored).toEqual([
      { kind: 'theme', value: 'Light' },
    ]);
  });
});

describe('toImageQuery: query for the image (/icons)', () => {
  test('lists icons by readme ID in the selected order', () => {
    expect(
      toImageQuery(
        state({ names: ['typescript', 'html', 'kubernetes'] }),
        catalog,
      ),
    ).toBe('i=ts,html,kubernetes');
  });

  test('omits parameters with default values (dark, 15)', () => {
    expect(toImageQuery(state(), catalog)).toBe('i=js,html');
  });

  test('appends theme and perline after i only when they differ from the defaults', () => {
    expect(toImageQuery(state({ theme: 'light', perline: 3 }), catalog)).toBe(
      'i=js,html&theme=light&perline=3',
    );
  });

  test('uses i=all for every icon', () => {
    expect(toImageQuery(state({ all: true }), catalog)).toBe('i=all');
  });

  test('leaves out the output format and centering, which do not affect the image', () => {
    expect(toImageQuery(state({ format: 'html', center: true }), catalog)).toBe(
      'i=js,html',
    );
  });
});

describe('toBuilderQuery: query for the builder (/builder)', () => {
  test('is the same as the image query for Markdown', () => {
    expect(toBuilderQuery(state({ theme: 'light' }), catalog)).toBe(
      'i=js,html&theme=light',
    );
  });

  test('adds format=html for HTML', () => {
    expect(toBuilderQuery(state({ format: 'html' }), catalog)).toBe(
      'i=js,html&format=html',
    );
  });

  test('also adds center=1 for centered HTML', () => {
    expect(
      toBuilderQuery(
        state({ format: 'html', center: true, perline: 3 }),
        catalog,
      ),
    ).toBe('i=js,html&perline=3&format=html&center=1');
  });

  test('does not add center for Markdown, which cannot be centered', () => {
    expect(toBuilderQuery(state({ center: true }), catalog)).toBe('i=js,html');
  });

  test('gives the same state when parsed back with parseParams', () => {
    const s = state({
      names: ['kubernetes', 'css'],
      theme: 'light',
      perline: 7,
      format: 'html',
      center: true,
    });
    expect(parse(toBuilderQuery(s, catalog))).toEqual({
      state: s,
      ignored: [],
    });
  });
});

describe('renderOutput: code to paste into a README', () => {
  test('Markdown: wraps the image in a link to the builder', () => {
    expect(renderOutput(state({ theme: 'light' }), catalog, ORIGIN)).toBe(
      `[![My Skills](${ORIGIN}/icons?i=js,html&theme=light)](${ORIGIN}/builder?i=js,html&theme=light)`,
    );
  });

  test('HTML: <img> inside <a>', () => {
    expect(renderOutput(state({ format: 'html' }), catalog, ORIGIN)).toBe(
      [
        `<a href="${ORIGIN}/builder?i=js,html&format=html">`,
        `  <img src="${ORIGIN}/icons?i=js,html" alt="My Skills" />`,
        '</a>',
      ].join('\n'),
    );
  });

  test('centered HTML: wraps it in <p align="center">', () => {
    expect(
      renderOutput(state({ format: 'html', center: true }), catalog, ORIGIN),
    ).toBe(
      [
        '<p align="center">',
        `  <a href="${ORIGIN}/builder?i=js,html&format=html&center=1">`,
        `    <img src="${ORIGIN}/icons?i=js,html" alt="My Skills" />`,
        '  </a>',
        '</p>',
      ].join('\n'),
    );
  });

  test('returns an empty string when no icons are selected', () => {
    expect(renderOutput(state({ names: [] }), catalog, ORIGIN)).toBe('');
  });

  test('uses i=all for every icon', () => {
    expect(renderOutput(state({ names: [], all: true }), catalog, ORIGIN)).toBe(
      `[![My Skills](${ORIGIN}/icons?i=all)](${ORIGIN}/builder?i=all)`,
    );
  });
});

describe('searchIcons: icon search', () => {
  const names = query => searchIcons(catalog, query).map(e => e.name);

  test('returns everything in catalog order for an empty query', () => {
    expect(names('')).toEqual(catalog.map(e => e.name));
    expect(names('   ')).toEqual(catalog.map(e => e.name));
  });

  test('finds icons by canonical name, label, readme ID or short name (case-insensitive)', () => {
    expect(names('kubernetes')).toEqual(['kubernetes']);
    expect(names('WebAssembly')).toEqual(['webassembly']);
    expect(names('K8S')).toEqual(['kubernetes']);
  });

  test('sorts exact matches, then prefix matches, then substring matches, with ties by canonical name', () => {
    // ts: typescript matches its readme ID and short name exactly, tsdown is a prefix match
    expect(names('ts')).toEqual(['typescript', 'tsdown']);
    // java: java is an exact match, javascript is a prefix match
    expect(names('java')).toEqual(['java', 'javascript']);
    // script: both are substring matches, so they are sorted by canonical name
    expect(names('script')).toEqual(['javascript', 'typescript']);
  });

  test('returns nothing when nothing matches', () => {
    expect(names('nope')).toEqual([]);
  });
});
