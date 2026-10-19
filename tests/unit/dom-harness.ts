import { JSDOM } from "jsdom";

// Shared DOM harness for unit tests that drive DOM-building code
// (ExportUtils in Phase 2, the components in Phase 3). jsdom provides real
// innerHTML parsing and querySelector, which hand-rolled mock elements
// cannot. Importing this module installs the globals before the module
// under test is imported (ESM evaluates imports in order).

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
});

const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.CSS = dom.window.CSS;

export function getDocument(): Document {
  return dom.window.document;
}
