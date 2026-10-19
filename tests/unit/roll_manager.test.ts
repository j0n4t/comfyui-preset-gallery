import { test } from "node:test";
import assert from "node:assert/strict";
import RollManager from "../../web/RollManager.js";

// RollManager is the per-group pick tracker behind the dice algorithm
// (PresetSession.buildRollSelection -> triggerRoll). Every pick is indexed
// `${group}_${count}`, so counts control which slot is read next.

test("constructor copies the initial rolls and starts with empty counts", () => {
  const initial = { faces_0: "Faces/Portrait" };
  const manager = new RollManager(initial);
  assert.deepEqual(manager.rolls, { faces_0: "Faces/Portrait" });
  assert.deepEqual(manager.counts, {});
  // mutating the source object afterwards must not affect the manager
  initial.faces_0 = "Faces/Other";
  assert.equal(manager.rolls.faces_0, "Faces/Portrait");
});

test("getCount is 0 for a group that was never rolled", () => {
  assert.equal(new RollManager().getCount("faces"), 0);
});

test("getRoll advances the per-group count and returns undefined with no matches", () => {
  const manager = new RollManager();
  assert.equal(manager.getRoll("faces"), undefined);
  assert.equal(manager.getCount("faces"), 1);
  assert.equal(manager.getRoll("faces"), undefined);
  assert.equal(manager.getCount("faces"), 2);
});

test("getRoll returns the stored pick for a slot that was already rolled", () => {
  const manager = new RollManager();
  const first = manager.getRoll("faces", ["Faces/Portrait", "Faces/Macro"]);
  assert.ok(["Faces/Portrait", "Faces/Macro"].includes(first));
  assert.equal(manager.getCount("faces"), 1);
  // rewinding to slot 0 returns the stored pick without re-rolling
  manager.resetCounts();
  assert.equal(manager.getRoll("faces", ["Faces/Portrait", "Faces/Macro"]), first);
  assert.equal(manager.getCount("faces"), 1);
});

test("getRoll re-picks when the stored roll is no longer in the matches", () => {
  const manager = new RollManager({ faces_0: "Faces/Gone" });
  const picked = manager.getRoll("faces", ["Faces/Portrait", "Faces/Macro"]);
  assert.ok(["Faces/Portrait", "Faces/Macro"].includes(picked));
});

test("peekRoll reads a stored slot without advancing the count", () => {
  const manager = new RollManager({ faces_0: "Faces/Portrait", faces_1: "Faces/Macro" });
  assert.equal(manager.peekRoll("faces", 0), "Faces/Portrait");
  assert.equal(manager.peekRoll("faces", 1), "Faces/Macro");
  assert.equal(manager.getCount("faces"), 0);
  assert.equal(manager.peekRoll("faces", 9), undefined);
});

test("deleteRoll removes the roll but keeps the count so the slot is reused", () => {
  const manager = new RollManager();
  manager.getRoll("faces", ["Faces/Portrait"]);
  manager.deleteRoll("faces", 0);
  assert.equal(manager.peekRoll("faces", 0), undefined);
  // count was already advanced, so the next getRoll uses slot 1
  manager.getRoll("faces", ["Faces/Macro"]);
  assert.equal(manager.peekRoll("faces", 1), "Faces/Macro");
  assert.equal(manager.getCount("faces"), 2);
});

test("cloneCounts returns a copy that can be mutated freely", () => {
  const manager = new RollManager();
  manager.getRoll("faces", ["Faces/Portrait"]);
  manager.getRoll("scenery", ["Scenery/Hills"]);
  const snapshot = manager.cloneCounts();
  assert.deepEqual(snapshot, { faces: 1, scenery: 1 });
  snapshot.faces = 99;
  assert.equal(manager.getCount("faces"), 1);
});

test("restoreCounts adopts the supplied counts", () => {
  const manager = new RollManager();
  const result = manager.restoreCounts({ faces: 3 });
  assert.equal(result, manager, "restoreCounts returns this for chaining");
  assert.equal(manager.getCount("faces"), 3);
  assert.equal(manager.getCount("scenery"), 0);
});

test("resetCounts clears counts but keeps the stored rolls", () => {
  const manager = new RollManager({ faces_0: "Faces/Portrait" });
  manager.getRoll("faces", ["Faces/Portrait"]);
  const result = manager.resetCounts();
  assert.equal(result, manager, "resetCounts returns this for chaining");
  assert.equal(manager.getCount("faces"), 0);
  assert.equal(manager.peekRoll("faces", 0), "Faces/Portrait");
});

test("clearAll clears rolls and counts", () => {
  const manager = new RollManager({ faces_0: "Faces/Portrait" });
  manager.getRoll("faces", ["Faces/Portrait"]);
  const result = manager.clearAll();
  assert.equal(result, manager, "clearAll returns this for chaining");
  assert.deepEqual(manager.rolls, {});
  assert.deepEqual(manager.counts, {});
  assert.equal(manager.peekRoll("faces", 0), undefined);
});
