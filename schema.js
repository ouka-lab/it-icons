// アイコンと icons.config.js のスキーマ。build.js でビルド時に検証する。
// Worker (lib.js) からは読み込まないので、valibot は Worker のバンドルに入らない。
const v = require('valibot');

// 正式名・短縮名: 英数字のみ
const NameSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9]+$/, '名前は英小文字と数字のみにしてください'),
);

// icons/ のファイル名を小文字にして .svg を除いたもの。
// lib.js は "-" で区切ってテーマを判定するため、"-dark" / "-light" 以外の "-" は使えない
const IconIdSchema = v.pipe(
  v.string(),
  v.regex(
    /^[a-z0-9]+(-(dark|light))?$/,
    'ファイル名は "<英数字>.svg" か "<英数字>-Dark.svg" / "<英数字>-Light.svg" にしてください',
  ),
);

// SVG 本体: 256x256 の SVG
const SvgSchema = v.pipe(
  v.string(),
  v.check(s => s.trimStart().startsWith('<svg'), '<svg で始まっていません'),
  v.check(s => s.trimEnd().endsWith('</svg>'), '</svg> で終わっていません'),
  v.includes(
    'viewBox="0 0 256 256"',
    'viewBox を "0 0 256 256" にしてください',
  ),
);

// テーマ付きアイコンの対応が正しいか検証する
function checkThemes(icons) {
  const problems = [];
  const ids = Object.keys(icons);
  for (const id of ids) {
    const [base, theme] = id.split('-');
    if (!theme) continue;
    const other = theme === 'dark' ? 'light' : 'dark';
    if (!ids.includes(`${base}-${other}`))
      problems.push(`${id} に対応する ${base}-${other} がありません`);
    if (theme === 'dark' && ids.includes(base))
      problems.push(`${base} はテーマ付きとテーマなしの両方があります`);
  }
  return problems;
}

// dist/icons.json の中身: { アイコン ID: SVG }
const IconsSchema = v.pipe(
  v.record(IconIdSchema, SvgSchema),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) return;
    for (const message of checkThemes(dataset.value)) addIssue({ message });
  }),
);

// icons.config.js の形だけを検証するスキーマ
const IconsConfigShapeSchema = v.record(
  NameSchema,
  v.strictObject({
    aliases: v.optional(
      v.pipe(v.array(NameSchema), v.minLength(1, 'aliases が空です')),
    ),
    readmeId: v.optional(NameSchema),
  }),
);

// 実在するアイコンの正式名を受け取り、icons.config.js の中身まで検証するスキーマを作る
function createIconsConfigSchema(iconNames) {
  const names = new Set(iconNames);
  return v.pipe(
    IconsConfigShapeSchema,
    v.rawCheck(({ dataset, addIssue }) => {
      if (!dataset.typed) return;
      const seen = new Map(); // 短縮名 → 正式名
      for (const [name, { aliases = [], readmeId }] of Object.entries(
        dataset.value,
      )) {
        if (!names.has(name))
          addIssue({ message: `${name} というアイコンはありません` });
        for (const alias of aliases) {
          if (names.has(alias))
            addIssue({
              message: `${name} の短縮名 ${alias} は、同名のアイコンがあるので使えません`,
            });
          if (seen.has(alias))
            addIssue({
              message: `短縮名 ${alias} が ${seen.get(alias)} と ${name} で重複しています`,
            });
          seen.set(alias, name);
        }
        if (
          readmeId !== undefined &&
          readmeId !== name &&
          !aliases.includes(readmeId)
        )
          addIssue({
            message: `${name} の readmeId ${readmeId} は、正式名か aliases のいずれかにしてください`,
          });
      }
    }),
  );
}

// アイコン ID の一覧から正式名の一覧を作る (テーマ違いは 1 つにまとめる)
const toIconNames = iconIds => [
  ...new Set(iconIds.map(id => id.split('-')[0])),
];

module.exports = {
  NameSchema,
  IconIdSchema,
  SvgSchema,
  IconsSchema,
  IconsConfigShapeSchema,
  createIconsConfigSchema,
  toIconNames,
};
