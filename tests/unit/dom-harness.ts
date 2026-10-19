import { JSDOM } from "jsdom";

// Shared DOM harness for unit tests that drive DOM-building code
// (ExportUtils in Phase 2, the components in Phase 3). jsdom provides real
// innerHTML parsing and querySelector, which hand-rolled mock elements
// cannot. Importing this module installs the globals before the module
// under test is imported (ESM evaluates imports in order).

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.CSS = dom.window.CSS;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.Event = dom.window.Event;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.HTMLDivElement = dom.window.HTMLDivElement;
g.HTMLButtonElement = dom.window.HTMLButtonElement;
g.HTMLSelectElement = dom.window.HTMLSelectElement;
g.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);

// jsdom 30 does not implement checkVisibility, which the popup managers call
// when picking the initial focus target and arrow-key items. Report every
// element as visible so those paths run deterministically.
dom.window.HTMLElement.prototype.checkVisibility = function checkVisibility() {
  return true;
};

export function getDocument(): Document {
  return dom.window.document;
}
