// icons/ の SVG と icons.config.js を schema.js のスキーマで検証し、dist/icons.json を出力する。
// 検証に失敗したら理由を表示して終了コード 1 で終わる。
const fs = require('node:fs');
const path = require('node:path');
const v = require('valibot');
const {
  IconsSchema,
  createIconsConfigSchema,
  toIconNames,
} = require('./schema');

function parseOrExit(schema, input, label) {
  const result = v.safeParse(schema, input);
  if (result.success) return result.output;
  console.error(`✖ ${label}\n${v.summarize(result.issues)}`);
  process.exit(1);
}

const icons = {};
for (const file of fs.readdirSync('./icons')) {
  const name = file.replace('.svg', '').toLowerCase();
  icons[name] = String(fs.readFileSync(`./icons/${file}`));
}
parseOrExit(IconsSchema, icons, 'icons/ のアイコンが不正です');

const config = require(path.resolve('icons.config.js'));
parseOrExit(
  createIconsConfigSchema(toIconNames(Object.keys(icons))),
  config,
  'icons.config.js が不正です',
);

if (!fs.existsSync('./dist')) fs.mkdirSync('./dist');
fs.writeFileSync('./dist/icons.json', JSON.stringify(icons));
