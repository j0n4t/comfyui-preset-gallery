import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import AutocompleteManager from "../../web/AutocompleteManager.js";

// AutocompleteManager wires an input to a match popup. The match provider,
// item renderer and selection callback are all injected, so tests exercise
// the real filtering/keyboard/highlight logic with a real input element.

type SelectSpy = { calls: unknown[]; keepOpen: boolean };

function makeManager(
  input: HTMLInputElement,
  onKeyDown?: (e: KeyboardEvent) => boolean,
  onBlur?: () => void
): { manager: AutocompleteManager; spy: SelectSpy } {
  const spy: SelectSpy = { calls: [], keepOpen: false };
  const manager = new AutocompleteManager({
    input,
    getMatches: (query: string) =>
      query ? [{ item: `${query}-1` }, { item: `${query}-2` }] : [],
    renderItem: (item: unknown) => String(item),
    onSelect: (item: unknown) => {
      spy.calls.push(item);
      return spy.keepOpen;
    },
    onKeyDown,
    onBlur,
  });
  return { manager, spy };
}

function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function pressKey(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

function makeInput(): HTMLInputElement {
  const input = document.createElement("input");
  document.body.appendChild(input);
  return input;
}

function rows(manager: AutocompleteManager): HTMLElement[] {
  return Array.from(manager.popupEl?.querySelectorAll(".j0n4t-pg-autocomplete-item") ?? []);
}

test("opens a popup with one row per match and marks the first active", () => {
  const input = makeInput();
  const { manager } = makeManager(input);

  typeInto(input, "ab");

  assert.equal(manager.isOpen, true);
  const items = rows(manager);
  assert.equal(items.length, 2);
  assert.equal(items[0].textContent, "ab-1");
  assert.ok(items[0].classList.contains("active"), "first row is active");
  assert.ok(!items[1].classList.contains("active"));
});

test("closes when the query yields no matches", () => {
  const input = makeInput();
  const { manager } = makeManager(input);

  typeInto(input, "ab");
  assert.equal(manager.isOpen, true);

  typeInto(input, "");
  assert.equal(manager.isOpen, false);
  assert.equal(manager.popupEl, null);
  assert.deepEqual(manager.matches, []);
});

test("ArrowDown and ArrowUp move the active row with wraparound", () => {
  const input = makeInput();
  const { manager } = makeManager(input);
  typeInto(input, "ab");

  pressKey(input, "ArrowDown");
  assert.equal(manager.activeIndex, 1);
  assert.ok(rows(manager)[1].classList.contains("active"));
  assert.ok(!rows(manager)[0].classList.contains("active"));

  pressKey(input, "ArrowDown");
  assert.equal(manager.activeIndex, 0, "wraps to the first row");

  pressKey(input, "ArrowUp");
  assert.equal(manager.activeIndex, 1, "wraps past the top");
});

test("Enter selects the active match and closes the popup", () => {
  const input = makeInput();
  const { manager, spy } = makeManager(input);
  typeInto(input, "ab");

  pressKey(input, "ArrowDown");
  pressKey(input, "Enter");

  assert.deepEqual(spy.calls, ["ab-2"]);
  assert.equal(manager.isOpen, false);
});

test("Escape closes the popup without selecting", () => {
  const input = makeInput();
  const { manager, spy } = makeManager(input);
  typeInto(input, "ab");

  pressKey(input, "Escape");

  assert.equal(manager.isOpen, false);
  assert.deepEqual(spy.calls, []);
});

test("mousedown on a row selects exactly that row", () => {
  const input = makeInput();
  const { manager, spy } = makeManager(input);
  typeInto(input, "ab");

  const second = rows(manager)[1];
  second.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

  assert.deepEqual(spy.calls, ["ab-2"]);
  assert.equal(manager.isOpen, false);
});

test("a custom onKeyDown can intercept the key and close the popup", () => {
  const input = makeInput();
  let seen = "";
  const { manager, spy } = makeManager(input, (e) => {
    seen = e.key;
    return true;
  });
  typeInto(input, "ab");

  pressKey(input, "Enter");

  assert.equal(seen, "Enter");
  assert.equal(manager.isOpen, false, "intercept closes the popup");
  assert.deepEqual(spy.calls, [], "intercepted keys never reach onSelect");
});

test("onSelect returning true keeps the popup open after selection", () => {
  const input = makeInput();
  const { manager, spy } = makeManager(input);
  spy.keepOpen = true;
  typeInto(input, "ab");

  pressKey(input, "Enter");

  assert.deepEqual(spy.calls, ["ab-1"]);
  assert.equal(manager.isOpen, true, "keepOpen defers the close");
});

test("clicking the input closes an open popup", () => {
  const input = makeInput();
  const { manager } = makeManager(input);
  typeInto(input, "ab");
  assert.equal(manager.isOpen, true);

  input.dispatchEvent(new Event("click"));

  assert.equal(manager.isOpen, false);
});

test("blur fires onBlur immediately and closes after the deferred timeout", async () => {
  const input = makeInput();
  let blurred = 0;
  const { manager } = makeManager(input, undefined, () => blurred++);
  typeInto(input, "ab");

  input.dispatchEvent(new Event("blur"));
  assert.equal(blurred, 1);
  assert.equal(manager.isOpen, true, "the 200ms close is deferred");

  for (let i = 0; i < 25 && manager.isOpen; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(manager.isOpen, false, "closes once the timeout fires");
});
