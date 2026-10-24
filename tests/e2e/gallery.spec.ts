import { test, expect, type Page } from '@playwright/test';

// Drives the real web/ modules through dev/index.html: a stubbed ComfyUI host,
// no backend, no menu choreography. See dev/index.html for the harness itself.
//
// The library is served from an in-memory fixture rather than the harness's
// scratch file, so each test starts clean and the POST payloads are observable.

type HarnessCheck = { name: string; value: string; ok: boolean };
type HarnessReport = { report: HarnessCheck[]; failed: number };
type Library = Record<string, { preset?: string }>;

const FIXTURE: Library = {
  'Faces/Portrait': { preset: 'portrait, studio lighting' },
  'Faces/Macro': { preset: 'macro, close-up' },
  'Faces/Variants': { preset: '{Scenery}' },
  'Scenery/Hills': { preset: 'rolling hills' },
  'Scenery/Sky': { preset: 'dramatic sky' },
  '_/combo/_default': { preset: 'masterpiece' },
};

// A second library, so the merge has somewhere to go. It shares `Faces/Portrait`
// with the first one on purpose: that is what makes the merge order visible.
const SAMPLE_LIBRARY: Library = {
  'Faces/Portrait': { preset: 'extra portrait, rim light' },
  'Sample/Cinematic': { preset: 'cinematic lighting, dramatic shadows' },
  'Sample/Pixel': { preset: '16-bit retro pixel art' },
};

const LIBRARIES = [
  { id: 'main', name: 'Main', default: true },
  { id: 'sample', name: 'Sample', default: false },
];

const ITEMS_MAIN = 6;
const ITEMS_MAIN_VISIBLE = 5; // the underscore-prefixed combo default is hidden
// both libraries enabled by default: main (6) + sample (3), with the one name
// they share listed twice
const ITEMS_MERGED = 9;
const ITEMS_MERGED_VISIBLE = 8;

let library: Library = {};
let posts: Library[] = [];

const wrap = (page: Page) => page.locator('.j0n4t-pg-wrap');
const chips = (page: Page) => page.locator('.j0n4t-pg-basket-chip');
const visibleItems = (page: Page) => page.locator('.j0n4t-pg-item:not(.j0n4t-pg-hidden)');
const widgetValue = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gallery: { widget: { value: string } } })
    .__gallery.widget.value);
const serializedPrompt = (page: Page) =>
  page.evaluate(() => {
    const node = (window as unknown as {
      __pgNode: { widgets: Array<{ name: string; serializeValue?: () => string }> };
    }).__pgNode;
    return node.widgets.find((widget) => widget.name === 'evaluated_preset')?.serializeValue?.() ?? '';
  });

type Gallery = {
  basket: { render: (...args: unknown[]) => unknown };
};

/** Start counting basket rebuilds. Read the total with `renderCount`. */
async function startCountingRenders(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gallery = (window as unknown as { __gallery: Gallery }).__gallery;
    const counter = { count: 0 };
    const original = gallery.basket.render;
    gallery.basket.render = function (...args: unknown[]) {
      counter.count++;
      return original.apply(this, args);
    };
    (window as unknown as { __renderCount: typeof counter }).__renderCount = counter;
  });
}

const renderCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __renderCount: { count: number } }).__renderCount.count);

/** The view / grouping / collapse controls live in the More Options popup. */
async function openMoreOptions(page: Page) {
  const popup = page.locator('#j0n4t-pg-popup-menu');
  if (!(await popup.evaluate((el) => el.classList.contains('show')))) {
    await page.locator('#j0n4t-pg-more-options-btn').click();
  }
  await expect(popup).toHaveClass(/show/);
}

/** The panel is expanded after init; only toggle when it is actually collapsed. */
async function openPanel(page: Page) {
  const editor = page.locator('.j0n4t-pg-editor');
  if (await editor.evaluate((el) => el.classList.contains('collapsed'))) {
    await page.locator('#j0n4t-pg-toggle').click();
  }
  await expect(editor).not.toHaveClass(/collapsed/);
}

