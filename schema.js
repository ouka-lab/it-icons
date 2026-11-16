// Schemas for the icons and icons.config.js. build.js validates them at build time.
// The Worker (lib.js) does not load this file, so valibot is not bundled into the Worker.
const v = require('valibot');

// Canonical names and short names: lowercase letters and digits only
const NameSchema = v.pipe(
  v.string(),
  v.regex(
    /^[a-z0-9]+$/,
    'Names must contain only lowercase letters and digits',
  ),
);

// A file name in icons/, lowercased, without .svg.
// lib.js splits on "-" to find the theme, so "-" is only allowed in "-dark" / "-light"
const IconIdSchema = v.pipe(
  v.string(),
  v.regex(
    /^[a-z0-9]+(-(dark|light))?$/,
    'File names must be "<alphanumeric>.svg" or "<alphanumeric>-Dark.svg" / "<alphanumeric>-Light.svg"',
  ),
);

// SVG content: a 256x256 SVG
const SvgSchema = v.pipe(
  v.string(),
  v.check(s => s.trimStart().startsWith('<svg'), 'Does not start with <svg'),
  v.check(s => s.trimEnd().endsWith('</svg>'), 'Does not end with </svg>'),
  v.includes('viewBox="0 0 256 256"', 'viewBox must be "0 0 256 256"'),
);

// Checks that themed icons come in Dark/Light pairs
function checkThemes(icons) {
  const problems = [];
  const ids = Object.keys(icons);
  for (const id of ids) {
    const [base, theme] = id.split('-');
    if (!theme) continue;
    const other = theme === 'dark' ? 'light' : 'dark';
    if (!ids.includes(`${base}-${other}`))
      problems.push(`${base}-${other} is missing for ${id}`);
    if (theme === 'dark' && ids.includes(base))
      problems.push(`${base} exists both with and without themes`);
  }
  return problems;
}

// Content of dist/icons.json: { icon ID: SVG }
const IconsSchema = v.pipe(
  v.record(IconIdSchema, SvgSchema),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) return;
    for (const message of checkThemes(dataset.value)) addIssue({ message });
  }),
);

// Schema that only checks the shape of icons.config.js
const IconsConfigShapeSchema = v.record(
  NameSchema,
  v.strictObject({
    aliases: v.optional(
      v.pipe(v.array(NameSchema), v.minLength(1, 'aliases is empty')),
    ),
    readmeId: v.optional(NameSchema),
  }),
);

// Creates a schema that also checks the content of icons.config.js against the existing icon names
function createIconsConfigSchema(iconNames) {
  const names = new Set(iconNames);
  return v.pipe(
    IconsConfigShapeSchema,
    v.rawCheck(({ dataset, addIssue }) => {
      if (!dataset.typed) return;
      const seen = new Map(); // short name -> canonical name
      for (const [name, { aliases = [], readmeId }] of Object.entries(
        dataset.value,
      )) {
        if (!names.has(name))
          addIssue({ message: `There is no icon named ${name}` });
        for (const alias of aliases) {
          if (names.has(alias))
            addIssue({
              message: `Short name ${alias} of ${name} cannot be used because an icon has the same name`,
            });
          if (seen.has(alias))
            addIssue({
              message: `Short name ${alias} is used by both ${seen.get(alias)} and ${name}`,
            });
          seen.set(alias, name);
        }
        if (
          readmeId !== undefined &&
          readmeId !== name &&
          !aliases.includes(readmeId)
        )
          addIssue({
            message: `readmeId ${readmeId} of ${name} must be the canonical name or one of the aliases`,
          });
      }
    }),
  );
}

// Turns icon IDs into canonical names (theme variants become one name)
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
