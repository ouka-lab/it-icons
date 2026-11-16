// DOM-independent logic of the Image Builder.
// It runs both in the browser (build.js inlines it into the HTML) and in bun test,
// so it is exported as module.exports in Node and as globalThis.BuilderCore in the browser.
(function (exports) {
  const DEFAULT_PERLINE = 15;
  // Icons selected when there are no parameters (same as the README example)
  const DEFAULT_ICONS = ['javascript', 'html', 'css', 'webassembly'];

  // Index built once per catalog (canonical name / readme ID / short name -> entry)
  const indexes = new WeakMap();
  function indexOf(catalog) {
    let index = indexes.get(catalog);
    if (!index) {
      const byName = new Map();
      const lookup = new Map();
      for (const entry of catalog) {
        byName.set(entry.name, entry);
        for (const key of [entry.name, entry.id, ...(entry.aliases ?? [])])
          if (!lookup.has(key)) lookup.set(key, entry);
      }
      index = { byName, lookup };
      indexes.set(catalog, index);
    }
    return index;
  }

  /**
   * Builds the initial input state from the URL parameters.
   * Invalid values keep the defaults and are returned as { kind, value } in parameter order.
   * @param {URLSearchParams} params
   */
  function parseParams(params, catalog) {
    const { byName, lookup } = indexOf(catalog);
    const state = {
      names: [],
      all: false,
      theme: 'dark',
      perline: DEFAULT_PERLINE,
      format: 'md',
      center: false,
    };
    const ignored = [];

    const icons = params.get('i') ?? params.get('icons');
    if (icons === null) state.names = DEFAULT_ICONS.filter(n => byName.has(n));
    else if (icons === 'all') state.all = true;
    else {
      for (const raw of icons.split(',')) {
        const token = raw.trim();
        if (!token) continue;
        const entry = lookup.get(token.toLowerCase());
        if (!entry) ignored.push({ kind: 'icon', value: token });
        else if (!state.names.includes(entry.name))
          state.names.push(entry.name);
      }
    }

    const theme = params.get('t') ?? params.get('theme');
    if (theme === 'dark' || theme === 'light') state.theme = theme;
    else if (theme !== null) ignored.push({ kind: 'theme', value: theme });

    const perline = params.get('perline');
    if (perline !== null) {
      const n = Number(perline);
      if (/^\d+$/.test(perline) && n >= 1 && n <= 50) state.perline = n;
      else ignored.push({ kind: 'perline', value: perline });
    }

    const format = params.get('format');
    if (format === 'md' || format === 'html') state.format = format;
    else if (format !== null) ignored.push({ kind: 'format', value: format });

    const center = params.get('center');
    if (center === '1') state.center = true;
    else if (center !== null) ignored.push({ kind: 'center', value: center });

    return { state, ignored };
  }

  // Query for the image (/icons). Parameters with default values are omitted
  function toImageQuery(state, catalog) {
    const { byName } = indexOf(catalog);
    const ids = state.all
      ? 'all'
      : state.names.map(n => byName.get(n)?.id ?? n).join(',');
    let query = `i=${ids}`;
    if (state.theme !== 'dark') query += `&theme=${state.theme}`;
    if (state.perline !== DEFAULT_PERLINE) query += `&perline=${state.perline}`;
    return query;
  }

  // Query for the builder (/builder). Includes the output format and centering so that reopening it restores the same state
  function toBuilderQuery(state, catalog) {
    let query = toImageQuery(state, catalog);
    if (state.format === 'html') {
      query += '&format=html';
      if (state.center) query += '&center=1';
    }
    return query;
  }

  const hasIcons = state => state.all || state.names.length > 0;

  // Code to paste into a README
  function renderOutput(state, catalog, origin) {
    if (!hasIcons(state)) return '';
    const image = `${origin}/icons?${toImageQuery(state, catalog)}`;
    const builder = `${origin}/builder?${toBuilderQuery(state, catalog)}`;
    if (state.format === 'md') return `[![My Skills](${image})](${builder})`;
    const link = [
      `<a href="${builder}">`,
      `  <img src="${image}" alt="My Skills" />`,
      '</a>',
    ];
    if (!state.center) return link.join('\n');
    return ['<p align="center">', ...link.map(l => `  ${l}`), '</p>'].join(
      '\n',
    );
  }

  // Compares canonical names by code point (same order as the README icon list)
  const compareNames = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  // Searches icons: exact matches first, then prefix matches, then substring matches; ties are sorted by canonical name
  function searchIcons(catalog, query) {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    const rank = entry => {
      const keys = [
        entry.name,
        entry.id,
        entry.label.toLowerCase(),
        ...(entry.aliases ?? []),
      ];
      if (keys.includes(q)) return 0;
      if (keys.some(k => k.startsWith(q))) return 1;
      if (keys.some(k => k.includes(q))) return 2;
      return -1;
    };
    return catalog
      .map(entry => ({ entry, rank: rank(entry) }))
      .filter(r => r.rank >= 0)
      .sort(
        (a, b) => a.rank - b.rank || compareNames(a.entry.name, b.entry.name),
      )
      .map(r => r.entry);
  }

  Object.assign(exports, {
    DEFAULT_PERLINE,
    DEFAULT_ICONS,
    parseParams,
    toImageQuery,
    toBuilderQuery,
    hasIcons,
    renderOutput,
    searchIcons,
  });
})(typeof module === 'object' ? module.exports : (globalThis.BuilderCore = {}));
