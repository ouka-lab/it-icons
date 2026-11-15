// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// webServer の起動時に npm run build で生成される
const loadIcons = () =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'dist', 'icons.json'), 'utf8')
  );

test.describe('GET /api/svgs', () => {
  test('dist/icons.json の中身をそのまま JSON で返す', async ({ request }) => {
    const res = await request.get('/api/svgs');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe(
      'application/json;charset=UTF-8'
    );
    expect(await res.json()).toEqual(loadIcons());
  });
});

test.describe('GET /api/icons', () => {
  test('テーマ違いをまとめたアイコン名の一覧を返す', async ({ request }) => {
    const res = await request.get('/api/icons');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe(
      'application/json;charset=UTF-8'
    );

    const names = await res.json();
    const expected = [
      ...new Set(Object.keys(loadIcons()).map(i => i.split('-')[0])),
    ];
    expect(names).toEqual(expected);

    // テーマ付きアイコンは "-dark" / "-light" を除いた名前で 1 件だけ載る
    expect(names).toContain('java');
    expect(names).not.toContain('java-dark');
    expect(names.filter(n => n === 'java')).toHaveLength(1);
  });

  test('末尾のスラッシュがあっても同じ結果を返す', async ({ request }) => {
    const a = await (await request.get('/api/icons')).json();
    const b = await (await request.get('/api/icons/')).json();
    expect(b).toEqual(a);
  });
});
