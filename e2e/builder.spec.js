// @ts-check
// Spec of the Image Builder page (/builder), checked by driving it in a browser (Chromium)
const { test, expect } = require('@playwright/test');

/** @typedef {import('@playwright/test').Page} Page */

const GITHUB_LIGHT = 'rgb(255, 255, 255)';
const GITHUB_DARK = 'rgb(13, 17, 23)';

/** @param {Page} page */
const open = (page, query = '') =>
  page.goto(`/builder${query ? `?${query}` : ''}`);

/** @param {Page} page */
const origin = page => new URL(page.url()).origin;

/** @param {Page} page */
const ui = page => ({
  output: page.getByRole('textbox', { name: 'Code for your README' }),
  preview: page.getByRole('img', { name: 'Preview' }),
  previewStage: page.getByTestId('preview-stage'),
  previewEmpty: page.getByText('Select icons to see the preview'),
  stale: page.getByText('Not updated yet'),
  updatePreview: page.getByRole('button', { name: 'Update preview' }),
  copy: page.getByRole('button', { name: 'Copy' }),
  clearAll: page.getByRole('button', { name: 'Clear all' }),
  chips: page
    .getByRole('list', { name: 'Selected icons' })
    .getByRole('listitem'),
  search: page.getByRole('searchbox', { name: 'Search icons' }),
  grid: page.getByRole('list', { name: 'Icons', exact: true }),
  perline: page.getByRole('spinbutton', { name: 'Icons per line' }),
  center: page.getByRole('checkbox', { name: 'Center' }),
  all: page.getByRole('checkbox', { name: 'Show every icon (i=all)' }),
});

// Radio buttons hidden for styling (output format, language) are chosen by clicking their labels
/** @param {Page} page @param {string} name */
const choose = (page, name) =>
  page.getByRole('radio', { name, exact: true }).check({ force: true });

/** @param {import('@playwright/test').Locator} img */
const isLoaded = img =>
  img.evaluate(
    el => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0,
  );

// Returns the names of the selected icons in their order
/** @param {import('@playwright/test').Locator} chips */
const chipLabels = chips =>
  chips
    .getByTestId('chip-label')
    .allInnerTexts()
    .then(texts => texts.map(t => t.trim()));

// Arrow buttons hold two glyphs and hide one depending on the width, so compare the visible text
const visibleText = { useInnerText: true };

test.describe('header', () => {
  test('has the logo image and a link to GitHub', async ({ page }) => {
    await open(page);
    const logo = page.getByRole('img', { name: 'IT Icons' });
    await expect(logo).toBeVisible();
    await expect.poll(() => isLoaded(logo)).toBe(true);
    await expect(
      page.getByRole('link', { name: 'GitHub repository' }),
    ).toHaveAttribute('href', 'https://github.com/ouka-lab/it-icons');
  });
});

test.describe('initial state', () => {
  test('outputs the README example (js, html, css, wasm) as Markdown without parameters', async ({
    page,
  }) => {
    await open(page);
    const { output, chips } = ui(page);
    expect(await chipLabels(chips)).toEqual([
      'JavaScript',
      'HTML',
      'CSS',
      'WebAssembly',
    ]);
    const o = origin(page);
    await expect(output).toHaveValue(
      `[![My Skills](${o}/icons?i=js,html,css,wasm)](${o}/builder?i=js,html,css,wasm)`,
    );
  });

  test('uses the URL parameters as the initial input and shows the preview from the start', async ({
    page,
  }) => {
    await open(page, 'i=js,k8s&theme=light&perline=3&format=html&center=1');
    const { chips, perline, center, preview, previewStage, stale } = ui(page);
    expect(await chipLabels(chips)).toEqual(['JavaScript', 'Kubernetes']);
    await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked();
    await expect(perline).toHaveValue('3');
    await expect(page.getByRole('radio', { name: 'HTML' })).toBeChecked();
    await expect(center).toBeChecked();

    await expect(preview).toHaveAttribute(
      'src',
      `${origin(page)}/icons?i=js,kubernetes&theme=light&perline=3`,
    );
    await expect.poll(() => isLoaded(preview)).toBe(true);
    await expect(previewStage).toHaveCSS('background-color', GITHUB_LIGHT);
    await expect(stale).toBeHidden();
  });

  test('ignores invalid values and says so', async ({ page }) => {
    await open(page, 'i=js,nope&theme=blue');
    expect(await chipLabels(ui(page).chips)).toEqual(['JavaScript']);
    await expect(
      page.getByText(
        'Ignored invalid values in the URL: icon "nope", theme "blue"',
      ),
    ).toBeVisible();
  });
});

