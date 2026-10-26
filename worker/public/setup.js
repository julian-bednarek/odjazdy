"use strict";

const MAX_RESULTS = 8;
const RADIUS_MIN_M = 200;
const RADIUS_MAX_M = 30000;
const RADIUS_STEP_M = 50;
const SLIDER_MAX = 100;
const DEFAULT_RADIUS_M = 1500;
const COORDINATE_DECIMALS = 5;
const POLAND = { center: [52.07, 19.48], zoom: 6 };
const ZONE_ZOOM = 13;
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const Messages = {
  unauthorized: "Link wygasł albo został już użyty. Wyślij nowy z zegarka: przytrzymaj UP.",
  password: "Złe hasło.",
  closed: "Parowanie nowych zegarków jest wyłączone: ustaw w Workerze SETUP_PASSWORD (min. 20 znaków).",
  upstream: "PLK nie odpowiada, lista stacji jest niedostępna. Spróbuj za chwilę.",
  bad_request: "Każdy profil potrzebuje nazwy, strefy i co najmniej jednej stacji skąd i dokąd.",
  network: "Brak połączenia z Workerem.",
  failed: "Coś poszło nie tak.",
  saved: "Zapisano. Zegarek pobierze profile w ciągu minuty.",
  unsaved: "Zmiany czekają na zapis.",
  unpaired: "Zegarek odłączony. Żeby sparować go ponownie, użyj zegarka.",
  noLocation: "Brak dostępu do lokalizacji.",
  noZone: "Dotknij mapy, żeby ustawić strefę.",
  noStations: "Wybierz co najmniej jedną stację skąd i dokąd.",
};

const $ = (selector, root = document) => root.querySelector(selector);

const state = { registered: false, profiles: [], stations: new Map(), index: [], draft: null, draftIndex: -1 };
let map = null;
let zone = null;

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function button(text, className, onClick) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function show(message, isError = false) {
  const status = $("#status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function api(method, path, body) {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (data.error === "unauthorized") $("#list").hidden = $("#editor").hidden = true;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "network" } };
  }
}

const fail = ({ data }) => show(Messages[data.error] ?? Messages.failed, true);

// Case- and accent-insensitive; "ł" has no decomposition, so it is mapped by hand.
const fold = (text) => text.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/\p{M}/gu, "");
const words = (text) => fold(text).split(/[\s.,()-]+/).filter(Boolean);

// Every query word must start some word of the name: "waw wsch" finds Warszawa Wschodnia.
function search(query) {
  const wanted = words(query);
  if (wanted.length === 0) return [];
  return state.index
    .filter(({ parts }) => wanted.every((w) => parts.some((p) => p.startsWith(w))))
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, MAX_RESULTS);
}

const stationName = (id) => state.stations.get(id) ?? `#${id}`;
const stationNames = (ids) => ids.map(stationName).join(", ");