/** Open the settings modal on its Display tab, where the gallery options live. */
async function openDisplayTab(page: Page) {
  await page.locator('#j0n4t-pg-config-btn').click();
  const modal = page.locator('.j0n4t-pg-modal-overlay');
  await expect(modal).toBeVisible();
  await modal.locator('.j0n4t-pg-tab-btn[data-tab="display"]').click();
  return modal;
}

test.beforeEach(async ({ page }) => {
  library = structuredClone(FIXTURE);
  posts = [];

  // One route for both verbs, so a save round-trips like the real API does.
  // The library comes from ?library=, so switching libraries is observable.
  const dataByLibrary: Record<string, Library> = {};
  await page.route('**/preset_gallery/libraries**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LIBRARIES),
    });
  });
  await page.route('**/preset_gallery/presets**', async (route) => {
    const id =
      new URL(route.request().url()).searchParams.get('library') ?? 'default';
    if (route.request().method() === 'POST') {
      dataByLibrary[id] = JSON.parse(route.request().postData() ?? '{}');
      posts.push(dataByLibrary[id]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success' }),
      });
      return;
    }
    const served = dataByLibrary[id] ?? (id === 'sample' ? SAMPLE_LIBRARY : library);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(served),
    });
  });

  await page.goto('/dev/index.html');
  await page.waitForFunction(() => {
    const w = window as unknown as { __report?: unknown };
    return w.__report !== undefined;
  });

  // If the gallery did not mount, every assertion below is meaningless.
  const report = await page.evaluate(
    () => (window as unknown as { __report: HarnessReport }).__report
  );
  expect(report.report.filter((c) => !c.ok)).toEqual([]);
});

test.describe('load', () => {
  test('mounts the gallery with its parts', { tag: '@smoke' }, async ({ page }) => {
    await expect(wrap(page)).toBeVisible();
    await expect(page.locator('.j0n4t-pg-grid')).toBeVisible();
    await expect(page.locator('.j0n4t-pg-search')).toBeVisible();
    await expect(page.locator('.j0n4t-pg-basket-container')).toBeVisible();
    await expect(page.locator('.j0n4t-pg-editor')).toBeAttached();
  });

  test('renders the libraries served by the API, merged', { tag: '@smoke' }, async ({ page }) => {
    await expect(page.locator('.j0n4t-pg-item')).toHaveCount(ITEMS_MERGED);
    await expect(visibleItems(page)).toHaveCount(ITEMS_MERGED_VISIBLE);
  });

  test('hides the widget it drives', { tag: '@smoke' }, async ({ page }) => {
    const hidden = await page.evaluate(
      () => (window as unknown as { __gallery: { widget: { hidden: boolean } } }).__gallery.widget.hidden
    );
    expect(hidden).toBe(true);
  });

  test('restores an initial selection as a chip', { tag: '@smoke' }, async ({ page }) => {
    await expect(chips(page)).toHaveCount(1);
  });
});

test.describe('search', () => {
  test('hides everything for a query that matches nothing', { tag: '@smoke' }, async ({ page }) => {
    await page.locator('.j0n4t-pg-search').fill('zzz_no_such_preset_zzz');
    await expect(visibleItems(page)).toHaveCount(0);
  });

  test('keeps matching presets and hides the rest', { tag: '@smoke' }, async ({ page }) => {
    await page.locator('.j0n4t-pg-search').fill('hills');
    await expect(visibleItems(page)).toHaveCount(1);
  });

  test('clearing restores the whole grid', { tag: '@smoke' }, async ({ page }) => {
    await page.locator('.j0n4t-pg-search').fill('hills');
    await expect(visibleItems(page)).toHaveCount(1);
    await page.locator('.j0n4t-pg-search-clear').click();
    await expect(visibleItems(page)).toHaveCount(ITEMS_MERGED_VISIBLE);
  });
});

