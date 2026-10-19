import { test, expect, type Page } from '@playwright/test';

// The other half of the split: the harness covers what the UI does, this covers
// that the extension actually loads and mounts inside a real ComfyUI. It talks
// to the live server on :8188 and skips itself when that is not running, so it
// is safe to leave in a suite that mostly runs without ComfyUI.
//
// Deliberately few and stable assertions - breadth belongs in gallery.spec.ts.

const COMFY_URL = 'http://127.0.0.1:8188';
const NODE_TYPE = 'PresetGalleryNode';

test.beforeAll(async ({ request }) => {
  let reachable = false;
  try {
    const res = await request.get(`${COMFY_URL}/object_info/${NODE_TYPE}`, { timeout: 4000 });
    reachable = res.ok();
  } catch {
    reachable = false;
  }
  test.skip(!reachable, `ComfyUI is not running on ${COMFY_URL}`);
});

/**
 * Waits for the frontend to be genuinely ready: the app object alone appears
 * early, but the node type only exists once ComfyUI has fetched object_info.
 */
async function waitForComfy(page: Page) {
  await page.goto(COMFY_URL);
  await page.waitForFunction(
    (type) => {
      const w = window as unknown as {
        comfyAPI?: { app?: { app?: { graph?: unknown } } };
        LiteGraph?: { registered_node_types?: Record<string, unknown> };
      };
      return (
        !!w.comfyAPI?.app?.app?.graph &&
        !!w.LiteGraph?.registered_node_types?.[type]
      );
    },
    NODE_TYPE,
    { timeout: 30_000 }
  );
}

test('registers the extension with the frontend', async ({ page }) => {
  await waitForComfy(page);

  const names = await page.evaluate(() => {
    const w = window as unknown as {
      comfyAPI: { app: { app: { extensions: Array<{ name?: string }> } } };
    };
    return w.comfyAPI.app.app.extensions.map((e) => e.name).filter(Boolean);
  });

  expect(names).toContain('Comfy.PresetGallery');
});

test('mounts the gallery when the node is created', async ({ page }) => {
  await waitForComfy(page);

  const mount = await page.evaluate((type) => {
    const w = window as unknown as {
      LiteGraph: { createNode: (t: string) => unknown };
      comfyAPI: { app: { app: { graph: { add: (n: unknown) => void } } } };
    };
    const node = w.LiteGraph.createNode(type) as {
      widgets: Array<{ name: string; element?: HTMLElement; el?: HTMLElement }>;
    };
    w.comfyAPI.app.app.graph.add(node);
    // Hold the created node: the graph may already contain a gallery node from
    // a restored workflow, so searching by type could pick up the wrong one.
    (window as unknown as { __pgTestNode?: unknown }).__pgTestNode = node;

    const domWidget = node.widgets.find((x) => x.name === 'preset_gallery_ui');
    const el = domWidget?.element ?? domWidget?.el;
    return {
      hasDomWidget: !!domWidget,
      hasGrid: !!el?.querySelector('.j0n4t-pg-grid'),
      hasSearch: !!el?.querySelector('.j0n4t-pg-search'),
      hasBasket: !!el?.querySelector('.j0n4t-pg-basket-container'),
      items: el?.querySelectorAll('.j0n4t-pg-item').length ?? 0,
    };
  }, NODE_TYPE);

  // Asserted on the registered DOM widget rather than on the document: ComfyUI
  // only attaches it once it draws the node, and where the graph places a
  // programmatically added node is incidental to what is being tested here.
  expect(mount.hasDomWidget).toBe(true);
  expect(mount.hasGrid).toBe(true);
  expect(mount.hasSearch).toBe(true);
  expect(mount.hasBasket).toBe(true);

  // The library arrives asynchronously, so poll for the rendered items.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const node = (window as unknown as {
            __pgTestNode?: { widgets: Array<{ name: string; element?: HTMLElement; el?: HTMLElement }> };
          }).__pgTestNode;
          const domWidget = node?.widgets.find((x) => x.name === 'preset_gallery_ui');
          const el = domWidget?.element ?? domWidget?.el;
          return el?.querySelectorAll('.j0n4t-pg-item').length ?? 0;
        }),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0);
});

test('hides the widgets the UI drives', async ({ page }) => {
  await waitForComfy(page);

  const hidden = await page.evaluate((type) => {
    const w = window as unknown as {
      LiteGraph: { createNode: (t: string) => unknown };
      comfyAPI: { app: { app: { graph: { add: (n: unknown) => void } } } };
    };
    const node = w.LiteGraph.createNode(type) as {
      widgets: Array<{ name: string; hidden?: boolean }>;
    };
    w.comfyAPI.app.app.graph.add(node);
    const named = node.widgets.filter((x) =>
      ['preset_selection', 'evaluated_preset'].includes(x.name)
    );
    return { count: named.length, allHidden: named.every((x) => x.hidden === true) };
  }, NODE_TYPE);

  expect(hidden.count).toBe(2);
  expect(hidden.allHidden).toBe(true);
});

test('the backend exposes the node with its declared sockets', async ({ request }) => {
  const res = await request.get(`${COMFY_URL}/object_info/${NODE_TYPE}`);
  expect(res.ok()).toBe(true);

  const info = (await res.json())[NODE_TYPE];
  expect(info.input.required.preset_selection).toBeTruthy();
  expect(info.input.optional.base_preset[1].forceInput).toBe(true);
  expect(info.output_name).toContain('final_preset');
  expect(info.category).toBe('utils');
});
