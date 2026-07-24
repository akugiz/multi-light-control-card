import assert from "node:assert/strict";

globalThis.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  }
  dispatchEvent() {}
};
globalThis.CustomEvent = class {
  constructor(type, options) { this.type = type; Object.assign(this, options); }
};
const definitions = new Map();
globalThis.customElements = {
  define: (name, value) => definitions.set(name, value),
  get: (name) => definitions.get(name),
};
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({}) };

await import("../multi-light-control-card.js");
const Card = definitions.get("multi-light-control-card");
assert.ok(Card, "card custom element should be registered");

const calls = [];
const card = new Card();
card.setConfig({
  entities: ["light.example_ceiling", "light.example_bedside"],
  colors: [{ name: "Purple", color: "#b55cff", icon: "mdi:creation" }],
});
card.hass = {
  states: {
    "light.example_ceiling": { entity_id: "light.example_ceiling", state: "on", attributes: { brightness: 128 } },
    "light.example_bedside": { entity_id: "light.example_bedside", state: "off", attributes: {} },
  },
  callService: async (...args) => calls.push(args),
};

await card._all("turn_on");
assert.deepEqual(calls.pop(), ["light", "turn_on", {
  entity_id: ["light.example_ceiling", "light.example_bedside"],
}]);
await card._applyColor(0);
assert.deepEqual(calls.pop(), ["light", "turn_on", {
  entity_id: ["light.example_ceiling", "light.example_bedside"],
  rgb_color: [181, 92, 255],
}]);
await card._setBrightness(65);
assert.deepEqual(calls.pop(), ["light", "turn_on", {
  entity_id: ["light.example_ceiling", "light.example_bedside"],
  brightness_pct: 65,
}]);
await card._toggle("light.example_bedside");
assert.deepEqual(calls.pop(), ["light", "turn_on", { entity_id: "light.example_bedside" }]);

let renders = 0;
card._render = () => { renders += 1; };
card._interactionLock = true;
card.hass = { ...card._hass, states: { ...card._hass.states } };
assert.equal(renders, 0, "live updates must not rebuild the card during slider interaction");
assert.equal(card._pendingRender, true);

const Editor = definitions.get("multi-light-control-card-editor");
const editor = new Editor();
let editorRenders = 0;
editor._render = () => { editorRenders += 1; };
editor.hass = { states: { "light.example_ceiling": { state: "off" } } };
editor.hass = { states: { "light.example_ceiling": { state: "on" } } };
assert.equal(editorRenders, 1, "state-only changes must not rebuild the editor");

console.log("Multi-Light Control Card tests passed.");
