/**
 * Multi-Light Control Card for Home Assistant
 * Version 1.0.0
 */
const CARD_VERSION = "1.0.0";
const DEFAULT_COLORS = Object.freeze([
  { name: "Warm", color: "#ffb46b", icon: "mdi:weather-sunset" },
  { name: "White", color: "#ffffff", icon: "mdi:lightbulb-on" },
  { name: "Blue", color: "#4d8dff", icon: "mdi:water" },
  { name: "Purple", color: "#b55cff", icon: "mdi:creation" },
]);
const DEFAULTS = Object.freeze({
  title: "Lights",
  entities: [],
  colors: DEFAULT_COLORS,
  show_individual: true,
  show_brightness: true,
});

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const normalizeEntities = (value) => {
  const source = Array.isArray(value) ? value : String(value || "").split(/[\n,]/);
  return [...new Set(source.map((item) => String(item).trim()).filter((item) => item.startsWith("light.")))];
};
const hexToRgb = (hex) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [255, 255, 255];
};
const contrastColor = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return ((r * 299 + g * 587 + b * 114) / 1000) > 155 ? "#111111" : "#ffffff";
};

class MultiLightControlCard extends HTMLElement {
  static getConfigElement() { return document.createElement("multi-light-control-card-editor"); }
  static getStubConfig() { return { entities: [] }; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULTS, colors: DEFAULT_COLORS.map((item) => ({ ...item })) };
    this._hass = undefined;
    this._interactionLock = false;
    this._pendingRender = false;
    this._interactionTimer = undefined;
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration is required.");
    this._config = {
      ...DEFAULTS,
      ...config,
      entities: normalizeEntities(config.entities),
      colors: Array.isArray(config.colors) ? config.colors : DEFAULT_COLORS.map((item) => ({ ...item })),
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._interactionLock) {
      this._pendingRender = true;
      return;
    }
    this._render();
  }

  getCardSize() { return Math.max(3, this._config.entities.length + 3); }

  _states() {
    return this._config.entities.map((entityId) => this._hass?.states?.[entityId])
      .filter(Boolean);
  }

  _friendlyName(state) {
    return state?.attributes?.friendly_name || state?.entity_id?.split(".")[1]?.replaceAll("_", " ") || "Light";
  }

  _render() {
    if (!this.shadowRoot) return;
    const states = this._states();
    const onStates = states.filter((state) => state.state === "on");
    const available = states.filter((state) => !["unavailable", "unknown"].includes(state.state));
    const averageBrightness = onStates.length
      ? Math.round(onStates.reduce((sum, state) => sum + Number(state.attributes?.brightness || 255), 0) / onStates.length / 2.55)
      : 100;
    const missing = this._config.entities.filter((entityId) => !this._hass?.states?.[entityId]);
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}.card{padding:18px;border-radius:var(--ha-card-border-radius,16px);
        background:var(--ha-card-background,var(--card-background-color,#1c1b2b));color:var(--primary-text-color);
        box-shadow:var(--ha-card-box-shadow)}button,input{font:inherit;color:inherit}
        .head{display:flex;align-items:center;gap:13px}.icon{width:50px;height:50px;border-radius:16px;display:grid;
        place-items:center;background:${onStates.length ? "#67521d" : "var(--secondary-background-color)"};
        color:${onStates.length ? "#ffd867" : "var(--secondary-text-color)"}}.icon ha-icon{--mdc-icon-size:28px}
        .title{min-width:0;flex:1}.title h2{font-size:22px;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .status{font-size:13px;color:var(--secondary-text-color)}.actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}
        .action{border:0;border-radius:13px;padding:13px;background:var(--secondary-background-color);cursor:pointer}
        .action.on{background:color-mix(in srgb,#ffd867 34%,var(--secondary-background-color))}
        .action ha-icon{vertical-align:middle;margin-right:6px}.section{border-top:1px solid var(--divider-color);margin-top:17px;padding-top:16px}
        .section h3{font-size:15px;margin:0 0 11px}.colors{display:grid;grid-template-columns:repeat(auto-fit,minmax(76px,1fr));gap:9px}
        .color{position:relative;min-height:76px;border:0;border-radius:14px;padding:11px 7px;background:var(--secondary-background-color);cursor:pointer}
        .swatch{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;margin:0 auto 7px;border:2px solid rgba(255,255,255,.55);
        box-shadow:0 0 13px var(--preset-color)}.color span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
        .swatch ha-icon{--mdc-icon-size:18px}
        .brightness{display:flex;align-items:center;gap:12px}.brightness input{flex:1;accent-color:var(--primary-color)}
        .lights{display:grid;gap:8px}.light{display:flex;align-items:center;gap:12px;padding:11px;border-radius:13px;
        background:var(--secondary-background-color)}.light ha-icon{color:var(--light-color,var(--secondary-text-color))}
        .light .name{flex:1;min-width:0}.name strong,.name small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .name small{color:var(--secondary-text-color);margin-top:2px}.toggle{width:46px;height:26px;border:0;border-radius:20px;
        background:var(--disabled-color);padding:3px;cursor:pointer}.toggle i{display:block;width:20px;height:20px;border-radius:50%;
        background:white;transition:.15s}.toggle.on{background:var(--primary-color)}.toggle.on i{transform:translateX(20px)}
        .missing{margin-top:12px;padding:10px;border-radius:10px;background:color-mix(in srgb,var(--error-color,#db4437) 25%,transparent);
        font-size:12px}.empty{padding:16px;text-align:center;color:var(--secondary-text-color)}
        @media(max-width:400px){.colors{grid-template-columns:repeat(3,1fr)}}
      </style>
      <ha-card class="card">
        <div class="head">
          <div class="icon"><ha-icon icon="${onStates.length ? "mdi:lightbulb-group" : "mdi:lightbulb-group-off"}"></ha-icon></div>
          <div class="title"><h2>${esc(this._config.title || "Lights")}</h2>
          <div class="status">${onStates.length} of ${available.length} lights on</div></div>
        </div>
        ${this._config.entities.length ? `
          <div class="actions">
            <button class="action on" data-action="all-on"><ha-icon icon="mdi:lightbulb-on"></ha-icon>All on</button>
            <button class="action" data-action="all-off"><ha-icon icon="mdi:lightbulb-off"></ha-icon>All off</button>
          </div>
          ${this._config.show_brightness ? `<div class="section"><h3>All-light brightness</h3>
            <div class="brightness"><ha-icon icon="mdi:brightness-6"></ha-icon>
            <input type="range" min="1" max="100" value="${averageBrightness}" data-action="brightness">
            <strong>${averageBrightness}%</strong></div></div>` : ""}
          ${this._config.colors.length ? `<div class="section"><h3>Colour presets</h3><div class="colors">
            ${this._config.colors.map((preset,index)=>`<button class="color" data-color="${index}" style="--preset-color:${esc(preset.color || "#ffffff")}">
              <i class="swatch" style="background:${esc(preset.color || "#ffffff")};color:${contrastColor(preset.color)}"><ha-icon icon="${esc(preset.icon || "mdi:palette")}"></ha-icon></i>
              <span>${esc(preset.name || `Colour ${index+1}`)}</span>
            </button>`).join("")}</div></div>` : ""}
          ${this._config.show_individual ? `<div class="section"><h3>Individual lights</h3><div class="lights">
            ${states.map((state)=>{
              const rgb = state.attributes?.rgb_color;
              const color = Array.isArray(rgb) ? `rgb(${rgb.join(",")})` : state.state === "on" ? "#ffd867" : "var(--secondary-text-color)";
              const pct = state.attributes?.brightness == null ? "" : `${Math.round(Number(state.attributes.brightness)/2.55)}%`;
              return `<div class="light" style="--light-color:${color}"><ha-icon icon="${state.state==="on"?"mdi:lightbulb-on":"mdi:lightbulb-off"}"></ha-icon>
                <div class="name"><strong>${esc(this._friendlyName(state))}</strong><small>${esc(state.state)}${pct ? ` · ${pct}` : ""}</small></div>
                <button class="toggle ${state.state==="on"?"on":""}" data-toggle="${esc(state.entity_id)}"><i></i></button></div>`;
            }).join("")}</div></div>` : ""}
          ${missing.length ? `<div class="missing">Entity not found: ${missing.map(esc).join(", ")}</div>` : ""}
        ` : `<div class="empty">Add at least one light entity in the card editor.</div>`}
      </ha-card>`;
    this._bind();
  }

  _bind() {
    this.shadowRoot.querySelector('[data-action="all-on"]')?.addEventListener("click", () => this._all("turn_on"));
    this.shadowRoot.querySelector('[data-action="all-off"]')?.addEventListener("click", () => this._all("turn_off"));
    this.shadowRoot.querySelectorAll("[data-color]").forEach((button) => button.addEventListener("click", () => this._applyColor(Number(button.dataset.color))));
    this.shadowRoot.querySelectorAll("[data-toggle]").forEach((button) => button.addEventListener("click", () => this._toggle(button.dataset.toggle)));
    const brightness = this.shadowRoot.querySelector('[data-action="brightness"]');
    brightness?.addEventListener("pointerdown", () => this._beginInteraction());
    brightness?.addEventListener("focus", () => this._beginInteraction());
    brightness?.addEventListener("input", (event) => {
      const output = event.target.nextElementSibling;
      if (output) output.textContent = `${event.target.value}%`;
    });
    brightness?.addEventListener("change", (event) => {
      this._setBrightness(Number(event.target.value));
      this._endInteraction();
    });
    brightness?.addEventListener("blur", () => this._endInteraction());
  }

  _target() { return { entity_id: this._config.entities }; }
  _call(service, data = {}) {
    if (!this._hass || !this._config.entities.length) return;
    return this._hass.callService("light", service, { ...this._target(), ...data });
  }
  _all(service) { return this._call(service); }
  _setBrightness(percent) {
    return this._call("turn_on", { brightness_pct: Math.max(1, Math.min(100, percent)) });
  }
  _applyColor(index) {
    const preset = this._config.colors[index];
    if (!preset) return;
    return this._call("turn_on", { rgb_color: hexToRgb(preset.color) });
  }
  _toggle(entityId) {
    const state = this._hass?.states?.[entityId]?.state;
    return this._hass?.callService("light", state === "on" ? "turn_off" : "turn_on", { entity_id: entityId });
  }
  _beginInteraction() {
    clearTimeout(this._interactionTimer);
    this._interactionLock = true;
  }
  _endInteraction() {
    clearTimeout(this._interactionTimer);
    this._interactionTimer = setTimeout(() => {
      this._interactionLock = false;
      if (this._pendingRender) {
        this._pendingRender = false;
        this._render();
      }
    }, 250);
  }
}

class MultiLightControlCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULTS, colors: DEFAULT_COLORS.map((item) => ({ ...item })) };
    this._entitySignature = "";
  }

  setConfig(config) {
    this._config = {
      ...DEFAULTS, ...config,
      entities: normalizeEntities(config?.entities),
      colors: Array.isArray(config?.colors) ? config.colors.map((item) => ({ ...item })) : DEFAULT_COLORS.map((item) => ({ ...item })),
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const signature = Object.keys(hass?.states || {}).filter((id) => id.startsWith("light.")).sort().join("|");
    if (signature !== this._entitySignature) {
      this._entitySignature = signature;
      this._render();
    }
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      bubbles: true, composed: true, detail: { config: this._config },
    }));
  }

  _render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;padding:8px;color:var(--primary-text-color)}h3{margin:16px 0 8px}
        label{display:block;margin:10px 0;color:var(--secondary-text-color)}input,textarea{display:block;width:100%;box-sizing:border-box;
        margin-top:5px;padding:11px;border:1px solid var(--divider-color);border-radius:9px;color:var(--primary-text-color);
        background:var(--secondary-background-color)}textarea{min-height:105px;resize:vertical}.hint{font-size:12px;color:var(--secondary-text-color)}
        .check{display:flex;align-items:center;gap:9px}.check input{width:auto;margin:0}.preset{display:grid;grid-template-columns:1fr 78px 1fr 42px;
        gap:8px;align-items:end;padding:10px;margin:8px 0;border:1px solid var(--divider-color);border-radius:12px}
        .preset label{margin:0}.preset input[type=color]{height:42px;padding:3px}.delete,.add{border:1px solid var(--primary-color);
        border-radius:9px;padding:10px;background:transparent;color:var(--primary-color);cursor:pointer}.delete{color:var(--error-color,#ff6877);
        border-color:transparent;font-size:20px}.add{margin-top:8px}
        @media(max-width:500px){.preset{grid-template-columns:1fr 70px}.preset .icon{grid-column:1}.preset .delete{grid-column:2;grid-row:2}}
      </style>
      <h3>Lights</h3>
      <label>Card title<input data-key="title" value="${esc(this._config.title)}" placeholder="Lights"></label>
      <label>Light entities<textarea data-key="entities" placeholder="light.bedroom&#10;light.bedside_lamp">${esc(this._config.entities.join("\n"))}</textarea></label>
      <div class="hint">Enter one light entity ID per line. All selected lights can be controlled together.</div>
      <label class="check"><input type="checkbox" data-key="show_brightness" ${this._config.show_brightness?"checked":""}>Show all-light brightness</label>
      <label class="check"><input type="checkbox" data-key="show_individual" ${this._config.show_individual?"checked":""}>Show individual light controls</label>
      <h3>Custom colour buttons</h3>
      <div class="hint">These colours appear as buttons on the dashboard and apply to every selected light.</div>
      <div class="presets">${this._config.colors.map((preset,index)=>`
        <div class="preset" data-index="${index}">
          <label>Name<input data-preset="name" value="${esc(preset.name || "")}" placeholder="Purple"></label>
          <label>Colour<input type="color" data-preset="color" value="${esc(preset.color || "#ffffff")}"></label>
          <label class="icon">MDI icon (optional)<input data-preset="icon" value="${esc(preset.icon || "")}" placeholder="mdi:palette"></label>
          <button class="delete" data-delete="${index}" title="Remove">×</button>
        </div>`).join("")}</div>
      <button class="add" data-action="add">＋ Add colour</button>`;
    this._bind();
  }

  _bind() {
    this.shadowRoot.querySelectorAll("[data-key]").forEach((input) => input.addEventListener("change", () => {
      const key = input.dataset.key;
      this._config = {
        ...this._config,
        [key]: input.type === "checkbox" ? input.checked : key === "entities" ? normalizeEntities(input.value) : input.value,
      };
      this._emit();
    }));
    this.shadowRoot.querySelectorAll("[data-preset]").forEach((input) => input.addEventListener("change", () => {
      const row = input.closest("[data-index]");
      const index = Number(row.dataset.index);
      const colors = this._config.colors.map((item) => ({ ...item }));
      colors[index][input.dataset.preset] = input.value;
      this._config = { ...this._config, colors };
      this._emit();
    }));
    this.shadowRoot.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
      const colors = this._config.colors.filter((_, index) => index !== Number(button.dataset.delete));
      this._config = { ...this._config, colors };
      this._emit();
      this._render();
    }));
    this.shadowRoot.querySelector('[data-action="add"]')?.addEventListener("click", () => {
      this._config = {
        ...this._config,
        colors: [...this._config.colors, { name: "New colour", color: "#ffffff", icon: "mdi:palette" }],
      };
      this._emit();
      this._render();
    });
  }
}

if (!customElements.get("multi-light-control-card")) customElements.define("multi-light-control-card", MultiLightControlCard);
if (!customElements.get("multi-light-control-card-editor")) customElements.define("multi-light-control-card-editor", MultiLightControlCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "multi-light-control-card",
  name: "Multi-Light Control Card",
  description: "Control multiple Home Assistant lights and custom colour presets from one card.",
  preview: true,
});
console.info(`%c MULTI-LIGHT CONTROL CARD %c v${CARD_VERSION} `, "color:#171717;background:#ffd867;font-weight:bold", "color:#6b5410;background:#eee");