test.describe('preview', () => {
  test('keeps the image until the preview button is pressed after changing icons, and shows "Not updated yet"', async ({
    page,
  }) => {
    await open(page, 'i=js,html');
    const { output, preview, stale, updatePreview, search, grid } = ui(page);
    const before = await preview.getAttribute('src');

    await search.fill('typescript');
    await grid.getByRole('button', { name: 'TypeScript' }).click();

    // the code changes right away
    await expect(output).toHaveValue(/i=js,html,ts\)/);
    // the preview does not change
    await expect(preview).toHaveAttribute('src', before ?? '');
    await expect(stale).toBeVisible();

    await updatePreview.click();
    await expect(preview).toHaveAttribute(
      'src',
      `${origin(page)}/icons?i=js,html,ts`,
    );
    await expect(stale).toBeHidden();
  });

  test('uses the GitHub background color of the theme, and changing the theme updates the image and background right away', async ({
    page,
  }) => {
    await open(page, 'i=js,html');
    const { preview, previewStage, stale } = ui(page);
    await expect(previewStage).toHaveCSS('background-color', GITHUB_DARK);

    await page.getByRole('radio', { name: 'Light' }).check();
    await expect(previewStage).toHaveCSS('background-color', GITHUB_LIGHT);
    await expect(preview).toHaveAttribute(
      'src',
      `${origin(page)}/icons?i=js,html&theme=light`,
    );
    await expect(stale).toBeHidden();

    await page.getByRole('radio', { name: 'Dark' }).check();
    await expect(previewStage).toHaveCSS('background-color', GITHUB_DARK);
    await expect(preview).toHaveAttribute(
      'src',
      `${origin(page)}/icons?i=js,html`,
    );
  });

  test('shows a hint instead of the preview when no icons are selected', async ({
    page,
  }) => {
    await open(page, 'i=js');
    const { clearAll, updatePreview, preview, previewEmpty, output, chips } =
      ui(page);
    await clearAll.click();
    await expect(chips).toHaveCount(0);
    await expect(output).toHaveValue('');
    await updatePreview.click();
    await expect(preview).toBeHidden();
    await expect(previewEmpty).toBeVisible();
  });
});

test.describe('code for the README', () => {
  test('defaults to Markdown; switching to HTML enables centering and puts the settings into the builder link', async ({
    page,
  }) => {
    await open(page, 'i=js,html');
    const { output, center } = ui(page);
    const o = origin(page);
    await expect(page.getByRole('radio', { name: 'Markdown' })).toBeChecked();
    await expect(center).toBeDisabled();

    await choose(page, 'HTML');
    await expect(center).toBeEnabled();
    await expect(output).toHaveValue(
      [
        `<a href="${o}/builder?i=js,html&format=html">`,
        `  <img src="${o}/icons?i=js,html" alt="My Skills" />`,
        '</a>',
      ].join('\n'),
    );

    await center.check();
    await expect(output).toHaveValue(
      [
        '<p align="center">',
        `  <a href="${o}/builder?i=js,html&format=html&center=1">`,
        `    <img src="${o}/icons?i=js,html" alt="My Skills" />`,
        '  </a>',
        '</p>',
      ].join('\n'),
    );

    await choose(page, 'Markdown');
    await expect(center).toBeDisabled();
    await expect(output).toHaveValue(
      `[![My Skills](${o}/icons?i=js,html)](${o}/builder?i=js,html)`,
    );
  });

  test('keeps the address bar URL in sync with the input (so it can be shared and edited again)', async ({
    page,
  }) => {
    await open(page, 'i=js,html');
    await page.getByRole('radio', { name: 'Light' }).check();
    await ui(page).perline.fill('3');
    await choose(page, 'HTML');
    await ui(page).center.check();
    await expect(page).toHaveURL(
      /\/builder\?i=js,html&theme=light&perline=3&format=html&center=1$/,
    );
  });

  test('copies the code to the clipboard with the copy button and shows the result', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, 'i=js,html');
    const { output, copy } = ui(page);
    await copy.click();
    await expect(page.getByRole('status')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await output.inputValue(),
    );
  });

  test('choosing every icon gives i=all and disables the skill selection', async ({
    page,
  }) => {
    await open(page, 'i=js,html');
    const { all, output, search } = ui(page);
    await all.check();
    await expect(output).toHaveValue(/icons\?i=all\)/);
    await expect(search).toBeDisabled();
    await all.uncheck();
    await expect(output).toHaveValue(/icons\?i=js,html\)/);
    await expect(search).toBeEnabled();
  });

  test('changes the number of icons per line', async ({ page }) => {
    await open(page, 'i=js,html');
    await ui(page).perline.fill('5');
    await expect(ui(page).output).toHaveValue(/icons\?i=js,html&perline=5\)/);
  });
});