test.describe('grid controls', () => {
  test('grouping toggle flips its active state and the grid follows', async ({ page }) => {
    await openMoreOptions(page);
    const toggle = page.locator('#j0n4t-pg-group-toggle');
    const wasActive = await toggle.evaluate((el) => el.classList.contains('active'));

    await toggle.click();

    if (wasActive) {
      await expect(toggle).not.toHaveClass(/active/);
      await expect(page.locator('.j0n4t-pg-grid')).toHaveClass(/hide-folders/);
    } else {
      await expect(toggle).toHaveClass(/active/);
      await expect(page.locator('.j0n4t-pg-grid')).not.toHaveClass(/hide-folders/);
    }
  });

  test('collapse all hides every folder item', async ({ page }) => {
    await openMoreOptions(page);
    await page.locator('#j0n4t-pg-global-collapse').click();
    await expect(visibleItems(page)).toHaveCount(0);
  });

  test('switching view mode applies it to the grid', async ({ page }) => {
    await openMoreOptions(page);
    await page.locator('.j0n4t-pg-view-btn[data-view="list"]').click();
    await expect(page.locator('.j0n4t-pg-grid')).toHaveClass(/view-list/);
  });
});

test.describe('basket', () => {
  test('clicking a preset adds a chip and writes the widget', { tag: '@smoke' }, async ({ page }) => {
    await page.locator('.j0n4t-pg-item').first().click();
    await expect(chips(page)).toHaveCount(2);
    expect((await widgetValue(page)).length).toBeGreaterThan(0);
  });

  test('changing a chip variant updates its selection and generated prompt', async ({ page }) => {
    await page.locator('.j0n4t-pg-item[data-style="Faces/Portrait"]').click();
    await page.locator('.j0n4t-pg-item[data-style="Faces/Variants"]').click();
    await expect(chips(page)).toHaveCount(1);

    await chips(page).first().click();
    const variant = page.locator('.j0n4t-pg-var-input');
    await variant.fill('Sky');
    await page.locator('.j0n4t-pg-filter-autocomplete-item')
      .filter({ hasText: 'Scenery/Sky' }).click();

    await expect(chips(page).first().locator('.j0n4t-pg-basket-chip-label')).toHaveText('Sky');
    await expect.poll(() => widgetValue(page)).toBe('{Scenery:Scenery/Sky}');
    await expect.poll(() => serializedPrompt(page)).toBe('dramatic sky');
  });

  test('changing a chip weight updates its selection and generated prompt', async ({ page }) => {
    await page.locator('.j0n4t-pg-item[data-style="Faces/Portrait"]').click();
    await page.locator('.j0n4t-pg-item[data-style="Faces/Variants"]').click();
    await chips(page).first().click();
    const variant = page.locator('.j0n4t-pg-var-input');
    await variant.fill('Sky');
    await page.locator('.j0n4t-pg-filter-autocomplete-item')
      .filter({ hasText: 'Scenery/Sky' }).click();
    await page.locator('.j0n4t-pg-chip-popup [data-action="toggle-weight"]').click();
    await page.locator('.j0n4t-pg-chip-popup [data-action="weight-plus"]').click();

    await expect.poll(() => widgetValue(page)).toBe('({Scenery:Scenery/Sky}:1.05)');
    await expect.poll(() => serializedPrompt(page)).toBe('(dramatic sky:1.05)');
  });

  test('choosing None for a variant omits it from the generated prompt', async ({ page }) => {
    await page.locator('.j0n4t-pg-item[data-style="Faces/Portrait"]').click();
    await page.locator('.j0n4t-pg-item[data-style="Faces/Variants"]').click();
    await chips(page).first().click();
    const variant = page.locator('.j0n4t-pg-var-input');
    await variant.fill('None');
    await page.locator('.j0n4t-pg-filter-autocomplete-item')
      .filter({ hasText: 'None (Omit)' }).click();

    await expect.poll(() => widgetValue(page)).toBe('{Scenery:none}');
    await expect.poll(() => serializedPrompt(page)).toBe('');
  });

  test('dragging a chip changes Basket order and generated prompt order', async ({ page }) => {
    await page.locator('.j0n4t-pg-item[data-style="Scenery/Hills"]').click();
    await expect.poll(() => widgetValue(page)).toBe('Faces/Portrait, Scenery/Hills');
    const portrait = chips(page).filter({ hasText: 'Portrait' });
    const hills = chips(page).filter({ hasText: 'Hills' });

    await hills.dragTo(portrait, { targetPosition: { x: 1, y: 10 } });

    await expect(chips(page).nth(0)).toContainText('Hills');
    await expect(chips(page).nth(1)).toContainText('Portrait');
    await expect.poll(() => widgetValue(page)).toBe('Scenery/Hills, Faces/Portrait');
    await expect.poll(() => serializedPrompt(page)).toBe('rolling hills, portrait, studio lighting');
  });

  test('copying and pasting selected chips appends them in order with pin state', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.j0n4t-pg-item[data-style="Scenery/Hills"]').click();
    await page.locator('.j0n4t-pg-basket-multiselect-btn').click();
    await chips(page).nth(0).click();
    await chips(page).nth(1).click();
    await page.locator('.j0n4t-pg-basket-pin-btn').click();
    await page.locator('.j0n4t-pg-basket-copy-btn').click();
    await page.locator('.j0n4t-pg-basket-paste-btn').click();

    await expect(chips(page)).toHaveCount(4);
    await expect.poll(() => widgetValue(page)).toBe(
      'Faces/Portrait, Scenery/Hills, Faces/Portrait, Scenery/Hills'
    );
    await expect(chips(page).nth(2)).toHaveClass(/pinned/);
    await expect(chips(page).nth(3)).toHaveClass(/pinned/);
    await expect.poll(() => serializedPrompt(page)).toBe(
      'portrait, studio lighting, rolling hills, portrait, studio lighting, rolling hills'
    );
  });

  test('deleting a selected chip removes only that chip from the prompt', async ({ page }) => {
    await page.locator('.j0n4t-pg-item[data-style="Scenery/Hills"]').click();
    await page.locator('.j0n4t-pg-basket-multiselect-btn').click();
    await chips(page).nth(1).click();
    await page.locator('.j0n4t-pg-basket-delete-btn').click();

    await expect(chips(page)).toHaveCount(1);
    await expect.poll(() => widgetValue(page)).toBe('Faces/Portrait');
    await expect.poll(() => serializedPrompt(page)).toBe('portrait, studio lighting');
  });

  test('Alt+ArrowLeft moves the focused chip and its prompt before the prior chip', async ({ page }) => {
    await page.locator('.j0n4t-pg-item[data-style="Scenery/Hills"]').click();
    await chips(page).nth(1).focus();
    await chips(page).nth(1).press('Alt+ArrowLeft');

    await expect(chips(page).nth(0)).toContainText('Hills');
    await expect(chips(page).nth(1)).toContainText('Portrait');
    await expect.poll(() => widgetValue(page)).toBe('Scenery/Hills, Faces/Portrait');
    await expect.poll(() => serializedPrompt(page)).toBe('rolling hills, portrait, studio lighting');
  });

  test('raw mode adds chips from typed text', { tag: '@smoke' }, async ({ page }) => {
    await page.locator('#j0n4t-pg-basket-raw-toggle').click();
    const raw = page.locator('#j0n4t-pg-raw-input');
    await raw.fill('Faces/Portrait, Scenery/Hills');
    await raw.press('Enter');
    await expect(chips(page)).toHaveCount(2);
  });

  // The bug this guards: `updateWidgetValue` used to set the widget value AND
  // call the widget callback AND call syncUI, so one interaction rebuilt the
  // basket three times. Measured on a 120-chip basket: a single chip move went
  // from ~550 ms to ~120 ms once it rendered once.
  test('one value change renders the basket once', { tag: '@smoke' }, async ({ page }) => {
    await startCountingRenders(page);
    await visibleItems(page).first().click();
    await expect(chips(page)).toHaveCount(2);
    expect(await renderCount(page)).toBe(1);
  });
});

