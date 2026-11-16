const { describe, test, expect } = require('bun:test');
const {
  icons,
  iconNameList,
  shortNames,
  themedIcons,
  generateSvg,
  parseShortNames,
  handleRequest,
} = require('../lib');

const get = path => handleRequest(new Request(`https://example.com${path}`));

// Extracts the translate coordinates of the <g> that generateSvg wraps around each icon
const positions = svg =>
  [...svg.matchAll(/<g transform="translate\((\d+), (\d+)\)">/g)].map(m => [
    Number(m[1]),
    Number(m[2]),
  ]);

const svgAttrs = svg => {
  const m = svg.match(
    /<svg width="([^"]+)" height="([^"]+)" viewBox="0 0 ([^ ]+) ([^"]+)"/,
  );
  if (!m) throw new Error('svg element not found');
  return {
    width: Number(m[1]),
    height: Number(m[2]),
    viewW: Number(m[3]),
    viewH: Number(m[4]),
  };
};

describe('iconNameList / themedIcons', () => {
  test('theme variants are merged into one name without "-dark" / "-light"', () => {
    expect(iconNameList).toContain('java');
    expect(iconNameList).not.toContain('java-dark');
    expect(iconNameList).not.toContain('java-light');
    expect(new Set(iconNameList).size).toBe(iconNameList.length);
  });

  test('themedIcons only contains themed icons', () => {
    expect(themedIcons).toContain('java');
    for (const name of themedIcons) {
      expect(icons[`${name}-dark`]).toBeString();
      expect(icons[`${name}-light`]).toBeString();
    }
    // an icon without themes
    expect(icons.adonis).toBeString();
    expect(themedIcons).not.toContain('adonis');
  });
});

describe('parseShortNames', () => {
  test('an icon without themes keeps its name', () => {
    expect(parseShortNames(['adonis'])).toEqual(['adonis']);
  });

  test('a themed icon gets -dark by default', () => {
    expect(parseShortNames(['java'])).toEqual(['java-dark']);
    expect(parseShortNames(['java'], undefined)).toEqual(['java-dark']);
  });

  test('a given theme is appended', () => {
    expect(parseShortNames(['java', 'adonis'], 'light')).toEqual([
      'java-light',
      'adonis',
    ]);
  });

  test('short names are converted to canonical names, with the theme applied', () => {
    expect(parseShortNames(['js', 'k8s'])).toEqual(
      parseShortNames(['javascript', 'kubernetes']),
    );
    expect(parseShortNames(['next'], 'light')).toEqual(
      parseShortNames(['nextjs'], 'light'),
    );
  });

  test('order and duplicates are kept as given', () => {
    expect(parseShortNames(['adonis', 'java', 'adonis'])).toEqual([
      'adonis',
      'java-dark',
      'adonis',
    ]);
  });

  test('[current behavior] an unknown name becomes undefined', () => {
    expect(parseShortNames(['java', 'no-such-icon'])).toEqual([
      'java-dark',
      undefined,
    ]);
  });
});

describe('generateSvg', () => {
  test('one icon is 48px square with a 256 viewBox', () => {
    const svg = generateSvg(['adonis'], 15);
    expect(svgAttrs(svg)).toEqual({
      width: 48,
      height: 48,
      viewW: 256,
      viewH: 256,
    });
    expect(svg).toContain(icons.adonis);
  });

  test('icons are placed every 300 units and wrap after perLine icons', () => {
    const svg = generateSvg(Array(5).fill('adonis'), 2);
    expect(positions(svg)).toEqual([
      [0, 0],
      [300, 0],
      [0, 300],
      [300, 300],
      [0, 600],
    ]);
    expect(svgAttrs(svg)).toMatchObject({
      viewW: 2 * 300 - 44,
      viewH: 3 * 300 - 44,
    });
  });

  test('with fewer icons than perLine, the width depends on the icon count', () => {
    const svg = generateSvg(['adonis', 'adonis'], 15);
    expect(svgAttrs(svg)).toEqual({
      width: (2 * 300 - 44) * (48 / 256),
      height: 48,
      viewW: 2 * 300 - 44,
      viewH: 256,
    });
  });

  test('perLine works even as a query string', () => {
    expect(generateSvg(Array(3).fill('adonis'), '2')).toBe(
      generateSvg(Array(3).fill('adonis'), 2),
    );
  });

  test('icons are embedded in the given order', () => {
    const svg = generateSvg(['adonis', 'java-dark'], 15);
    expect(svg.indexOf(icons.adonis)).toBeLessThan(
      svg.indexOf(icons['java-dark']),
    );
  });
});