test.describe('skill selection', () => {
  test('filters by search (canonical name, short name, readme ID)', async ({
    page,
  }) => {
    await open(page, 'i=');
    const { search, grid } = ui(page);
    const firstLabel = () =>
      grid
        .getByRole('button')
        .first()
        .innerText()
        .then(t => t.trim());

    await search.fill('ts');
    await expect.poll(firstLabel).toBe('TypeScript');
    await search.fill('k8s');
    await expect(grid.getByRole('button')).toHaveCount(1);
    await expect.poll(firstLabel).toBe('Kubernetes');
    await search.fill('zzzz');
    await expect(grid.getByText('No icons found')).toBeVisible();
  });

  test('clicking the list toggles the selection', async ({ page }) => {
    await open(page, 'i=js');
    const { grid, search, chips } = ui(page);
    await search.fill('docker');
    const docker = grid.getByRole('button', { name: 'Docker' });
    await docker.click();
    await expect(docker).toHaveAttribute('aria-pressed', 'true');
    expect(await chipLabels(chips)).toEqual(['JavaScript', 'Docker']);
    await docker.click();
    await expect(docker).toHaveAttribute('aria-pressed', 'false');
    expect(await chipLabels(chips)).toEqual(['JavaScript']);
  });

  test('removes a selected icon', async ({ page }) => {
    await open(page, 'i=js,html,css');
    await page.getByRole('button', { name: 'Remove HTML' }).click();
    expect(await chipLabels(ui(page).chips)).toEqual(['JavaScript', 'CSS']);
    await expect(ui(page).output).toHaveValue(/icons\?i=js,css\)/);
  });

  test('reorders with the buttons and keeps the focus on the same button', async ({
    page,
  }) => {
    await open(page, 'i=js,html,css');
    const later = page.getByRole('button', { name: 'Move JavaScript later' });
    await later.click();
    expect(await chipLabels(ui(page).chips)).toEqual([
      'HTML',
      'JavaScript',
      'CSS',
    ]);
    await expect(later).toBeFocused();
    await expect(ui(page).output).toHaveValue(/icons\?i=html,js,css\)/);
    // "earlier" on the first and "later" on the last are disabled
    await expect(
      page.getByRole('button', { name: 'Move HTML earlier' }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Move CSS later' }),
    ).toBeDisabled();
  });

  test('lays out the selected icons in a row with left/right arrows on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, 'i=js,html');
    const [a, b] = await ui(page).chips.all();
    const boxA = await a.boundingBox();
    const boxB = await b.boundingBox();
    expect(boxB?.y).toBe(boxA?.y);
    await expect(
      page.getByRole('button', { name: 'Move JavaScript later' }),
    ).toHaveText('→', visibleText);
    await expect(
      page.getByRole('button', { name: 'Move HTML earlier' }),
    ).toHaveText('←', visibleText);
  });

  test('reorders by mouse drag', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, 'i=js,html,css');
    const { chips } = ui(page);
    // mouse and touch use viewport coordinates, so scroll the selected icons into view first
    await chips.first().scrollIntoViewIfNeeded();
    const from = await chips.filter({ hasText: 'CSS' }).boundingBox();
    const to = await chips.filter({ hasText: 'JavaScript' }).boundingBox();
    if (!from || !to) throw new Error('chip not found');
    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 2, to.y + to.height / 2, { steps: 10 });
    await page.mouse.up();
    expect(await chipLabels(chips)).toEqual(['CSS', 'JavaScript', 'HTML']);
    await expect(ui(page).output).toHaveValue(/icons\?i=css,js,html\)/);
  });

  test('the icon list has a fixed height and only the list scrolls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, 'i=js');
    const { grid } = ui(page);
    const { scrollHeight, clientHeight, overflowY } = await grid.evaluate(
      el => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: getComputedStyle(el).overflowY,
      }),
    );
    expect(overflowY).toBe('auto');
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    // scrolled to the bottom of the page, the whole list box fits in the viewport
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const box = await grid.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(720);

    // scrolled to the bottom of the list, the last icon is visible
    await grid.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await expect(grid.getByRole('button').last()).toBeInViewport();
  });
});