test.describe('panel', () => {
  test('toggle collapses and restores the management panel', async ({ page }) => {
    const editor = page.locator('.j0n4t-pg-editor');
    await page.locator('#j0n4t-pg-toggle').click();
    await expect(editor).toHaveClass(/collapsed/);
    await page.locator('#j0n4t-pg-toggle').click();
    await expect(editor).not.toHaveClass(/collapsed/);
  });
});

test.describe('editor', () => {
  test('saving a preset POSTs the whole library back', async ({ page }) => {
    await openPanel(page);
    await page.locator('#j0n4t-pg-name').fill('HarnessPreset');
    await page.locator('#j0n4t-pg-folder').fill('Faces');
    await page.locator('#j0n4t-pg-preset').fill('a harness preset');
    await page.locator('#j0n4t-pg-save-btn').click();

    await expect.poll(() => posts.length).toBeGreaterThan(0);
    const body = posts.at(-1) ?? {};

    // The API normalises keys to lowercase, and the client writes the WHOLE
    // library back on every edit (read-modify-write, no per-item endpoint).
    expect(Object.keys(body)).toContain('faces/harnesspreset');
    expect(body['faces/harnesspreset']?.preset).toBe('a harness preset');
    expect(Object.keys(body).length).toBeGreaterThan(Object.keys(FIXTURE).length);
  });

  test('a saved preset appears in the grid', async ({ page }) => {
    await openPanel(page);
    await page.locator('#j0n4t-pg-name').fill('ShowsUp');
    await page.locator('#j0n4t-pg-preset').fill('visible');
    await page.locator('#j0n4t-pg-save-btn').click();

    await expect(page.locator('.j0n4t-pg-item').filter({ hasText: 'ShowsUp' })).toBeVisible();
  });
});

