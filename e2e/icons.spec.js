// @ts-check
const { test, expect } = require('@playwright/test');

/** @param {import('@playwright/test').APIRequestContext} request */
async function getSvg(request, query) {
  const res = await request.get(`/icons?${query}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/svg+xml');
  return res.text();
}

// generateSvg が各アイコンを包む <g> を数える。
// アイコン自体の SVG にも translate を使う <g> があるので、"整数, 整数" の形式に限定する
const countIcons = svg =>
  (svg.match(/<g transform="translate\(\d+, \d+\)">/g) || []).length;

const svgSize = svg => {
  const m = svg.match(
    /<svg width="([^"]+)" height="([^"]+)" viewBox="0 0 ([^ ]+) ([^"]+)"/
  );
  if (!m) throw new Error('svg 要素が見つかりません');
  return { width: m[1], height: m[2], viewW: m[3], viewH: m[4] };
};

test.describe('GET /icons: 出力される SVG', () => {
  // 生成される SVG 全体をスナップショットで固定する。
  // アイコンの SVG を意図的に変更したときは `npm run test:e2e -- --update-snapshots` で更新する。
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

  test('アイコンのサイズは 1 個 48px で、既定では 1 行 15 個まで並ぶ', async ({
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
    // 15 個で折り返して 2 行になる
    expect(svgSize(svg)).toEqual({
      width: String((15 * 300 - 44) * (48 / 256)),
      height: String((2 * 300 - 44) * (48 / 256)),
      viewW: String(15 * 300 - 44),
      viewH: String(2 * 300 - 44),
    });
  });

  test('perline で 1 行あたりの個数を変えられる', async ({ request }) => {
    const svg = await getSvg(request, 'i=java,kotlin,nodejs,figma&perline=3');
    expect(svgSize(svg)).toMatchObject({
      viewW: String(3 * 300 - 44),
      viewH: String(2 * 300 - 44),
    });
    expect(svg).toContain('<g transform="translate(0, 300)">');
  });

  test('テーマ未指定時は dark を使う', async ({ request }) => {
    const def = await getSvg(request, 'i=java');
    const dark = await getSvg(request, 'i=java&theme=dark');
    const light = await getSvg(request, 'i=java&theme=light');
    expect(def).toBe(dark);
    expect(def).not.toBe(light);
  });

  test('パラメータの短縮形 (icons → i, theme → t) が使える', async ({
    request,
  }) => {
    expect(await getSvg(request, 'icons=java,kotlin&t=light')).toBe(
      await getSvg(request, 'i=java,kotlin&theme=light')
    );
  });

  test('アイコン名の別名 (js, ts, py, k8s など) は正式名と同じ SVG になる', async ({
    request,
  }) => {
    expect(await getSvg(request, 'i=js,ts,py,k8s,tailwind')).toBe(
      await getSvg(
        request,
        'i=javascript,typescript,python,kubernetes,tailwindcss'
      )
    );
    // テーマ付きアイコンへの別名にもテーマが反映される
    expect(await getSvg(request, 'i=next&theme=light')).toBe(
      await getSvg(request, 'i=nextjs&theme=light')
    );
  });

  test('i=all ですべてのアイコンを並べる', async ({ request }) => {
    const names = await (await request.get('/api/icons')).json();
    const svg = await getSvg(request, 'i=all');
    expect(countIcons(svg)).toBe(names.length);
  });

  test('末尾のスラッシュがあっても同じ結果を返す', async ({ request }) => {
    const res = await request.get('/icons/?i=java');
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe(await getSvg(request, 'i=java'));
  });

  test('[現状の挙動] 存在しないアイコン名はエラーにならず "undefined" が埋め込まれる', async ({
    request,
  }) => {
    const svg = await getSvg(request, 'i=java,no-such-icon');
    expect(countIcons(svg)).toBe(2);
    expect(svg).toMatch(
      /<g transform="translate\(300, 0\)">\s*undefined\s*<\/g>/
    );
  });
});

test.describe('GET /icons: エラー', () => {
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
