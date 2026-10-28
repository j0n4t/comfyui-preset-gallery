import { test } from "node:test";
import assert from "node:assert/strict";
import YAMLUtils from "../../web/YAMLUtils.js";

test("stringify produces valid YAML for tabs export data", () => {
  const data = {
    version: 1,
    tabs: [
      {
        title: "Basket 1",
        basket: ["preset1", "preset2"],
        pins: [],
        rolls: {},
      },
      {
        title: "Basket 2",
        basket: ["preset3"],
        pins: ["preset3"],
        rolls: {
          group1: [
            { offset: 0, value: "a" },
            { offset: 1, value: "b" },
          ],
        },
      },
    ],
  };

  const yaml = YAMLUtils.stringify(data);

  assert.ok(yaml.includes("version: 1"));
  assert.ok(yaml.includes("tabs:"));
  assert.ok(yaml.includes("title: Basket 1"));
  assert.ok(yaml.includes("- preset1"));
  assert.ok(yaml.includes("- preset2"));
  assert.ok(yaml.includes("title: Basket 2"));
  assert.ok(yaml.includes("- preset3"));
});

test("parse roundtrips a simple object", () => {
  const yaml = "name: test\nvalue: 42\n";
  const parsed = YAMLUtils.parse(yaml);

  assert.equal(parsed.name, "test");
  assert.equal(parsed.value, 42);
});

test("parse roundtrips an array of objects", () => {
  const yaml = "items:\n  - name: a\n    value: 1\n  - name: b\n    value: 2\n";
  const parsed = YAMLUtils.parse(yaml);

  assert.ok(Array.isArray(parsed.items));
  assert.equal(parsed.items.length, 2);
  assert.deepEqual(parsed.items[0], { name: "a", value: 1 });
  assert.deepEqual(parsed.items[1], { name: "b", value: 2 });
});

test("parse roundtrips nested arrays of objects", () => {
  const yaml =
    "rolls:\n  group1:\n    - offset: 0\n      value: a\n    - offset: 1\n      value: b\n";
  const parsed = YAMLUtils.parse(yaml);

  assert.ok(Array.isArray(parsed.rolls.group1));
  assert.equal(parsed.rolls.group1.length, 2);
  assert.deepEqual(parsed.rolls.group1[0], { offset: 0, value: "a" });
  assert.deepEqual(parsed.rolls.group1[1], { offset: 1, value: "b" });
});

test("full roundtrip: stringify -> parse returns original data", () => {
  const data = {
    version: 1,
    tabs: [
      {
        title: "Basket 1",
        basket: ["preset1", "preset2"],
        pins: [],
        rolls: {},
      },
      {
        title: "Basket 2",
        basket: ["preset3"],
        pins: ["preset3"],
        rolls: {
          group1: [
            { offset: 0, value: "a" },
            { offset: 1, value: "b" },
          ],
        },
      },
    ],
  };

  const yaml = YAMLUtils.stringify(data);
  const parsed = YAMLUtils.parse(yaml);

  assert.deepEqual(parsed, data);
});

test("parse handles empty object value (rolls: {})", () => {
  const yaml = "title: MyTab\nbasket:\n  - preset1\nrolls:\n";
  const parsed = YAMLUtils.parse(yaml);

  assert.equal(parsed.title, "MyTab");
  assert.ok(Array.isArray(parsed.basket));
  assert.deepEqual(parsed.basket, ["preset1"]);
  assert.deepEqual(parsed.rolls, {});
});

test("stringify exports basket and pins as comma-separated strings", () => {
  const data = {
    version: 1,
    tabs: [
      { title: "Basket 1", basket: "preset1, preset2", pins: "", rolls: {} },
      {
        title: "Basket 2",
        basket: "preset3",
        pins: "preset3",
        rolls: { group1: [{ offset: 0, value: "a" }] },
      },
    ],
  };

  const yaml = YAMLUtils.stringify(data);

  assert.ok(yaml.includes("basket: preset1, preset2"));
  assert.ok(yaml.includes("basket: preset3"));
  assert.ok(yaml.includes("pins: preset3"));
});

test("parse roundtrips comma-separated basket/pins strings", () => {
  const yaml =
    'version: 1\ntabs:\n  - title: Basket 1\n    basket: preset1, preset2\n    pins: ""\n    rolls: {}\n  - title: Basket 2\n    basket: preset3\n    pins: preset3\n    rolls:\n      group1:\n        - offset: 0\n          value: a\n';
  const parsed = YAMLUtils.parse(yaml);

  assert.equal(parsed.version, 1);
  assert.ok(Array.isArray(parsed.tabs));
  assert.equal(parsed.tabs.length, 2);
  assert.equal(parsed.tabs[0].title, "Basket 1");
  assert.equal(parsed.tabs[0].basket, "preset1, preset2");
  assert.equal(parsed.tabs[0].pins, "");
  assert.deepEqual(parsed.tabs[0].rolls, {});
  assert.equal(parsed.tabs[1].title, "Basket 2");
  assert.equal(parsed.tabs[1].basket, "preset3");
  assert.equal(parsed.tabs[1].pins, "preset3");
  assert.ok(Array.isArray(parsed.tabs[1].rolls.group1));
  assert.equal(parsed.tabs[1].rolls.group1[0].offset, 0);
  assert.equal(parsed.tabs[1].rolls.group1[0].value, "a");
});

test("full roundtrip with string basket/pins format", () => {
  const data = {
    version: 1,
    tabs: [
      { title: "Basket 1", basket: "preset1, preset2", pins: "", rolls: {} },
      {
        title: "Basket 2",
        basket: "preset3",
        pins: "preset3",
        rolls: {
          group1: [
            { offset: 0, value: "a" },
            { offset: 1, value: "b" },
          ],
        },
      },
    ],
  };

  const yaml = YAMLUtils.stringify(data);
  const parsed = YAMLUtils.parse(yaml);

  assert.deepEqual(parsed, data);
});

test("parse handles legacy array basket/pins format", () => {
  const yaml =
    "version: 1\ntabs:\n  - title: Basket 1\n    basket:\n      - preset1\n      - preset2\n    pins: []\n    rolls: {}\n  - title: Basket 2\n    basket:\n      - preset3\n    pins:\n      - preset3\n    rolls:\n      group1:\n        - offset: 0\n          value: a\n";
  const parsed = YAMLUtils.parse(yaml);

  assert.ok(Array.isArray(parsed.tabs[0].basket));
  assert.deepEqual(parsed.tabs[0].basket, ["preset1", "preset2"]);
  assert.ok(Array.isArray(parsed.tabs[0].pins));
  assert.deepEqual(parsed.tabs[0].pins, []);
  assert.ok(Array.isArray(parsed.tabs[1].pins));
  assert.deepEqual(parsed.tabs[1].pins, ["preset3"]);
});