test.describe('the engine', () => {
  test('serializeValue expands the selection to the final prompt', async ({ page }) => {
    const expanded = await page.evaluate(() => {
      const w = window as unknown as {
        __pgNode: { widgets: Array<{ name: string; serializeValue?: () => string }> };
      };
      return w.__pgNode.widgets.find((x) => x.name === 'evaluated_preset')?.serializeValue?.() ?? '';
    });
    expect(expanded).toBe('portrait, studio lighting');
  });

  test('a roll replaces the selection with several presets', async ({ page }) => {
    await page.locator('.j0n4t-pg-basket-reroll-btn').dispatchEvent('click', { shiftKey: true });
    const count = (await widgetValue(page)).split(',').filter((s) => s.trim()).length;
    expect(count).toBeGreaterThan(1);
  });
});

test.describe('persistence', () => {
  test('view mode survives a reload', async ({ page }) => {
    await openMoreOptions(page);
    await page.locator('.j0n4t-pg-view-btn[data-view="list"]').click();
    await expect(page.locator('.j0n4t-pg-grid')).toHaveClass(/view-list/);

    await page.reload();
    await page.waitForFunction(() => {
      const w = window as unknown as { __report?: unknown };
      return w.__report !== undefined;
    });
    await expect(page.locator('.j0n4t-pg-grid')).toHaveClass(/view-list/);
  });
});

