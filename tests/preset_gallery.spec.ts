import { test, expect } from '@playwright/test';

// MOCK DATA: Simulating the backend response structure for the preset gallery
const mockGalleryData = {
    presets: [
        { id: 'p1', name: 'Portrait', folder: 'Faces', keywords: 'pro' },
        { id: 'p2', name: 'Landscape', folder: 'Scenery', keywords: 'nature' },
        { id: 'p3', name: 'Macro', folder: 'Faces', keywords: 'close-up' }
    ],
    folders: ['Faces', 'Scenery']
};

test.describe('Preset Gallery Extension - Full Suite', () => {

    test.beforeEach(async ({ page }) => {
        // Intercept backend API requests to provide consistent test data
        await page.route('**/custom_node/live_preset_gallery', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockGalleryData),
            });
        });

        await page.goto('http://127.0.0.1:8188');
        await page.waitForSelector('#graph-canvas');
        await page.locator('.comfy-menu-button-wrapper').click();
        await page.goto('http://127.0.0.1:8188/');
        await page.locator('.comfy-menu-button-wrapper').click();
        await page.getByRole('menuitem', { name: 'New' }).locator('a').click();

        await page.locator('#graph-canvas').press('Alt+-');
        await page.locator('#graph-canvas').press('Alt+-');
        await page.locator('#graph-canvas').press('Alt+-');
        await page.locator('#graph-canvas').press('Alt+-');
        await page.locator('#graph-canvas').press('Alt+-');

        await page.locator('#graph-canvas').click({
          button: 'right',
          position: {
            x: 100,
            y: 100
          }
        });
        await page.getByRole('menuitem', { name: 'Add Node >' }).click();
        await page.getByRole('menuitem', { name: 'utils >' }).click();
        await page.getByRole('menuitem', { name: 'Preset Gallery' }).click();
        await page.locator('#graph-canvas').click({
          position: {
            x: 100,
            y: 100
          }
        });
    });

    test('should inject the gallery component into the DOM', async ({ page }) => {
        // We verify the container wrapper exists
        const galleryWrap = page.locator('.j0n4t-pg-wrap');
        await expect(galleryWrap).toBeVisible();
    });

    test('should toggle the management panel', async ({ page }) => {
        const toggleBtn = page.locator('#j0n4t-pg-toggle');
        const editorPanel = page.locator('.j0n4t-pg-editor');

        await toggleBtn.click();
        await expect(editorPanel).toHaveClass(/collapsed/);

        await toggleBtn.click();
        await expect(editorPanel).not.toHaveClass(/collapsed/);
    });

    test('should filter grid items based on search input', async ({ page }) => {
        const searchInput = page.locator('.j0n4t-pg-search');

        // Type something that doesn't exist to ensure items are hidden
        await searchInput.fill('nonexistent_preset_xyz_123');

        // Check that items are hidden (or the grid is empty message appears)
        const items = page.locator('.j0n4t-pg-item');
        await expect(items.first()).not.toBeVisible();
    });

    test.describe('Grid & Data Management', () => {
        // G-01: Filtering presets by search string
        test('Filtering should hide non-matching items', async ({ page }) => {
            const searchInput = page.locator('.j0n4t-pg-search');
            await searchInput.fill('Landscape');
            const items = page.locator('.j0n4t-pg-item');
            await expect(items.filter({ hasText: 'Landscape' })).toBeVisible();
            await expect(items.filter({ hasText: 'Portrait' })).not.toBeVisible();
        });

        // G-02: Clearing the search input
        test('Clearing search should restore grid visibility', async ({ page }) => {
            await page.locator('.j0n4t-pg-search').fill('Portrait');
            await page.locator('.j0n4t-pg-search-clear').click();
            await expect(page.locator('.j0n4t-pg-item')).toHaveCount(3);
        });

        // G-03: Grouping/Toggle functional requirement
        test('Grouping checkbox should toggle folder display', async ({ page }) => {
            await page.locator('.j0n4t-pg-group-toggle').click();
            await expect(page.locator('.j0n4t-pg-folder-header')).toBeVisible();
        });

        // G-04: Folder collapse/expand interaction
        test('Collapse all should hide folder content', async ({ page }) => {
            await page.locator('.j0n4t-pg-group-toggle').click();
            await page.locator('.j0n4t-pg-collapse-all').click();
            await expect(page.locator('.j0n4t-pg-folder-content')).not.toBeVisible();
        });

        // G-05: View mode switching consistency
        test('View mode switching should update CSS classes', async ({ page }) => {
            const grid = page.locator('.j0n4t-pg-grid');
            await page.locator('.j0n4t-pg-view-list').click();
            await expect(grid).toHaveClass(/j0n4t-pg-view-list/);
        });
    });

    test.describe('Basket & Selection Logic', () => {
        // B-01: Addition via direct interaction
        test('Clicking a preset should add it to the basket', async ({ page }) => {
            await page.locator('.j0n4t-pg-item').first().click();
            await expect(page.locator('.j0n4t-pg-basket-chip')).toBeVisible();
        });

        // B-02: Drag and drop simulation
        test('Drag and drop should move item to basket', async ({ page }) => {
            const source = page.locator('.j0n4t-pg-item').first();
            const target = page.locator('.j0n4t-pg-basket-drop-zone');
            await source.dragTo(target);
            await expect(page.locator('.j0n4t-pg-basket-chip')).toHaveCount(1);
        });

        // B-04: Raw Input mode functionality
        test('Raw input mode should allow manual string entry', async ({ page }) => {
            await page.locator('.j0n4t-pg-raw-toggle').click();
            const input = page.locator('.j0n4t-pg-raw-input');
            await input.fill('Portrait,Macro');
            await page.keyboard.press('Enter');
            await expect(page.locator('.j0n4t-pg-basket-chip')).toHaveCount(2);
        });
    });

    test.describe('Preset Editor & CRUD', () => {
        // E-01: New preset creation flow
        test('Creating a new preset should update the grid', async ({ page }) => {
            await page.locator('.j0n4t-pg-panel-toggle').click();
            await page.locator('.j0n4t-pg-editor-name').fill('NewTestPreset');
            await page.locator('.j0n4t-pg-editor-save').click();
            await expect(page.locator('.j0n4t-pg-item').filter({ hasText: 'NewTestPreset' })).toBeVisible();
        });

        // E-03: Deletion flow
        test('Deleting a preset should remove it from the UI', async ({ page }) => {
            const item = page.locator('.j0n4t-pg-item').first();
            await item.locator('.j0n4t-pg-edit-btn').click();
            await page.locator('.j0n4t-pg-delete-btn').click();
            // Assuming a confirmation dialog or instant removal
            await expect(item).not.toBeVisible();
        });

        // E-04: Autocomplete functionality
        test('Folder autocomplete should show existing folders', async ({ page }) => {
            await page.locator('.j0n4t-pg-panel-toggle').click();
            await page.locator('.j0n4t-pg-editor-folder').type('Fa'); // Trigger match for 'Faces'
            await expect(page.locator('.j0n4t-pg-autocomplete-dropdown')).toContainText('Faces');
        });
    });

    test.describe('Integration & Persistence', () => {
        // LocalStorage verification
        test('UI state should persist after reload', async ({ page }) => {
            await page.locator('.j0n4t-pg-view-list').click();
            await page.reload();
            const grid = page.locator('.j0n4t-pg-grid');
            await expect(grid).toHaveClass(/j0n4t-pg-view-list/);
        });

        // Widget Synchronization
        // test('Basket should react to external widget value changes', async ({ page }) => {
        //     // Simulate external update via ComfyUI graph event
        //     await page.evaluate(() => {
        //         const widget = window.app.graph._nodes.find(n => n.type === 'PresetGalleryNode').widgets[0];
        //         widget.value = 'Portrait';
        //         widget.callback();
        //     });
        //     await expect(page.locator('.j0n4t-pg-basket-chip')).toBeVisible();
        // });
    });
});
   