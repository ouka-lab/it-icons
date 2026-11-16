// readme.md のアイコン一覧を icons/ と icons.config.js から生成する。
// `bun run readme` で実行する (列幅は続けて実行する bun fmt が揃える)。
// main に SVG か icons.config.js の変更が入ると、.github/workflows/readme.yml が実行して自動コミットする。
const fs = require('node:fs');
const path = require('node:path');

const MARKERS =
  /(<!-- ICONS-LIST:START[^>]*-->\n)[\s\S]*?(\n<!-- ICONS-LIST:END -->)/;

// アイコン一覧の Markdown の表を作る。
// 正式名の順に並べ、テーマ付きのアイコンは Dark の画像を載せる
function renderIconsTable(files, config) {
  const fileByName = new Map();
  for (const file of files) {
    const [name, theme] = file
      .replace(/\.svg$/, '')
      .toLowerCase()
      .split('-');
    if (theme !== 'light') fileByName.set(name, file);
  }
  const rows = [...fileByName.keys()]
    .sort()
    .map(
      name =>
        `| \`${config[name]?.readmeId ?? name}\` | <img src="./icons/${fileByName.get(name)}" width="48"> |`,
    );
  return ['| Icon ID | Icon |', '| :-----: | :--: |', ...rows].join('\n');
}

// readme の目印の間を表に差し替える
function replaceIconsTable(readme, table) {
  if (!MARKERS.test(readme))
    throw new Error(
      'readme.md に <!-- ICONS-LIST:START --> と <!-- ICONS-LIST:END --> の目印がありません',
    );
  // bun fmt が目印と表の間に空行を入れるので、最初から入れておく
  return readme.replace(
    MARKERS,
    (_, start, end) => `${start}\n${table}\n${end}`,
  );
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const readmePath = path.join(root, 'readme.md');
  const table = renderIconsTable(
    fs.readdirSync(path.join(root, 'icons')),
    require('../icons.config'),
  );
  fs.writeFileSync(
    readmePath,
    replaceIconsTable(fs.readFileSync(readmePath, 'utf8'), table),
  );
}

module.exports = { renderIconsTable, replaceIconsTable };
