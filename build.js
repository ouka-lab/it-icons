// Validates the SVGs in icons/ and icons.config.js with the schemas in schema.js, then writes
// dist/icons.json and the Image Builder HTML (dist/builder.js).
// If validation fails, prints the reason, exits with code 1 and writes nothing.
const fs = require('node:fs');
const path = require('node:path');
const v = require('valibot');
const {
  IconsSchema,
  createIconsConfigSchema,
  toIconNames,
} = require('./schema');
const { buildCatalog } = require('./builder/catalog');

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
parseOrExit(IconsSchema, icons, 'Invalid icons in icons/');

const config = require(path.resolve('icons.config.js'));
parseOrExit(
  createIconsConfigSchema(toIconNames(Object.keys(icons))),
  config,
  'Invalid icons.config.js',
);

if (!fs.existsSync('./dist')) fs.mkdirSync('./dist');
fs.writeFileSync('./dist/icons.json', JSON.stringify(icons));

// Build the Image Builder (/builder) HTML by filling the template in builder/ with the catalog, CSS, scripts and logo
const builderDir = path.join(__dirname, 'builder');
const readBuilderFile = name =>
  fs.readFileSync(path.join(builderDir, name), 'utf8');
// Escape "<" so that the JSON embedded in <script> can never close the element (e.g. "</script>")
const catalogJson = JSON.stringify(
  buildCatalog(fs.readdirSync('./icons'), config),
).replace(/</g, '\\u003c');
const logo = fs.readFileSync(path.join(builderDir, 'logo.png'), 'base64');
const scripts = [
  `<script id="catalog" type="application/json">${catalogJson}</script>`,
  ...['messages.js', 'core.js', 'app.js'].map(
    name => `<script>\n${readBuilderFile(name)}</script>`,
  ),
].join('\n');
const builderHtml = readBuilderFile('index.html')
  .replace('src="__LOGO_SRC__"', () => `src="data:image/png;base64,${logo}"`)
  .replace(
    '<!-- BUILD:STYLE -->',
    () => `<style>\n${readBuilderFile('style.css')}</style>`,
  )
  .replace('<!-- BUILD:SCRIPTS -->', () => scripts);
fs.writeFileSync(
  './dist/builder.js',
  `module.exports = ${JSON.stringify(builderHtml)};\n`,
);

// The link preview image of /builder (og:image), served by the Worker at /builder/og.png.
// Stored as base64 because the Worker is bundled without loader rules for binary files
const ogImage = fs.readFileSync(
  path.join(__dirname, '.github', 'eyecatch.png'),
  'base64',
);
fs.writeFileSync(
  './dist/og-image.js',
  `module.exports = ${JSON.stringify(ogImage)};\n`,
);
