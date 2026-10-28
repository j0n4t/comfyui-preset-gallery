import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import ModalUtils from "../../web/ModalUtils.js";

// ModalUtils builds real overlays on document.body. Every test closes its
// modal so no overlay or keydown listener leaks into the next one.

function overlay(): HTMLDivElement | null {
  return document.querySelector(".j0n4t-pg-modal-overlay");
}

function modalButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".j0n4t-pg-modal-actions button",
    ),
  );
}

function closeViaBackdrop(): void {
  overlay()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

// --- open/close lifecycle ---

test("alert renders an escaped message under a Notice title and closes on OK", async () => {
  const promise = ModalUtils.alert("<b>notice</b>");
  const ov = overlay();
  assert.ok(ov, "overlay is mounted on open");
  assert.equal(ov.querySelector("h3")?.textContent, "Notice");
  assert.ok(
    ov.innerHTML.includes("&lt;b&gt;notice&lt;/b&gt;"),
    "message is HTML-escaped",
  );

  ov.querySelector<HTMLButtonElement>('button[data-default="true"]')?.click();
  await promise;
  assert.equal(overlay(), null, "overlay is removed after OK");
});

test("confirm resolves true on Confirm and false on Cancel", async () => {
  const yes = ModalUtils.confirm("sure?");
  assert.equal(modalButtons().length, 2);
  modalButtons()[1].click();
  assert.equal(await yes, true);
  assert.equal(overlay(), null);

  const no = ModalUtils.confirm("sure?");
  modalButtons()[0].click();
  assert.equal(await no, false);
  assert.equal(overlay(), null);
});

test("prompt resolves the typed value on OK and null on Cancel", async () => {
  const okPromise = ModalUtils.prompt("Name", "abc");
  const ov = overlay();
  assert.ok(ov, "overlay is mounted");
  const input = ov.querySelector<HTMLInputElement>(".j0n4t-pg-modal-input");
  assert.ok(input, "prompt renders an input");
  assert.equal(input.value, "abc", "default value is applied");
  assert.ok(
    ov
      .querySelector(".j0n4t-pg-modal")
      ?.className.includes("j0n4t-pg-modal-expand"),
  );

  input.value = "typed";
  modalButtons()[1].click();
  assert.equal(await okPromise, "typed");
  assert.equal(overlay(), null);

  const cancelPromise = ModalUtils.prompt("Name");
  modalButtons()[0].click();
  assert.equal(await cancelPromise, null);
  assert.equal(overlay(), null);
});

test("show without buttons renders a single OK that resolves true", async () => {
  const promise = ModalUtils.show({ title: "Info", content: "<i>raw</i>" });
  const btns = modalButtons();
  assert.equal(btns.length, 1);
  assert.equal(btns[0].textContent, "OK");
  assert.ok(
    overlay()?.innerHTML.includes("<i>raw</i>"),
    "content HTML is injected as-is",
  );
  btns[0].click();
  assert.equal(await promise, true);
  assert.equal(overlay(), null);
});

// --- keyboard handling ---

test("Escape resolves the cancel result and closes the modal", async () => {
  const promise = ModalUtils.confirm("sure?");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(await promise, false);
  assert.equal(overlay(), null);
});

test("Escape without a cancel button resolves null", async () => {
  const promise = ModalUtils.alert("hi");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(await promise, null);
  assert.equal(overlay(), null);
});

test("Enter activates the default button", async () => {
  const promise = ModalUtils.confirm("sure?");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  assert.equal(await promise, true);
  assert.equal(overlay(), null);
});

// --- backdrop click and focus restore ---

test("clicking the backdrop closes the modal and resolves null", async () => {
  const promise = ModalUtils.show({ title: "T", content: "c" });
  closeViaBackdrop();
  assert.equal(await promise, null);
  assert.equal(overlay(), null);
});

test("focus returns to the previously focused element on close", async () => {
  const btn = document.createElement("button");
  document.body.appendChild(btn);
  btn.focus();

  const promise = ModalUtils.show({ title: "T", content: "c" });
  // wait for the deferred rAF focus to land on the modal's default button —
  // that is the situation cleanup has to undo (polled: rAF timing varies
  // under suite load)
  for (let i = 0; i < 50; i++) {
    if (document.activeElement && document.activeElement !== btn) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.notEqual(
    document.activeElement,
    btn,
    "the modal took focus while open",
  );
  assert.ok(
    overlay()?.contains(document.activeElement as Node),
    "focus is inside the modal while it is open",
  );

  closeViaBackdrop();
  assert.equal(await promise, null);
  assert.equal(document.activeElement, btn, "focus is restored in cleanup");
  btn.remove();
});

// --- style injection ---

test("injectStyles dedups the modal stylesheet across multiple shows", async () => {
  const first = ModalUtils.show({ title: "One", content: "1" });
  closeViaBackdrop();
  await first;

  const second = ModalUtils.show({ title: "Two", content: "2" });
  closeViaBackdrop();
  await second;

  assert.equal(
    document.querySelectorAll("style#j0n4t-pg-modal-styles").length,
    1,
  );
});
