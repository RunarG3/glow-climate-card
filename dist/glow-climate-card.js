// Klimakort for Home Assistant
//
// 1. Kopier denne filen til /config/www/glow-climate-card.js
// 2. Innstillinger → Oversikter → ⋮ → Ressurser → Legg til ressurs
//    URL: /local/glow-climate-card.js
//    Type: JavaScript-modul
// 3. Oppdater nettleseren. Legg til kortet «Klimakort».

const DOMAIN_ICONS = {
  light: "mdi:lightbulb",
  switch: "mdi:power-socket-eu",
  fan: "mdi:fan",
  cover: "mdi:blinds",
  climate: "mdi:thermostat",
  media_player: "mdi:speaker",
  lock: "mdi:lock",
  binary_sensor: "mdi:radiobox-marked",
  sensor: "mdi:eye",
  input_boolean: "mdi:toggle-switch",
  automation: "mdi:robot",
  script: "mdi:script-text",
};

const HVAC_LABELS = {
  heat: "Varme",
  cool: "Kjøling",
  heat_cool: "Varme/kjøl",
  auto: "Auto",
  dry: "Tørk",
  fan_only: "Vifte",
  off: "Av",
  heating: "Varme",
  cooling: "Kjøling",
  idle: "Hvile",
  drying: "Tørk",
  fan: "Vifte",
};

const TOGGLE_DOMAINS = new Set(["light", "switch", "fan", "input_boolean", "siren", "humidifier", "automation", "script"]);

const SCHEMA = [
  { name: "name", selector: { text: {} } },
  { name: "entity", required: true, selector: { entity: { filter: [{ domain: "climate" }] } } },
  { name: "motion_entity", selector: { entity: { filter: [{ domain: "binary_sensor" }] } } },
  { name: "temperature_entity", selector: { entity: { filter: [{ domain: "sensor" }] } } },
  { name: "alarm_entity", selector: { entity: { filter: [{ domain: "binary_sensor" }, { domain: "alarm_control_panel" }] } } },
  { name: "fire_entity", selector: { entity: { filter: [{ domain: "binary_sensor" }] } } },
  {
    name: "automations",
    selector: { entity: { multiple: true, filter: [{ domain: "automation" }] } },
  },
  { name: "entities", selector: { entity: { multiple: true } } },
  {
    name: "ovens",
    selector: {
      entity: {
        multiple: true,
        filter: [{ domain: "climate" }, { domain: "switch" }, { domain: "input_boolean" }],
      },
    },
  },
];

const LABELS = {
  name: "Tittel",
  entity: "Klima",
  motion_entity: "Bevegelse",
  temperature_entity: "Temperatursensor",
  alarm_entity: "Alarm",
  fire_entity: "Brannalarm",
  automations: "Automatiseringer",
  entities: "Entiteter",
  ovens: "Ovner",
};

function entityList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => (typeof item === "string" ? item : item && item.entity))
    .filter(Boolean);
}

function formatTemp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return `${number.toFixed(1).replace(".", ",")}°`;
}

function domainOf(entityId) {
  return String(entityId || "").split(".")[0];
}

function isOn(stateObj) {
  return !!stateObj && ["on", "open", "opening", "unlocked", "heat", "cool", "playing", "triggered"].includes(stateObj.state);
}

function iconFor(stateObj, entityId) {
  if (stateObj && stateObj.attributes && stateObj.attributes.icon) return stateObj.attributes.icon;
  return DOMAIN_ICONS[domainOf(entityId)] || "mdi:eye";
}

class GlowClimateCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("glow-climate-card-editor");
  }

  static getStubConfig(hass) {
    const states = (hass && hass.states) || {};
    const entity = Object.keys(states).find((id) => id.startsWith("climate.")) || "";
    return { entity };
  }

  setConfig(config) {
    this._config = config || {};
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const active = (this.shadowRoot && this.shadowRoot.activeElement) || document.activeElement;
    if (this._slider && active === this._slider) {
      this._updateHeader();
      this._updateEntities();
      this._updateGlow();
      return;
    }
    this._render();
  }

  connectedCallback() {
    if (this._hass && this._config) this._render();
  }

  _climate() {
    return this._hass.states[this._config.entity];
  }

  _currentTemp(climate) {
    const sensorId = this._config.temperature_entity;
    const sensor = sensorId && this._hass.states[sensorId];
    if (sensor && Number.isFinite(Number(sensor.state))) return Number(sensor.state);
    return climate && climate.attributes.current_temperature;
  }

  _render() {
    if (!this._hass || !this._config) return;
    const climate = this._climate();
    if (!this._config.entity || !climate) {
      this._renderMessage(this._config.entity ? `Fant ikke ${this._config.entity}` : "Velg et klima i kortkonfigurasjonen");
      return;
    }

    const shell = document.createElement("div");
    shell.className = "glow-shell";
    const root = document.createElement("ha-card");
    const header = document.createElement("div");
    header.className = "header";
    const titles = document.createElement("div");
    const name = document.createElement("div");
    name.className = "name";
    const mode = document.createElement("div");
    mode.className = "mode";
    titles.append(name, mode);
    header.append(titles);

    const automations = entityList(this._config.automations);
    if (automations.length) {
      const wrap = document.createElement("div");
      wrap.className = "auto";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "switch";
      button.setAttribute("role", "switch");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this._toggleAutomations(automations);
      });
      const knob = document.createElement("span");
      button.append(knob);
      const word = document.createElement("span");
      word.className = "auto-word";
      wrap.append(button, word);
      header.append(wrap);
      this._autoButton = button;
      this._autoWord = word;
    }

    const list = document.createElement("div");
    list.className = "entities";
    const sliderBlock = document.createElement("div");
    sliderBlock.className = "slider-block";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "temp-slider";
    const min = Number(climate.attributes.min_temp ?? 7);
    const max = Number(climate.attributes.max_temp ?? 35);
    const step = Number(climate.attributes.target_temp_step ?? 0.5);
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.addEventListener("input", () => {
      this._setpoint.textContent = formatTemp(slider.value);
      sliderBlock.style.setProperty("--fill", `${((slider.value - min) / (max - min)) * 100}%`);
    });
    slider.addEventListener("change", () => {
      this._hass.callService("climate", "set_temperature", {
        entity_id: this._config.entity,
        temperature: Number(slider.value),
      });
    });
    const scale = document.createElement("div");
    scale.className = "scale";
    const minLabel = document.createElement("span");
    minLabel.textContent = `${min}°`;
    const setpoint = document.createElement("span");
    setpoint.className = "setpoint";
    const maxLabel = document.createElement("span");
    maxLabel.textContent = `${max}°`;
    scale.append(minLabel, setpoint, maxLabel);
    sliderBlock.append(slider, scale);

    const ovenButton = document.createElement("button");
    ovenButton.type = "button";
    ovenButton.className = "oven-btn";
    ovenButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this._toggleOvens();
    });

    root.append(header, list, ovenButton, sliderBlock);
    shell.append(root);
    const shadow = this._shadow();
    for (const node of [...shadow.childNodes]) {
      if (node.nodeName !== "STYLE") node.remove();
    }
    shadow.append(shell);

    this._card = shell;
    this._name = name;
    this._mode = mode;
    this._list = list;
    this._slider = slider;
    this._setpoint = setpoint;
    this._sliderBlock = sliderBlock;
    this._ovenButton = ovenButton;
    this._updateHeader();
    this._updateEntities();
    this._updateGlow();
    this._updateSlider(climate, min, max);
  }

  _shadow() {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = CARD_STYLE;
      shadow.append(style);
    }
    return this.shadowRoot;
  }

  _renderMessage(text) {
    const card = document.createElement("ha-card");
    const note = document.createElement("div");
    note.className = "missing";
    note.textContent = text;
    card.append(note);
    const shadow = this._shadow();
    for (const node of [...shadow.childNodes]) {
      if (node.nodeName !== "STYLE") node.remove();
    }
    shadow.append(card);
    this._slider = null;
  }

  _updateHeader() {
    const climate = this._climate();
    if (!climate || !this._name) return;
    const action = climate.attributes.hvac_action || climate.state;
    this._name.textContent = this._config.name || climate.attributes.friendly_name || "Klima";
    this._mode.textContent = "";
    const mode = document.createElement("span");
    mode.textContent = HVAC_LABELS[action] || action || "";
    const now = document.createElement("span");
    now.className = "now";
    now.textContent = `Er nå ${formatTemp(this._currentTemp(climate))}`;
    this._mode.append(mode, now);

    if (this._autoButton) {
      const ids = entityList(this._config.automations);
      const on = ids.length > 0 && ids.every((id) => this._hass.states[id] && this._hass.states[id].state === "on");
      this._autoButton.classList.toggle("on", on);
      this._autoButton.setAttribute("aria-checked", on ? "true" : "false");
      this._autoWord.textContent = on ? "Auto" : "Av";
    }
    if (this._ovenButton) {
      const anyOn = this._ovensOn();
      this._ovenButton.textContent = anyOn ? "Slå av ovner" : "Slå på ovner";
    }
    if (this._slider && climate) {
      this._slider.disabled = climate.state === "off";
    }
  }

  _updateEntities() {
    if (!this._list) return;
    this._list.replaceChildren();
    for (const entityId of entityList(this._config.entities)) {
      if (entityId === this._config.entity) continue;
      const stateObj = this._hass.states[entityId];
      this._list.append(this._entityRow(entityId, stateObj));
    }
  }

  _entityRow(entityId, stateObj) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "row";
    const icon = document.createElement("ha-icon");
    icon.icon = iconFor(stateObj, entityId);
    const name = document.createElement("span");
    name.className = "row-name";
    name.textContent = (stateObj && stateObj.attributes.friendly_name) || entityId;
    row.append(icon, name);

    const domain = domainOf(entityId);
    const active = isOn(stateObj);
    if (active) icon.classList.add("active");

    if (TOGGLE_DOMAINS.has(domain)) {
      const toggle = document.createElement("span");
      toggle.className = active ? "switch on" : "switch";
      toggle.append(document.createElement("span"));
      row.append(toggle);
      row.addEventListener("click", (event) => {
        event.stopPropagation();
        this._hass.callService("homeassistant", "toggle", { entity_id: entityId });
      });
    } else if (domain === "cover") {
      const value = document.createElement("span");
      value.className = "row-value";
      value.textContent = stateObj && stateObj.state === "open" ? "Åpen" : stateObj && stateObj.state === "opening" ? "Åpner" : stateObj && stateObj.state === "closing" ? "Lukker" : "Lukket";
      row.append(value);
      row.addEventListener("click", () => {
        const open = stateObj && (stateObj.state === "open" || stateObj.state === "opening");
        this._hass.callService("cover", open ? "close_cover" : "open_cover", { entity_id: entityId });
      });
    } else {
      const value = document.createElement("span");
      value.className = "row-value";
      value.textContent = stateObj ? this._hass.formatEntityState ? this._hass.formatEntityState(stateObj) : stateObj.state : "utilgjengelig";
      row.append(value);
      row.addEventListener("click", () => this._moreInfo(entityId));
    }
    return row;
  }

  _updateSlider(climate, min, max) {
    const target = Number(climate.attributes.temperature ?? climate.attributes.current_temperature ?? min);
    if (!this._slider) return;
    this._slider.value = String(target);
    this._setpoint.textContent = formatTemp(target);
    this._sliderBlock.style.setProperty("--fill", `${((target - min) / (max - min)) * 100}%`);
    this._slider.setAttribute("aria-label", "Måltemperatur");
  }

  _updateGlow() {
    if (!this._card) return;
    const motion = this._config.motion_entity && this._hass.states[this._config.motion_entity];
    const alarm = this._config.alarm_entity && this._hass.states[this._config.alarm_entity];
    const fire = this._config.fire_entity && this._hass.states[this._config.fire_entity];
    const alert = isOn(alarm) || isOn(fire) || (alarm && alarm.state === "triggered") || (fire && ["on", "detected"].includes(fire.state));
    this._card.classList.toggle("alarm", !!alert);
    this._card.classList.toggle("motion", !alert && isOn(motion));
  }

  _toggleAutomations(ids) {
    const turnOff = ids.every((id) => this._hass.states[id] && this._hass.states[id].state === "on");
    for (const entityId of ids) {
      this._hass.callService("automation", turnOff ? "turn_off" : "turn_on", { entity_id: entityId });
    }
  }

  _ovenIds() {
    return [...new Set([this._config.entity, ...entityList(this._config.ovens)].filter(Boolean))];
  }

  _ovenIsOn(stateObj) {
    if (!stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown") return false;
    if (domainOf(stateObj.entity_id) === "climate") return stateObj.state !== "off";
    return stateObj.state === "on";
  }

  _ovensOn() {
    return this._ovenIds().some((id) => this._ovenIsOn(this._hass.states[id]));
  }

  _toggleOvens() {
    const turnOff = this._ovensOn();
    for (const entityId of this._ovenIds()) {
      const stateObj = this._hass.states[entityId];
      if (domainOf(entityId) === "climate") {
        const modes = (stateObj && stateObj.attributes.hvac_modes) || ["heat", "off"];
        if (turnOff) {
          if (modes.includes("off")) {
            this._hass.callService("climate", "set_hvac_mode", { entity_id: entityId, hvac_mode: "off" });
          } else {
            this._hass.callService("climate", "turn_off", { entity_id: entityId });
          }
        } else if (modes.includes("heat")) {
          this._hass.callService("climate", "set_hvac_mode", { entity_id: entityId, hvac_mode: "heat" });
        } else {
          const next = modes.find((mode) => mode !== "off");
          if (next) this._hass.callService("climate", "set_hvac_mode", { entity_id: entityId, hvac_mode: next });
          else this._hass.callService("climate", "turn_on", { entity_id: entityId });
        }
      } else {
        this._hass.callService("homeassistant", turnOff ? "turn_off" : "turn_on", { entity_id: entityId });
      }
    }
  }

  _moreInfo(entityId) {
    const event = new Event("hass-more-info", { bubbles: true, composed: true });
    event.detail = { entityId };
    this.dispatchEvent(event);
  }
}

class GlowClimateCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    if (this._form) this._form.data = this._config;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    this._ensureForm();
  }

  connectedCallback() {
    this._ensureForm();
  }

  _ensureForm() {
    if (this._form || !this._hass || !this._config) return;
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._config;
    form.schema = SCHEMA;
    form.computeLabel = (schema) => LABELS[schema.name] || schema.name;
    form.addEventListener("value-changed", (event) => {
      const config = { ...event.detail.value };
      this._config = config;
      form.data = config;
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
    });
    this.append(form);
    this._form = form;
  }
}

const CARD_STYLE = `
:host, glow-climate-card {
  display: block;
}
.glow-shell {
  border-radius: var(--ha-card-border-radius, var(--ha-border-radius, 12px));
  background: transparent;
}
.glow-shell.motion {
  box-shadow:
    0 0 0 1px rgba(245, 197, 66, 0.8),
    0 0 12px 0 rgba(245, 197, 66, 0.45);
}
.glow-shell.alarm {
  box-shadow:
    0 0 0 1px rgba(226, 59, 59, 0.85),
    0 0 12px 0 rgba(226, 59, 59, 0.45);
}
ha-card {
  position: relative;
  z-index: 1;
  padding: 12px 16px 14px;
  color: var(--primary-text-color);
  border-radius: var(--ha-card-border-radius, var(--ha-border-radius, 12px));
  background-color: var(--primary-background-color, Canvas) !important;
  background-image: linear-gradient(
    var(--ha-card-background, var(--card-background-color, transparent)),
    var(--ha-card-background, var(--card-background-color, transparent))
  ) !important;
  box-shadow: var(--ha-card-box-shadow, none) !important;
}
.header, .auto, .row, .scale {
  display: flex;
  align-items: center;
}
.header { gap: 12px; min-height: 48px; }
.name { font-size: 1.15rem; font-weight: 600; line-height: 1.2; }
.mode { color: var(--secondary-text-color); font-size: 0.85rem; display: flex; gap: 8px; margin-top: 2px; }
.now { color: var(--secondary-text-color); }
.auto { margin-left: auto; gap: 8px; }
.auto-word { color: var(--secondary-text-color); min-width: 2.4rem; }
.switch {
  width: 42px; height: 24px; border: 0; border-radius: 999px; padding: 2px;
  background: var(--disabled-color, #9e9e9e); display: flex; align-items: center; cursor: pointer;
}
.switch.on { background: var(--state-switch-active-color, var(--primary-color)); justify-content: flex-end; }
.switch span { width: 20px; height: 20px; border-radius: 999px; background: #fff; display: block; }
.entities { margin-top: 6px; }
.row {
  width: 100%; min-height: 48px; border: 0; background: transparent; color: inherit;
  display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; align-items: center;
  text-align: left; cursor: pointer; padding: 0; font: inherit;
}
ha-icon { color: var(--state-icon-color, var(--secondary-text-color)); }
ha-icon.active { color: var(--state-icon-active-color, var(--state-light-active-color, #ffb74d)); }
.row-name { font-size: 1rem; }
.row-value { color: var(--primary-text-color); }
.oven-btn {
  display: block;
  margin: 2px 0 0 auto;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--secondary-text-color);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  opacity: 0.8;
}
.slider-block { margin-top: 8px; }
.temp-slider {
  -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 999px;
  background: linear-gradient(to right, var(--state-climate-heat-color, #e39a45) var(--fill, 40%), var(--divider-color, #4a4a50) var(--fill, 40%));
  outline: none;
}
.temp-slider:disabled { opacity: 0.4; }
.temp-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 22px; height: 22px; border-radius: 999px; background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.4); cursor: pointer;
}
.temp-slider::-moz-range-thumb {
  width: 22px; height: 22px; border: 0; border-radius: 999px; background: #fff; cursor: pointer;
}
.scale { display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline; color: var(--secondary-text-color); }
.scale span:last-child { justify-self: end; }
.setpoint { justify-self: center; color: var(--primary-text-color); font-size: 1.45rem; font-weight: 600; }
.missing { padding: 16px; color: var(--secondary-text-color); }
`;

customElements.define("glow-climate-card", GlowClimateCard);
customElements.define("glow-climate-card-editor", GlowClimateCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "glow-climate-card",
  name: "Klimakort",
  description: "Klima med glød for bevegelse og alarm, automatiseringsbryter og flere enheter",
  preview: true,
});
