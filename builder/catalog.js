// Builds the icon catalog for the Image Builder from the file names in icons/ and icons.config.js.
// build.js embeds the result in the HTML as JSON.
//
//   id:      the ID used in the generated URLs (readmeId, or the canonical name)
//   name:    the canonical name (the file name, lowercased, without -Dark/-Light)
//   label:   the name shown on the page (keeps the file name's casing)
//   aliases: short names (used for search)
//   themed:  whether the icon has Dark/Light variants
function buildCatalog(files, config) {
  const byName = new Map();
  for (const file of files) {
    if (!file.endsWith('.svg')) continue;
    const [label, theme] = file.slice(0, -'.svg'.length).split('-');
    const name = label.toLowerCase();
    const entry = byName.get(name) ?? { name, label, themed: false };
    if (theme) entry.themed = true;
    byName.set(name, entry);
  }
  return [...byName.values()]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(({ name, label, themed }) => {
      const { aliases, readmeId } = config[name] ?? {};
      const entry = { id: readmeId ?? name, name, label };
      if (aliases) entry.aliases = [...aliases];
      if (themed) entry.themed = true;
      return entry;
    });
}

module.exports = { buildCatalog };