describe('handleRequest', () => {
  test('GET /icons returns an SVG', async () => {
    const res = await get('/icons?i=java,adonis&theme=light&perline=1');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(await res.text()).toBe(
      generateSvg(parseShortNames(['java', 'adonis'], 'light'), '1'),
    );
  });

  test('accepts the parameter aliases (icons, t) and a trailing slash', async () => {
    const a = await (await get('/icons?i=java&theme=light')).text();
    const b = await (await get('/icons/?icons=java&t=light')).text();
    expect(b).toBe(a);
  });

  test('i=all shows every icon', async () => {
    const svg = await (await get('/icons?i=all')).text();
    expect(positions(svg)).toHaveLength(iconNameList.length);
  });

  test.each([
    ['/icons', 400, "You didn't specify any icons!"],
    ['/icons?i=', 400, "You didn't specify any icons!"],
    ['/icons?i=java&theme=blue', 400, 'Theme must be either "light" or "dark"'],
    [
      '/icons?i=java&perline=abc',
      400,
      'Icons per line must be a number between 1 and 50',
    ],
    [
      '/icons?i=java&perline=51',
      400,
      'Icons per line must be a number between 1 and 50',
    ],
  ])('%s → %d', async (path, status, message) => {
    const res = await get(path);
    expect(res.status).toBe(status);
    expect(await res.text()).toBe(message);
  });

  test('GET /api/icons returns the list of icon names', async () => {
    const res = await get('/api/icons');
    expect(res.headers.get('content-type')).toBe(
      'application/json;charset=UTF-8',
    );
    expect(await res.json()).toEqual(iconNameList);
  });

  test('GET /api/svgs returns every SVG', async () => {
    const res = await get('/api/svgs');
    expect(res.headers.get('content-type')).toBe(
      'application/json;charset=UTF-8',
    );
    expect(await res.json()).toEqual(icons);
  });

  test('GET /builder returns the Image Builder HTML', async () => {
    const res = await get('/builder');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const html = await res.text();
    expect(html.toLowerCase().startsWith('<!doctype html>')).toBe(true);
    // the icon catalog is embedded
    expect(html).toContain('"name":"javascript"');
  });

  // Forwarding loops back to this Worker where there is no origin (wrangler dev, workers.dev), and every
  // /favicon.ico request from the browser made the icon images loading at the same time fail
  test.each(['/favicon.ico', '/', '/unknown'])(
    'unknown path %s returns 404 instead of being forwarded',
    async path => {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Not Found');
    },
  );

  test('GET /builder returns the same HTML with a trailing slash or a query (the page builds its initial state from the URL)', async () => {
    const html = await (await get('/builder')).text();
    expect(await (await get('/builder/')).text()).toBe(html);
    expect(await (await get('/builder?i=js&theme=light')).text()).toBe(html);
  });
});

describe('shortNames', () => {
  test('every short name points to an existing icon', () => {
    const missing = Object.values(shortNames).filter(
      name => !iconNameList.includes(name),
    );
    expect(missing).toEqual([]);
  });

  test('no short name equals an existing icon name (otherwise the short name would never be used)', () => {
    const shadowed = Object.keys(shortNames).filter(name =>
      iconNameList.includes(name),
    );
    expect(shadowed).toEqual([]);
  });
});
