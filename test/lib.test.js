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

// generateSvg が各アイコンを包む <g> の translate 座標を取り出す
const positions = svg =>
  [...svg.matchAll(/<g transform="translate\((\d+), (\d+)\)">/g)].map(m => [
    Number(m[1]),
    Number(m[2]),
  ]);

const svgAttrs = svg => {
  const m = svg.match(
    /<svg width="([^"]+)" height="([^"]+)" viewBox="0 0 ([^ ]+) ([^"]+)"/,
  );
  if (!m) throw new Error('svg 要素が見つかりません');
  return {
    width: Number(m[1]),
    height: Number(m[2]),
    viewW: Number(m[3]),
    viewH: Number(m[4]),
  };
};

describe('iconNameList / themedIcons', () => {
  test('テーマ違いは "-dark" / "-light" を除いた 1 つの名前にまとめられる', () => {
    expect(iconNameList).toContain('java');
    expect(iconNameList).not.toContain('java-dark');
    expect(iconNameList).not.toContain('java-light');
    expect(new Set(iconNameList).size).toBe(iconNameList.length);
  });

  test('themedIcons にはテーマ付きのアイコンだけが含まれる', () => {
    expect(themedIcons).toContain('java');
    for (const name of themedIcons) {
      expect(icons[`${name}-dark`]).toBeString();
      expect(icons[`${name}-light`]).toBeString();
    }
    // テーマなしのアイコン
    expect(icons.adonis).toBeString();
    expect(themedIcons).not.toContain('adonis');
  });
});

describe('parseShortNames', () => {
  test('テーマなしのアイコンは名前そのまま', () => {
    expect(parseShortNames(['adonis'])).toEqual(['adonis']);
  });

  test('テーマ付きのアイコンは既定で -dark が付く', () => {
    expect(parseShortNames(['java'])).toEqual(['java-dark']);
    expect(parseShortNames(['java'], undefined)).toEqual(['java-dark']);
  });

  test('theme を指定するとそのテーマが付く', () => {
    expect(parseShortNames(['java', 'adonis'], 'light')).toEqual([
      'java-light',
      'adonis',
    ]);
  });

  test('別名は正式名に変換され、テーマも反映される', () => {
    expect(parseShortNames(['js', 'k8s'])).toEqual(
      parseShortNames(['javascript', 'kubernetes']),
    );
    expect(parseShortNames(['next'], 'light')).toEqual(
      parseShortNames(['nextjs'], 'light'),
    );
  });

  test('順序と重複は入力のまま保たれる', () => {
    expect(parseShortNames(['adonis', 'java', 'adonis'])).toEqual([
      'adonis',
      'java-dark',
      'adonis',
    ]);
  });

  test('[現状の挙動] 存在しない名前は undefined になる', () => {
    expect(parseShortNames(['java', 'no-such-icon'])).toEqual([
      'java-dark',
      undefined,
    ]);
  });
});

describe('generateSvg', () => {
  test('アイコン 1 個は 48px 四方で viewBox は 256', () => {
    const svg = generateSvg(['adonis'], 15);
    expect(svgAttrs(svg)).toEqual({
      width: 48,
      height: 48,
      viewW: 256,
      viewH: 256,
    });
    expect(svg).toContain(icons.adonis);
  });

  test('アイコンは 300 間隔で並び、perLine 個で折り返す', () => {
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

  test('アイコン数が perLine より少なければ幅はアイコン数で決まる', () => {
    const svg = generateSvg(['adonis', 'adonis'], 15);
    expect(svgAttrs(svg)).toEqual({
      width: (2 * 300 - 44) * (48 / 256),
      height: 48,
      viewW: 2 * 300 - 44,
      viewH: 256,
    });
  });

  test('perLine はクエリ文字列のままでも数値として扱われる', () => {
    expect(generateSvg(Array(3).fill('adonis'), '2')).toBe(
      generateSvg(Array(3).fill('adonis'), 2),
    );
  });

  test('アイコンは指定した順に埋め込まれる', () => {
    const svg = generateSvg(['adonis', 'java-dark'], 15);
    expect(svg.indexOf(icons.adonis)).toBeLessThan(
      svg.indexOf(icons['java-dark']),
    );
  });
});

describe('handleRequest', () => {
  test('GET /icons は SVG を返す', async () => {
    const res = await get('/icons?i=java,adonis&theme=light&perline=1');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(await res.text()).toBe(
      generateSvg(parseShortNames(['java', 'adonis'], 'light'), '1'),
    );
  });

  test('パラメータの短縮形 (icons, t) と末尾スラッシュを受け付ける', async () => {
    const a = await (await get('/icons?i=java&theme=light')).text();
    const b = await (await get('/icons/?icons=java&t=light')).text();
    expect(b).toBe(a);
  });

  test('i=all ですべてのアイコンを並べる', async () => {
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

  test('GET /api/icons はアイコン名の一覧を返す', async () => {
    const res = await get('/api/icons');
    expect(res.headers.get('content-type')).toBe(
      'application/json;charset=UTF-8',
    );
    expect(await res.json()).toEqual(iconNameList);
  });

  test('GET /api/svgs はすべての SVG を返す', async () => {
    const res = await get('/api/svgs');
    expect(res.headers.get('content-type')).toBe(
      'application/json;charset=UTF-8',
    );
    expect(await res.json()).toEqual(icons);
  });
});

describe('shortNames', () => {
  test('別名の変換先はすべて実在するアイコン', () => {
    const missing = Object.values(shortNames).filter(
      name => !iconNameList.includes(name),
    );
    expect(missing).toEqual([]);
  });

  test('別名が実在するアイコン名と重複していない (重複すると別名が使われない)', () => {
    const shadowed = Object.keys(shortNames).filter(name =>
      iconNameList.includes(name),
    );
    expect(shadowed).toEqual([]);
  });
});
