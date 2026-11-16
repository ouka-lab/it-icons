// Generates the icon list in readme.md from icons/ and icons.config.js.
// Run with `bun run readme` (bun fmt, which runs right after, aligns the columns).
// When SVGs or icons.config.js change on main, .github/workflows/readme.yml runs it and commits the result.
const fs = require('node:fs');
const path = require('node:path');

const MARKERS =
  /(<!-- ICONS-LIST:START[^>]*-->\n)[\s\S]*?(\n<!-- ICONS-LIST:END -->)/;

// Builds the Markdown table of icons,
// sorted by canonical name, showing the Dark image for themed icons
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

// Replaces the content between the markers in the readme with the table
function replaceIconsTable(readme, table) {
  if (!MARKERS.test(readme))
    throw new Error(
      'readme.md has no <!-- ICONS-LIST:START --> and <!-- ICONS-LIST:END --> markers',
    );
  // bun fmt puts blank lines between the markers and the table, so add them up front
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