test.describe('display height', () => {
  test('the gallery offers a manual resize handle only in fixed mode', async ({ page }) => {
    // Fit follows the node's own handle; the gallery's handle adjusts a fixed
    // height.
    expect(await wrap(page).evaluate((el) => getComputedStyle(el).resize)).toBe('none');

    const modal = await openDisplayTab(page);
    await modal.locator('#j0n4t-pg-height-mode').selectOption('fixed');
    await modal.locator('button[data-index="1"]').click();
    await expect(wrap(page)).toHaveAttribute('data-height-mode', 'fixed');
    expect(await wrap(page).evaluate((el) => getComputedStyle(el).resize)).toBe('vertical');
  });

  test('fit is the default height mode', async ({ page }) => {
    await expect(wrap(page)).toHaveAttribute('data-height-mode', 'fit');
  });

  test('a fixed height sizes the gallery and unlimited lifts the cap', async ({ page }) => {
    const modal = await openDisplayTab(page);
    await modal.locator('#j0n4t-pg-height-mode').selectOption('fixed');
    await modal.locator('#j0n4t-pg-height-fixed').fill('150');
    await modal.locator('button[data-index="1"]').click();

    await expect(wrap(page)).toHaveAttribute('data-height-mode', 'fixed');
    const capped = await wrap(page).evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(capped).toBe(150);

    const reopened = await openDisplayTab(page);
    await reopened.locator('#j0n4t-pg-height-mode').selectOption('unlimited');
    await reopened.locator('button[data-index="1"]').click();

    await expect(wrap(page)).toHaveAttribute('data-height-mode', 'unlimited');
    const uncapped = await wrap(page).evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(uncapped).toBeGreaterThan(capped);
  });

  // A resize handle fires no event: the browser just writes an inline height as
  // the pointer moves, so the only thing to observe is the down/up pair.
  const dragTo = async (page: Page, selector: string, height: number) => {
    const el = page.locator(selector);
    await el.evaluate((node) => node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await el.evaluate((node, h) => { (node as HTMLElement).style.height = `${h}px`; }, height);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup')));
  };
  const savedSetting = (page: Page, key: string) =>
    page.evaluate((k) => JSON.parse(localStorage.getItem('pg_settings') ?? '{}')[k], key);

  test('dragging a fixed-height gallery stores the new height', async ({ page }) => {
    const modal = await openDisplayTab(page);
    await modal.locator('#j0n4t-pg-height-mode').selectOption('fixed');
    await modal.locator('#j0n4t-pg-height-fixed').fill('300');
    await modal.locator('button[data-index="1"]').click();
    await expect(wrap(page)).toHaveAttribute('data-height-mode', 'fixed');

    await dragTo(page, '.j0n4t-pg-wrap', 260);

    expect(await savedSetting(page, 'heightFixed')).toBe(260);
    // The inline height the drag left behind is handed to the mode's own rules.
    expect(await wrap(page).evaluate((el) => (el as HTMLElement).style.height)).toBe('');
    await expect.poll(() => wrap(page).evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(260);
  });

  test('a height dragged in another mode is not stored', async ({ page }) => {
    await expect(wrap(page)).toHaveAttribute('data-height-mode', 'fit');
    await dragTo(page, '.j0n4t-pg-wrap', 260);
    expect(await savedSetting(page, 'heightFixed')).toBeUndefined();
  });

  test('remembers a dragged panel size across a reload', async ({ page }) => {
    const modal = await openDisplayTab(page);
    await modal.locator('#j0n4t-pg-remember-panels').check();
    await modal.locator('button[data-index="1"]').click();

    await dragTo(page, '.j0n4t-pg-basket-container', 200);
    await expect.poll(() => savedSetting(page, 'panelSizes')).toEqual({ basket: 200 });

    await page.reload();
    await page.waitForFunction(() => {
      const w = window as unknown as { __report?: unknown };
      return w.__report !== undefined;
    });
    await expect
      .poll(() => page.locator('.j0n4t-pg-basket-container').evaluate((el) => (el as HTMLElement).offsetHeight))
      .toBe(200);
  });

  test('does not store a dragged panel size while the option is off', async ({ page }) => {
      await dragTo(page, '.j0n4t-pg-basket-container', 200);
      expect(await savedSetting(page, 'panelSizes')).toBeUndefined();
    });
  });

  test.describe('preset libraries', () => {
    test('every served library is merged until the user switches one off', async ({ page }) => {
      await expect(page.locator('.j0n4t-pg-item')).toHaveCount(ITEMS_MERGED);

      const modal = await openDisplayTab(page);
      const rows = modal.locator('.j0n4t-pg-library-row');
      await expect(rows).toHaveCount(LIBRARIES.length);
      await expect(rows.nth(0)).toHaveAttribute('data-id', 'main');
      // the bundled library is always on and cannot be switched off
      await expect(rows.nth(0).locator("input[data-role='enabled']")).toBeDisabled();
      await expect(rows.nth(1).locator("input[data-role='enabled']")).toBeChecked();

      await rows.nth(1).locator("input[data-role='enabled']").uncheck();
      await expect
        .poll(() => page.locator('.j0n4t-pg-item').count())
        .toBe(ITEMS_MAIN);
      await expect(visibleItems(page)).toHaveCount(ITEMS_MAIN_VISIBLE);
    });

    test('a name two libraries share is listed once per library, each tagged', async ({ page }) => {
      const winner = page.locator('.j0n4t-pg-item[data-style="Faces/Portrait"]');
      const shadowed = page.locator('.j0n4t-pg-item[data-style="sample#Faces/Portrait"]');
      await expect(winner).toHaveCount(1);
      await expect(shadowed).toHaveCount(1);
      // main is first in the list, so it wins the plain key and sample is filed aside
      await expect(winner.locator('.j0n4t-pg-lib-badge')).toHaveText('Main');
      await expect(shadowed.locator('.j0n4t-pg-lib-badge')).toHaveText('Sample');
    });

    test('the first library in the list wins a shared name', async ({ page }) => {
      const modal = await openDisplayTab(page);
      // moving sample up puts it first, so it takes the plain key
      await modal.locator('.j0n4t-pg-library-row[data-id="sample"] button[data-role="up"]').click();
      await expect
        .poll(() => page.locator('.j0n4t-pg-item[data-style="Faces/Portrait"] .j0n4t-pg-lib-badge').textContent())
        .toBe('Sample');
      await expect(page.locator('.j0n4t-pg-item[data-style="main#Faces/Portrait"]')).toHaveCount(1);
    });

    test('a library choice survives a reload', async ({ page }) => {
      const modal = await openDisplayTab(page);
      await modal.locator('.j0n4t-pg-library-row[data-id="sample"] input[data-role="enabled"]').uncheck();
      await expect.poll(() => page.locator('.j0n4t-pg-item').count()).toBe(ITEMS_MAIN);

      await page.reload();
      await page.waitForFunction(() => {
        const w = window as unknown as { __report?: unknown };
        return w.__report !== undefined;
      });
      await expect
        .poll(() => page.locator('.j0n4t-pg-item').count())
        .toBe(ITEMS_MAIN);
    });

    test('turning the chip tag off stores a plain preset name', async ({ page }) => {
      // The harness pre-selects the first preset, so clear it before asserting.
      await page.locator('.j0n4t-pg-item[data-style="Faces/Portrait"]').click();
      expect(await widgetValue(page)).toBe('');

      const modal = await openDisplayTab(page);
      await modal.locator('#j0n4t-pg-qualify-chips').uncheck();
      await modal.locator('button[data-index="1"]').click(); // Save
      await expect(page.locator('.j0n4t-pg-modal-overlay')).toHaveCount(0);

      // with the tag off, the shadowed entry contributes the plain name - the
      // same chip as the winner, which is exactly the ambiguity the tag avoids
      await page.locator('.j0n4t-pg-item[data-style="sample#Faces/Portrait"]').click();
      expect(await widgetValue(page)).toBe('Faces/Portrait');
    });

    test('with the tag on, the shadowed entry keeps its library name', async ({ page }) => {
      await page.locator('.j0n4t-pg-item[data-style="Faces/Portrait"]').click();
      expect(await widgetValue(page)).toBe('');

      await page.locator('.j0n4t-pg-item[data-style="sample#Faces/Portrait"]').click();
      expect(await widgetValue(page)).toBe('sample#Faces/Portrait');
    });
  });
