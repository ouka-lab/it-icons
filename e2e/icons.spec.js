// @ts-check
const { test, expect } = require('@playwright/test');

/** @param {import('@playwright/test').APIRequestContext} request */
async function getSvg(request, query) {
  const res = await request.get(`/icons?${query}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/svg+xml');
  return res.text();
}

// Counts the <g> elements that generateSvg wraps around each icon.
// Icon SVGs themselves also use <g> with translate, so only match the "integer, integer" form
const countIcons = svg =>
  (svg.match(/<g transform="translate\(\d+, \d+\)">/g) || []).length;

const svgSize = svg => {
  const m = svg.match(
    /<svg width="([^"]+)" height="([^"]+)" viewBox="0 0 ([^ ]+) ([^"]+)"/,
  );
  if (!m) throw new Error('svg element not found');
  return { width: m[1], height: m[2], viewW: m[3], viewH: m[4] };
};

test.describe('GET /icons: generated SVG', () => {
  // Pins the whole generated SVG with snapshots.
  // After intentionally changing icon SVGs, update them with `bun run test:e2e --update-snapshots`.
  const cases = [
    ['single', 'i=java'],
    ['multiple', 'i=java,kotlin,nodejs,figma'],
    ['theme-light', 'i=java,kotlin,nodejs,figma&theme=light'],
    ['perline-2', 'i=java,kotlin,nodejs,figma&perline=2'],
  ];
  for (const [name, query] of cases) {
    test(`${name}: ${query}`, async ({ request }) => {
      expect(await getSvg(request, query)).toMatchSnapshot(`${name}.svg`);
    });
  }

  test('each icon is 48px and a line holds up to 15 icons by default', async ({
    request,
  }) => {
    expect(svgSize(await getSvg(request, 'i=java'))).toEqual({
      width: '48',
      height: '48',
      viewW: '256',
      viewH: '256',
    });

    const names = Array(16).fill('java').join(',');
    const svg = await getSvg(request, `i=${names}`);
    expect(countIcons(svg)).toBe(16);
    // wraps after 15 icons into 2 lines
    expect(svgSize(svg)).toEqual({
      width: String((15 * 300 - 44) * (48 / 256)),
      height: String((2 * 300 - 44) * (48 / 256)),
      viewW: String(15 * 300 - 44),
      viewH: String(2 * 300 - 44),
    });
  });

  test('perline changes the number of icons per line', async ({ request }) => {
    const svg = await getSvg(request, 'i=java,kotlin,nodejs,figma&perline=3');
    expect(svgSize(svg)).toMatchObject({
      viewW: String(3 * 300 - 44),
      viewH: String(2 * 300 - 44),
    });
    expect(svg).toContain('<g transform="translate(0, 300)">');
  });

  test('uses dark when no theme is given', async ({ request }) => {
    const def = await getSvg(request, 'i=java');
    const dark = await getSvg(request, 'i=java&theme=dark');
    const light = await getSvg(request, 'i=java&theme=light');
    expect(def).toBe(dark);
    expect(def).not.toBe(light);
  });

  test('accepts the parameter aliases (icons for i, t for theme)', async ({
    request,
  }) => {
    expect(await getSvg(request, 'icons=java,kotlin&t=light')).toBe(
      await getSvg(request, 'i=java,kotlin&theme=light'),
    );
  });

  test('short names (js, ts, py, k8s, ...) give the same SVG as the canonical names', async ({
    request,
  }) => {
    expect(await getSvg(request, 'i=js,ts,py,k8s,tailwind')).toBe(
      await getSvg(
        request,
        'i=javascript,typescript,python,kubernetes,tailwindcss',
      ),
    );
    // the theme also applies to short names of themed icons
    expect(await getSvg(request, 'i=next&theme=light')).toBe(
      await getSvg(request, 'i=nextjs&theme=light'),
    );
  });

  test('i=all shows every icon', async ({ request }) => {
    const names = await (await request.get('/api/icons')).json();
    const svg = await getSvg(request, 'i=all');
    expect(countIcons(svg)).toBe(names.length);
  });

  test('returns the same result with a trailing slash', async ({ request }) => {
    const res = await request.get('/icons/?i=java');
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe(await getSvg(request, 'i=java'));
  });

  test('[current behavior] an unknown icon name is not an error and embeds "undefined"', async ({
    request,
  }) => {
    const svg = await getSvg(request, 'i=java,no-such-icon');
    expect(countIcons(svg)).toBe(2);
    expect(svg).toMatch(
      /<g transform="translate\(300, 0\)">\s*undefined\s*<\/g>/,
    );
  });
});

test.describe('GET /icons: errors', () => {
  const cases = [
    ['', "You didn't specify any icons!"],
    ['i=', "You didn't specify any icons!"],
    ['i=java&theme=blue', 'Theme must be either "light" or "dark"'],
    ['i=java&perline=abc', 'Icons per line must be a number between 1 and 50'],
    ['i=java&perline=51', 'Icons per line must be a number between 1 and 50'],
    ['i=java&perline=-2', 'Icons per line must be a number between 1 and 50'],
  ];
  for (const [query, message] of cases) {
    test(`400: /icons?${query}`, async ({ request }) => {
      const res = await request.get(`/icons?${query}`);
      expect(res.status()).toBe(400);
      expect(await res.text()).toBe(message);
    });
  }
});