test.describe('icon list images', () => {
  test('no image in the list breaks after reopening with a rewritten URL', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await open(page, 'i=html,js,css,wasm&theme=light&perline=2');
    await open(
      page,
      'i=html,js,css,wasm,hono,coderabbit&theme=light&perline=3',
    );
    const { grid } = ui(page);

    const broken = await grid.evaluate(async el => {
      // Browsers request /favicon.ico for every page, so load the list images at the same time.
      // Failures depend on timing, so reload them 3 times without the cache
      const brokenSrcs = [];
      for (let round = 0; round < 3; round++) {
        const favicons = Array.from({ length: 5 }, () =>
          fetch('/favicon.ico', { cache: 'no-store' }).catch(() => null),
        );
        const imgs = [...el.querySelectorAll('img')];
        const loads = imgs.map(
          img =>
            new Promise(resolve => {
              img.loading = 'eager';
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
              img.src = `${img.src.replace(/&r=\d+$/, '')}&r=${round}`;
            }),
        );
        await Promise.all([...loads, ...favicons]);
        brokenSrcs.push(
          ...imgs.filter(img => img.naturalWidth === 0).map(img => img.src),
        );
      }
      return brokenSrcs;
    });
    expect(broken).toEqual([]);
  });
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('has no horizontal scroll', async ({ page }) => {
    await open(page);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('stacks the selected icons vertically with up/down arrows', async ({
    page,
  }) => {
    await open(page, 'i=js,html');
    const [a, b] = await ui(page).chips.all();
    const boxA = await a.boundingBox();
    const boxB = await b.boundingBox();
    expect(boxB?.y).toBeGreaterThan((boxA?.y ?? 0) + (boxA?.height ?? 0) - 1);
    await expect(
      page.getByRole('button', { name: 'Move JavaScript later' }),
    ).toHaveText('↓', visibleText);
    await expect(
      page.getByRole('button', { name: 'Move HTML earlier' }),
    ).toHaveText('↑', visibleText);
  });

  test('reorders by touch drag', async ({ page }) => {
    await open(page, 'i=js,html,css');
    const { chips } = ui(page);
    // mouse and touch use viewport coordinates, so scroll the selected icons into view first
    await chips.first().scrollIntoViewIfNeeded();
    const from = await chips.filter({ hasText: 'CSS' }).boundingBox();
    const to = await chips.filter({ hasText: 'JavaScript' }).boundingBox();
    if (!from || !to) throw new Error('chip not found');

    // Playwright has no touch drag, so send touch events through CDP
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });
    const x = from.x + 20;
    await touch('touchStart', x, from.y + from.height / 2);
    const endY = to.y + 2;
    for (let i = 1; i <= 10; i++) {
      const y =
        from.y + from.height / 2 + ((endY - from.y - from.height / 2) * i) / 10;
      await touch('touchMove', x, y);
    }
    await touch('touchEnd', x, endY);

    expect(await chipLabels(chips)).toEqual(['CSS', 'JavaScript', 'HTML']);
  });
});

test.describe('language', () => {
  test('defaults to English; switching to Japanese changes the texts and stays Japanese on the next visit', async ({
    page,
  }) => {
    await open(page, 'i=js');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();

    await choose(page, 'JA');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(
      page.getByRole('heading', { name: 'プレビュー' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'プレビューを更新' }),
    ).toBeVisible();
    // the language is not part of the output or the address bar URL
    await expect(page).toHaveURL(/\/builder\?i=js$/);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(
      page.getByRole('heading', { name: 'プレビュー' }),
    ).toBeVisible();
  });
});
