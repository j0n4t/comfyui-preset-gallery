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
  'Scenery/Hills': { preset: 'rolling hills' },
  'Scenery/Sky': { preset: 'dramatic sky' },
  '_/combo/_default': { preset: 'masterpiece' },
};

const ITEMS_TOTAL = 5;
const ITEMS_VISIBLE = 4; // the underscore-prefixed combo default is hidden

let library: Library = {};
let posts: Library[] = [];

const wrap = (page: Page) => page.locator('.j0n4t-pg-wrap');
const chips = (page: Page) => page.locator('.j0n4t-pg-basket-chip');
const visibleItems = (page: Page) => page.locator('.j0n4t-pg-item:not(.j0n4t-pg-hidden)');
const widgetValue = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gallery: { widget: { value: string } } })
    .__gallery.widget.value);

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

test.beforeEach(async ({ page }) => {
  library = structuredClone(FIXTURE);
  posts = [];

  // One route for both verbs, so a save round-trips like the real API does.
  await page.route('**/preset_gallery/presets', async (route) => {
    if (route.request().method() === 'POST') {
      library = JSON.parse(route.request().postData() ?? '{}');
      posts.push(library);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(library),
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

  test('renders the library served by the API', { tag: '@smoke' }, async ({ page }) => {
    await expect(page.locator('.j0n4t-pg-item')).toHaveCount(ITEMS_TOTAL);
    await expect(visibleItems(page)).toHaveCount(ITEMS_VISIBLE);
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
    await page.locator('.j0n4t-pg-search').fill('scenery');
    await expect(visibleItems(page)).toHaveCount(2);
  });

  test('clearing restores the whole grid', { tag: '@smoke' }, async ({ page }) => {
    await page.locator('.j0n4t-pg-search').fill('scenery');
    await expect(visibleItems(page)).toHaveCount(2);
    await page.locator('.j0n4t-pg-search-clear').click();
    await expect(visibleItems(page)).toHaveCount(ITEMS_VISIBLE);
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

  test('raw mode adds chips from typed text', { tag: '@smoke' }, async ({ page }) => {
    await page.locator('#j0n4t-pg-basket-raw-toggle').click();
    const raw = page.locator('#j0n4t-pg-raw-input');
    await raw.fill('Faces/Portrait, Scenery/Hills');
    await raw.press('Enter');
    await expect(chips(page)).toHaveCount(2);
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
  // The gallery caps its own viewport so the grid scrolls inside it instead of
  // growing the node / app panel to the full height of the library. Unit tests
  // cover the persisted setting and the attribute; only a real browser can show
  // that the CSS actually clamps a laid-out element.
  async function openDisplayTab(page: Page) {
    await page.locator('#j0n4t-pg-config-btn').click();
    const modal = page.locator('.j0n4t-pg-modal-overlay');
    await expect(modal).toBeVisible();
    await modal.locator('.j0n4t-pg-tab-btn[data-tab="display"]').click();
    return modal;
  }

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