function formatRadius(m) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km`;
}

// The slider is logarithmic, so 200 m and 30 km are both easy to hit.
const RADIUS_SPAN = Math.log(RADIUS_MAX_M / RADIUS_MIN_M);
const radiusFromSlider = (v) => Math.round((RADIUS_MIN_M * Math.exp((v / SLIDER_MAX) * RADIUS_SPAN)) / RADIUS_STEP_M) * RADIUS_STEP_M;
const sliderFromRadius = (r) => Math.round((Math.log(r / RADIUS_MIN_M) / RADIUS_SPAN) * SLIDER_MAX);
const round = (x) => Number(x.toFixed(COORDINATE_DECIMALS));

function renderList() {
  const items = state.profiles.map((profile, i) => {
    const item = el("li", "card");
    const main = button("", "card-main", () => openEditor(i));
    main.append(
      el("strong", "", profile.name),
      el("span", "", `${stationNames(profile.from)} → ${stationNames(profile.to)}`),
      el("span", "muted", `strefa ${formatRadius(profile.r)}`),
    );
    const up = button("↑", "icon", () => move(i, -1));
    const down = button("↓", "icon", () => move(i, 1));
    up.ariaLabel = "Wyżej";
    down.ariaLabel = "Niżej";
    up.disabled = i === 0;
    down.disabled = i === state.profiles.length - 1;
    item.append(main, up, down);
    return item;
  });
  $("#profiles").replaceChildren(...items);
  $("#password").hidden = state.registered;
  $("#unpair").hidden = !state.registered;
  $("#save button").disabled = state.profiles.length === 0;
}

function move(i, step) {
  const [profile] = state.profiles.splice(i, 1);
  state.profiles.splice(i + step, 0, profile);
  changed();
}

function changed() {
  renderList();
  show(Messages.unsaved);
}

function ensureMap() {
  if (map) return;
  map = L.map("map").setView(POLAND.center, POLAND.zoom);
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
  map.on("click", ({ latlng }) => setCenter(latlng.lat, latlng.lng));
}

function drawZone() {
  const { lat, lon, r } = state.draft;
  $("#radius-value").textContent = formatRadius(r);
  if (lat === null) {
    zone?.remove();
    zone = null;
  } else if (zone) {
    zone.setLatLng([lat, lon]).setRadius(r);
  } else {
    zone = L.circle([lat, lon], { radius: r }).addTo(map);
  }
}

function setCenter(lat, lon) {
  Object.assign(state.draft, { lat: round(lat), lon: round(lon) });
  drawZone();
}

function renderPicker(picker) {
  const ids = state.draft[picker.dataset.field];
  const chips = ids.map((id) => {
    const chip = el("li", "chip", stationName(id));
    const remove = button("×", "icon", () => {
      ids.splice(ids.indexOf(id), 1);
      renderPicker(picker);
    });
    remove.ariaLabel = `Usuń ${stationName(id)}`;
    chip.append(remove);
    return chip;
  });
  $(".chips", picker).replaceChildren(...chips);
  $("input", picker).disabled = ids.length >= Number(picker.dataset.max);
}

function renderResults(picker) {
  const input = $("input", picker);
  const ids = state.draft[picker.dataset.field];
  const results = search(input.value)
    .filter(({ id }) => !ids.includes(id))
    .map(({ id, name }) => {
      const item = el("li");
      item.append(
        button(name, "result", () => {
          ids.push(id);
          input.value = "";
          renderResults(picker);
          renderPicker(picker);
        }),
      );
      return item;
    });
  $(".results", picker).replaceChildren(...results);
}

function openEditor(i) {
  const existing = state.profiles[i];
  state.draftIndex = existing ? i : -1;
  state.draft = existing
    ? structuredClone(existing)
    : { id: crypto.randomUUID().slice(0, 8), name: "", lat: null, lon: null, r: DEFAULT_RADIUS_M, from: [], to: [] };
  const form = $("#editor");
  $("#name").value = state.draft.name;
  $("#radius").value = sliderFromRadius(state.draft.r);
  $("#delete").hidden = !existing;
  $("#editor-error").textContent = "";
  form.querySelectorAll(".picker").forEach((picker) => {
    $("input", picker).value = "";
    renderPicker(picker);
    renderResults(picker);
  });
  $("#list").hidden = true;
  form.hidden = false;

  ensureMap();
  map.invalidateSize();
  drawZone();
  if (zone) map.fitBounds(zone.getBounds());
  else map.setView(POLAND.center, POLAND.zoom);
  window.scrollTo(0, 0);
}

function closeEditor() {
  state.draft = null;
  $("#editor").hidden = true;
  $("#list").hidden = false;
}

function commitDraft(event) {
  event.preventDefault();
  const draft = { ...state.draft, name: $("#name").value.trim() };
  const problem = draft.lat === null ? Messages.noZone : !draft.from.length || !draft.to.length ? Messages.noStations : "";
  if (problem) {
    $("#editor-error").textContent = problem;
    return;
  }
  if (state.draftIndex < 0) state.profiles.push(draft);
  else state.profiles[state.draftIndex] = draft;
  closeEditor();
  changed();
}

function deleteDraft() {
  state.profiles.splice(state.draftIndex, 1);
  closeEditor();
  changed();
}

function locate() {
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      setCenter(coords.latitude, coords.longitude);
      map.setView([coords.latitude, coords.longitude], ZONE_ZOOM);
    },
    () => ($("#editor-error").textContent = Messages.noLocation),
  );
}

async function save(event) {
  event.preventDefault();
  const input = $("#password-input");
  const password = state.registered ? undefined : input.value;
  const result = await api("PUT", "/api/config", { profiles: state.profiles, password });
  if (!result.ok) return fail(result);
  state.registered = true;
  input.value = "";
  renderList();
  show(Messages.saved);
}

async function unpair() {
  if (!confirm("Odłączyć zegarek? Worker usunie wszystkie jego profile.")) return;
  const result = await api("DELETE", "/api/config");
  if (!result.ok) return fail(result);
  $("#list").hidden = true;
  show(Messages.unpaired);
}

function bindEvents() {
  $("#add").addEventListener("click", () => openEditor(-1));
  $("#save").addEventListener("submit", save);
  $("#unpair").addEventListener("click", unpair);
  $("#editor").addEventListener("submit", commitDraft);
  $("#cancel").addEventListener("click", closeEditor);
  $("#delete").addEventListener("click", deleteDraft);
  $("#locate").addEventListener("click", locate);
  $("#radius").addEventListener("input", (event) => {
    state.draft.r = radiusFromSlider(Number(event.target.value));
    drawZone();
  });
  document.querySelectorAll(".picker").forEach((picker) => {
    $("input", picker).addEventListener("input", () => renderResults(picker));
  });
}

async function start() {
  bindEvents();
  const [config, stations] = await Promise.all([api("GET", "/api/config"), api("GET", "/api/stations")]);
  if (!config.ok) return fail(config);
  if (stations.ok) {
    state.stations = new Map(stations.data);
    state.index = stations.data.map(([id, name]) => ({ id, name, parts: words(name) }));
  } else {
    fail(stations);
  }
  state.registered = config.data.registered;
  state.profiles = config.data.profiles;
  renderList();
  $("#list").hidden = false;
}

start();
