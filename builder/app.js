// UI logic of the Image Builder. build.js inlines it after builder/messages.js and core.js.
// Uses the URL parameters as the initial input and builds the README code from the input.
(function () {
  const {
    parseParams,
    toImageQuery,
    toBuilderQuery,
    hasIcons,
    renderOutput,
    searchIcons,
  } = globalThis.BuilderCore;
  const MESSAGES = globalThis.BuilderMessages;
  const CATALOG = JSON.parse(document.getElementById('catalog').textContent);
  const ORIGIN = location.origin;
  const byName = new Map(CATALOG.map(e => [e.name, e]));

  const $ = id => document.getElementById(id);
  const esc = value =>
    String(value).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

  // ---- Language: the saved setting if any, otherwise English ----
  function initialLang() {
    try {
      const saved = localStorage.getItem('lang');
      if (saved && Object.hasOwn(MESSAGES, saved)) return saved;
    } catch {}
    return 'en';
  }
  let lang = initialLang();
  const t = (key, ...args) => {
    const m = MESSAGES[lang][key];
    return typeof m === 'function' ? m(...args) : m;
  };

  // ---- State ----
  const { state, ignored } = parseParams(
    new URLSearchParams(location.search),
    CATALOG,
  );
  // Query of the image in the preview (shown as "Not updated yet" when it differs from the input)
  let previewedQuery = null;
  const imageQuery = () => toImageQuery(state, CATALOG);
  const thumb = (entry, size) =>
    `<img src="${ORIGIN}/icons?i=${esc(entry.id)}&amp;theme=${state.theme}" width="${size}" height="${size}" alt="" loading="lazy" />`;

  // ---- Rendering ----
  // Rewrites the static texts in the current language
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelector(`input[name="lang"][value="${lang}"]`).checked =
      true;
    for (const el of document.querySelectorAll('[data-i18n]'))
      el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-aria]'))
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    for (const el of document.querySelectorAll('[data-i18n-title]'))
      el.title = t(el.dataset.i18nTitle);
    for (const el of document.querySelectorAll('[data-i18n-placeholder]'))
      el.placeholder = t(el.dataset.i18nPlaceholder);
    for (const el of document.querySelectorAll('[data-i18n-alt]'))
      el.alt = t(el.dataset.i18nAlt);
    $('chips').dataset.empty = t('chipsEmpty');
    $('ignored').hidden = ignored.length === 0;
    $('ignored').textContent = t(
      'ignored',
      ignored
        .map(({ kind, value }) => t('ignoredValue', kind, value))
        .join(t('listSep')),
    );
  }

  function renderChips() {
    const last = state.names.length - 1;
    $('chips').innerHTML = state.names
      .map((name, i) => {
        const e = byName.get(name);
        const label = esc(e.label);
        return `<li class="chip" data-name="${esc(name)}">
          <span class="chip__handle" title="${esc(t('dragHint'))}">${thumb(e, 24)}<span data-testid="chip-label">${label}</span></span>
          <button type="button" data-move="-1" aria-label="${esc(t('moveBefore', e.label))}" ${i === 0 ? 'disabled' : ''}><span class="arrow-h" aria-hidden="true">←</span><span class="arrow-v" aria-hidden="true">↑</span></button>
          <button type="button" data-move="1" aria-label="${esc(t('moveAfter', e.label))}" ${i === last ? 'disabled' : ''}><span class="arrow-h" aria-hidden="true">→</span><span class="arrow-v" aria-hidden="true">↓</span></button>
          <button type="button" data-remove aria-label="${esc(t('remove', e.label))}">×</button>
        </li>`;
      })
      .join('');
    $('selected-count').textContent = t('selected', state.names.length);
    $('clear-btn').disabled = state.names.length === 0;
  }

  function renderGrid() {
    const results = searchIcons(CATALOG, $('search').value);
    $('search-count').textContent = t(
      'searchCount',
      results.length,
      CATALOG.length,
    );
    $('grid').innerHTML = results.length
      ? results
          .map(
            e =>
              `<li><button type="button" data-name="${esc(e.name)}" aria-pressed="${state.names.includes(e.name)}">${thumb(e, 40)}<span>${esc(e.label)}</span></button></li>`,
          )
          .join('')
      : `<li class="grid__empty">${esc(t('notFound'))}</li>`;
  }

  function renderOptions() {
    // The preview background follows the selected theme
    $('preview-stage').dataset.bg = state.theme;
    $('skills').disabled = state.all;
    $('all').checked = state.all;
    $('center').disabled = state.format !== 'html';
    $('center').checked = state.center && state.format === 'html';
    $('center-hint').hidden = state.format === 'html';
    $('perline').value = $('perline-range').value = state.perline;
  }

  function renderPreviewState() {
    $('stale').hidden =
      previewedQuery === null || previewedQuery === imageQuery();
  }

  function updatePreview() {
    const img = $('preview-img');
    img.hidden = !hasIcons(state);
    if (hasIcons(state)) img.src = `${ORIGIN}/icons?${imageQuery()}`;
    $('preview-empty').hidden = hasIcons(state);
    previewedQuery = imageQuery();
    renderPreviewState();
  }

  // Common handling when the input changes
  function changed({ grid = true, chips = true } = {}) {
    if (chips) renderChips();
    if (grid) renderGrid();
    renderOptions();
    $('output').value = renderOutput(state, CATALOG, ORIGIN);
    renderPreviewState();
    try {
      history.replaceState(null, '', `?${toBuilderQuery(state, CATALOG)}`);
    } catch {}
  }

  // Announces the reordering result to screen readers (slightly delayed so that the focus announcement does not swallow it)
  let announceTimer;
  function announce(name) {
    const announcer = $('announcer');
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announceTimer = setTimeout(() => {
      announcer.textContent = t(
        'moved',
        byName.get(name).label,
        state.names.indexOf(name) + 1,
        state.names.length,
      );
    }, 300);
  }

  function moveTo(name, index) {
    const rest = state.names.filter(n => n !== name);
    rest.splice(index, 0, name);
    state.names = rest;
    changed();
    announce(name);
  }

  // ---- Events ----
  document.querySelectorAll('input[name="lang"]').forEach(radio =>
    radio.addEventListener('change', () => {
      lang = radio.value;
      try {
        localStorage.setItem('lang', lang);
      } catch {}
      applyLang();
      changed();
    }),
  );

  $('grid').addEventListener('click', ev => {
    const button = ev.target.closest('button[data-name]');
    if (!button) return;
    const name = button.dataset.name;
    state.names = state.names.includes(name)
      ? state.names.filter(n => n !== name)
      : [...state.names, name];
    button.setAttribute('aria-pressed', String(state.names.includes(name)));
    changed({ grid: false });
  });

  // Buttons on the selected chips (earlier / later / remove)
  $('chips').addEventListener('click', ev => {
    const chip = ev.target.closest('.chip');
    const button = ev.target.closest('button');
    if (!chip || !button) return;
    const name = chip.dataset.name;
    const index = state.names.indexOf(name);
    if (button.hasAttribute('data-remove')) {
      state.names.splice(index, 1);
      changed();
      return;
    }
    const move = button.dataset.move;
    moveTo(name, index + Number(move));
    // Keep the focus on the same button after moving (or the opposite one if it became disabled)
    const again = $('chips').querySelector(
      `[data-name="${CSS.escape(name)}"] [data-move="${move}"]`,
    );
    const other = $('chips').querySelector(
      `[data-name="${CSS.escape(name)}"] [data-move="${-Number(move)}"]`,
    );
    (again && !again.disabled ? again : other)?.focus();
  });

  // ---- Reordering by drag (Pointer Events handle both mouse and touch) ----
  let drag = null;
  const DRAG_THRESHOLD = 4;

  $('chips').addEventListener('pointerdown', ev => {
    const handle = ev.target.closest('.chip__handle');
    if (!handle || drag || !ev.isPrimary || ev.button !== 0) return;
    ev.preventDefault();
    handle.setPointerCapture(ev.pointerId);
    drag = {
      chip: handle.closest('.chip'),
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      started: false,
      target: null,
    };
  });

  // Finds the drop position from the layout positions of the other chips
  function updateDropTarget(x, y) {
    const list = $('chips');
    const column = getComputedStyle(list).flexDirection === 'column';
    const others = [...list.children].filter(li => li !== drag.chip);
    let before = null;
    for (const li of others) {
      const r = li.getBoundingClientRect();
      const isBefore = column
        ? y < r.top + r.height / 2
        : y < r.top || (y <= r.bottom && x < r.left + r.width / 2);
      if (isBefore) {
        before = li;
        break;
      }
    }
    const index = before ? others.indexOf(before) : others.length;
    const current = state.names.indexOf(drag.chip.dataset.name);
    for (const li of others) li.removeAttribute('data-drop');
    // Dropping at the original position does nothing
    drag.target = index === current ? null : index;
    if (drag.target === null) return;
    if (before) before.dataset.drop = 'before';
    else others.at(-1).dataset.drop = 'after';
  }

  document.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (!drag.started) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.started = true;
      drag.chip.setAttribute('data-dragging', '');
      document.documentElement.setAttribute('data-dragging', '');
    }
    drag.chip.style.translate = `${dx}px ${dy}px`;
    updateDropTarget(ev.clientX, ev.clientY);
  });

  function endDrag(commit) {
    if (!drag) return;
    const { chip, target } = drag;
    drag = null;
    chip.removeAttribute('data-dragging');
    chip.style.translate = '';
    document.documentElement.removeAttribute('data-dragging');
    for (const li of $('chips').children) li.removeAttribute('data-drop');
    if (commit && target !== null) moveTo(chip.dataset.name, target);
  }

  document.addEventListener('pointerup', ev => {
    if (drag && ev.pointerId === drag.pointerId) endDrag(true);
  });
  document.addEventListener('pointercancel', ev => {
    if (drag && ev.pointerId === drag.pointerId) endDrag(false);
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') endDrag(false);
  });

  // ---- Other inputs ----
  $('clear-btn').addEventListener('click', () => {
    state.names = [];
    changed();
  });
  $('search').addEventListener('input', () => renderGrid());

  document.querySelectorAll('input[name="format"]').forEach(radio =>
    radio.addEventListener('change', () => {
      state.format = radio.value;
      changed({ grid: false, chips: false });
    }),
  );
  document.querySelectorAll('input[name="theme"]').forEach(radio =>
    radio.addEventListener('change', () => {
      state.theme = radio.value;
      changed();
      // The theme also changes the preview background, so update the image right away to keep them in sync
      updatePreview();
    }),
  );
  for (const id of ['perline', 'perline-range']) {
    $(id).addEventListener('input', ev => {
      const n = Math.round(Number(ev.target.value));
      if (!Number.isFinite(n) || n < 1) return;
      state.perline = Math.min(50, n);
      changed({ grid: false, chips: false });
    });
  }
  $('center').addEventListener('change', ev => {
    state.center = ev.target.checked;
    changed({ grid: false, chips: false });
  });
  $('all').addEventListener('change', ev => {
    state.all = ev.target.checked;
    changed({ grid: false, chips: false });
  });

  $('preview-btn').addEventListener('click', updatePreview);

  // Copy: report the result in the role="status" element outside the button and swap the icon to a check on success
  let copyTimer;
  $('copy-btn').addEventListener('click', async () => {
    const button = $('copy-btn');
    const tip = $('copy-tip');
    clearTimeout(copyTimer);
    tip.textContent = '';
    tip.removeAttribute('data-failed');
    button.removeAttribute('data-copied');
    let ok = true;
    try {
      await navigator.clipboard.writeText($('output').value);
    } catch {
      ok = false;
    }
    if (ok) button.setAttribute('data-copied', '');
    else tip.setAttribute('data-failed', '');
    requestAnimationFrame(() => {
      tip.textContent = t(ok ? 'copied' : 'copyFailed');
    });
    copyTimer = setTimeout(() => {
      tip.textContent = '';
      button.removeAttribute('data-copied');
    }, 2000);
  });

  // ---- Init: use the URL state as the initial input and show the preview ----
  document.querySelector(
    `input[name="theme"][value="${state.theme}"]`,
  ).checked = true;
  document.querySelector(
    `input[name="format"][value="${state.format}"]`,
  ).checked = true;
  applyLang();
  changed();
  updatePreview();
})();
