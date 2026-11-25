import {
  SPECIES,
  TINTS,
  CLOTHING,
  FOODS,
  SCENES,
  findClothing,
  drawPet,
  drawFood,
  drawPetThumb,
  drawItemIcon,
  drawIcon,
  drawHeart,
  drawStar,
  drawScene,
  drawToy,
  drawDoor,
  px,
} from './sprites.js?v=2';
import { sfx, setMuted, initAudio } from './audio.js?v=2';

/* ---------------- helpers ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SAVE_KEY = 'pocketpal.save.v1';
const STAGE_XP = [0, 200, 650];
const MAX_STAGE = STAGE_XP.length - 1;
const STAGE_CHIP = ['BABY', 'JUNIOR', 'GROWN ★'];
const STREAK_WINDOW = 18000; // ms between care actions to keep the streak alive
const DECAY = { hunger: 1.1, thirst: 1.3, happiness: 0.9 }; // points lost per minute

/** Stage is always derived from XP, so the two can never disagree. */
const stageForXp = (xp) => {
  let stage = 0;
  for (let i = 1; i < STAGE_XP.length; i++) if (xp >= STAGE_XP[i]) stage = i;
  return stage;
};
const NAME_POOL = ['Mochi', 'Pip', 'Bean', 'Tofu', 'Pudding', 'Miso', 'Boba', 'Kiwi', 'Peach', 'Noodle'];

/* ---------------- state ---------------- */

function defaultState() {
  return {
    pet: null,
    roster: [],
    scene: 'meadow',
    points: 40,
    streak: 1,
    lastActionAt: 0,
    closet: { owned: [], equipped: { hat: null, neck: null, eyes: null, outfit: null } },
    muted: false,
    savedAt: Date.now(),
  };
}

const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function normalizePet(raw) {
  const p = raw || {};
  const species = SPECIES.some((s) => s.id === p.species) ? p.species : 'bunny';
  const xp = clamp(Math.round(Number(p.xp) || 0), 0, STAGE_XP[MAX_STAGE]);
  return {
    id: typeof p.id === 'string' && p.id ? p.id : newId(),
    species,
    name: String(p.name || 'Pal').slice(0, 12),
    tint: typeof p.tint === 'string' ? p.tint : TINTS[0].hex,
    stage: stageForXp(xp),
    xp,
    hunger: clamp(Number(p.hunger) || 0, 0, 100),
    thirst: clamp(Number(p.thirst) || 0, 0, 100),
    happiness: clamp(Number(p.happiness) || 0, 0, 100),
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;

  const owned = Array.isArray(raw.closet && raw.closet.owned)
    ? Array.from(new Set(raw.closet.owned.filter((id) => CLOTHING.some((c) => c.id === id))))
    : [];
  const equippedRaw = (raw.closet && raw.closet.equipped) || {};
  const equipped = {};
  for (const cat of ['hat', 'neck', 'eyes', 'outfit']) {
    const id = equippedRaw[cat];
    equipped[cat] = owned.includes(id) ? id : null;
  }

  const pet = raw.pet ? normalizePet(raw.pet) : null;
  const seen = new Set(pet ? [pet.id] : []);
  const roster = [];
  if (Array.isArray(raw.roster)) {
    for (const entry of raw.roster) {
      if (!entry || typeof entry !== 'object') continue;
      const pal = normalizePet(entry);
      if (seen.has(pal.id)) continue;
      seen.add(pal.id);
      roster.push(pal);
    }
  }

  return {
    pet,
    roster,
    scene: SCENES.some((s) => s.id === raw.scene) ? raw.scene : 'meadow',
    points: Math.max(0, Math.round(Number(raw.points) || 0)),
    streak: clamp(Math.round(Number(raw.streak) || 1), 1, 30),
    lastActionAt: Number(raw.lastActionAt) || 0,
    closet: { owned, equipped },
    muted: !!raw.muted,
    savedAt: Number(raw.savedAt) || Date.now(),
  };
}

let state = defaultState();

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    state = normalizeState(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

let saveTimer = null;

function save() {
  state.savedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable — play on */
    }
  }, 120);
}

function flushSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

/* ---------------- dom ---------------- */

const petCanvas = $('#pet-canvas');
const petCtx = petCanvas.getContext('2d');
const stageEl = $('#stage');
const bubbleEl = $('#bubble');
const foodGrid = $('#food-grid');
const shopEl = $('#shop');
const storeEl = $('#pet-store');
const doorsEl = $('#doors');
const toyGridEl = $('#toy-grid');
const needsEl = $('#needs-row');
const sceneDotsEl = $('#scene-dots');
const catTabsEl = $('#cat-tabs');
const onboardEl = $('#onboard');
const speciesGridEl = $('#species-grid');
const tintRowEl = $('#tint-row');
const nameInput = $('#name-input');
const stageLabelEl = $('#stage-label');
const petNameEl = $('#pet-name');

/* ---------------- animation state ---------------- */

const anim = {
  t: 0,
  hopY: 0,
  hopV: 0,
  wiggle: 0,
  blinkT: 0,
  nextBlink: 2.2,
  eyeOpen: 1,
  mood: 'normal',
  moodT: 0,
  chompT: 0,
  evolveT: 0,
};

const particles = [];
let activeCat = 'hat';

const draft = { species: 'bunny', tint: TINTS[0].hex, name: '' };
const foodCanvases = [];

/* ---------------- derived values ---------------- */

function multiplier() {
  return Math.min(2.5, 1 + (state.streak - 1) * 0.1);
}

function formatMult(m) {
  return `×${Number.isInteger(m) ? m : m.toFixed(1)}`;
}

function bumpStreak() {
  const now = Date.now();
  state.streak = now - state.lastActionAt <= STREAK_WINDOW ? Math.min(30, state.streak + 1) : 1;
  state.lastActionAt = now;
}

function stageInfo(pet) {
  return SPECIES.find((s) => s.id === pet.species) || SPECIES[0];
}

function isNeedy(pet) {
  return pet.hunger < 30 || pet.thirst < 30 || pet.happiness < 22;
}

/* ---------------- sound ---------------- */

function updateMute() {
  setMuted(state.muted);
  const btn = $('#mute-btn');
  btn.textContent = state.muted ? 'SFX OFF' : 'SFX ON';
  btn.classList.toggle('is-off', state.muted);
  btn.setAttribute('aria-pressed', String(state.muted));
}

/* ---------------- particles ---------------- */

function spawnHearts(n = 3) {
  for (let i = 0; i < n; i++) {
    particles.push({
      type: 'heart',
      x: 80 + (Math.random() - 0.5) * 46,
      y: 76 + Math.random() * 18,
      vx: (Math.random() - 0.5) * 16,
      vy: -22 - Math.random() * 14,
      gravity: 6,
      life: 1.1,
      max: 1.1,
      size: Math.random() < 0.5 ? 1 : 2,
    });
  }
}

function spawnStars(n = 8) {
  for (let i = 0; i < n; i++) {
    particles.push({
      type: 'star',
      x: 80 + (Math.random() - 0.5) * 70,
      y: 70 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 18,
      vy: -16 - Math.random() * 16,
      gravity: 4,
      life: 1.4,
      max: 1.4,
      size: 1 + Math.round(Math.random()),
    });
  }
}

function spawnDrops(n = 9) {
  for (let i = 0; i < n; i++) {
    particles.push({
      type: 'drop',
      x: 62 + Math.random() * 36,
      y: 6 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 10,
      vy: 40 + Math.random() * 40,
      gravity: 90,
      life: 1.05,
      max: 1.05,
    });
  }
}

function spawnText(x, y, text, color) {
  particles.push({ type: 'text', x, y, vx: 0, vy: -22, gravity: 0, life: 1.1, max: 1.1, text, color });
}

/* ---------------- speech ---------------- */

let speechTimer = null;

function speech(text, ms = 1900) {
  bubbleEl.textContent = text;
  bubbleEl.hidden = false;
  bubbleEl.classList.remove('pop');
  void bubbleEl.offsetWidth;
  bubbleEl.classList.add('pop');
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => {
    bubbleEl.hidden = true;
  }, ms);
}

function react(mood, dur = 1) {
  anim.mood = mood;
  anim.moodT = dur;
}

/* ---------------- care actions ---------------- */

function award(basePoints, baseXp) {
  const m = multiplier();
  const pts = Math.round(basePoints * m);
  const xp = Math.round(baseXp * m);
  state.points += pts;
  state.pet.xp = Math.min(STAGE_XP[MAX_STAGE], state.pet.xp + xp);
  return { pts, xp, m };
}

function checkStage() {
  const p = state.pet;
  const target = stageForXp(p.xp);
  if (target > p.stage) {
    p.stage = target;
    anim.evolveT = 2.6;
    react('sparkle', 2.4);
    spawnStars(16);
    sfx.evolve();
    const name = stageInfo(p).stages[p.stage];
    setTimeout(() => speech(`Evolved into ${name}!`, 2600), 800);
  }
}

function feed(id) {
  if (!state.pet) return;
  const food = FOODS.find((f) => f.id === id);
  if (!food) return;

  initAudio();
  bumpStreak();
  const { pts } = award(food.points, food.xp);
  const p = state.pet;

  p.hunger = clamp(p.hunger + food.hunger, 0, 100);
  if (food.thirst) p.thirst = clamp(p.thirst + food.thirst, 0, 100);
  p.happiness = clamp(p.happiness + (food.happy || 0), 0, 100);

  anim.chompT = 1.15;
  anim.hopV = 24;
  react('sparkle', 0.5);
  spawnHearts(2);
  spawnText(98, 44, `+${pts}`, '#c98b12');
  speech(pick([`Yum! ${food.name}!`, 'Nom nom nom~', 'So tasty!', 'More please!']));
  sfx.chomp();

  checkStage();
  save();
  renderHud();
  renderStats();
  renderCare();
}

function waterAction() {
  if (!state.pet) return;
  initAudio();
  bumpStreak();
  const { pts } = award(9, 11);
  const p = state.pet;

  p.thirst = clamp(p.thirst + 26, 0, 100);
  p.happiness = clamp(p.happiness + 3, 0, 100);

  spawnDrops(10);
  spawnText(62, 46, `+${pts}`, '#2f8fd0');
  react('sparkle', 0.9);
  anim.hopV = 16;
  speech(pick(['Glug glug!', 'So refreshing!', 'Splash~', 'Ahh, hydration!']));
  sfx.water();

  checkStage();
  save();
  renderHud();
  renderStats();
  renderCare();
}

function petAction() {
  if (!state.pet) return;
  initAudio();
  bumpStreak();
  const { pts } = award(5, 7);
  const p = state.pet;

  p.happiness = clamp(p.happiness + 10, 0, 100);

  anim.hopV = 74;
  anim.wiggle = 0.6;
  react('heart', 1.2);
  spawnHearts(4);
  spawnText(80, 40, `+${pts}`, '#e04c7c');
  speech(pick(['Hehe!', 'That tickles!', '♥ ♥ ♥', 'More pets!']));
  sfx.chirp();

  checkStage();
  save();
  renderHud();
  renderStats();
  renderCare();
}

/* ---------------- areas + playground ---------------- */

const AREAS = [
  { id: 'play', label: 'PLAY', name: 'Playground', accent: '#7fd6a0' },
  { id: 'snacks', label: 'EAT', name: 'Kitchen', accent: '#ffd166' },
  { id: 'closet', label: 'WEAR', name: 'Closet', accent: '#ff8fb1' },
  { id: 'care', label: 'CARE', name: 'Nursery', accent: '#c6abf4' },
];

const TOYS = [
  { id: 'ball', name: 'Ball', happy: 14, points: 7, xp: 9, line: ['Wheee!', 'Boing boing!', 'Catch me!'] },
  { id: 'frisbee', name: 'Frisbee', happy: 18, points: 9, xp: 11, line: ['I got it!', 'Zoom!', 'Throw it again!'] },
  { id: 'bubbles', name: 'Bubbles', happy: 11, points: 6, xp: 7, line: ['Pop pop!', 'Ooh, shiny!', 'Bubble!'] },
];

function renderDoors() {
  if (!doorsEl) return;
  doorsEl.innerHTML = '';
  for (const area of AREAS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'door';
    btn.title = area.name;
    btn.innerHTML = `<canvas width="40" height="40" aria-hidden="true"></canvas><span class="door__label">${area.label}</span>`;
    btn.addEventListener('click', () => {
      initAudio();
      sfx.blip();
      setTab(area.id);
    });
    doorsEl.appendChild(btn);
    drawDoor(btn.querySelector('canvas').getContext('2d'), area.accent);
  }
}

function renderPlayground() {
  if (!toyGridEl) return;
  toyGridEl.innerHTML = '';
  for (const toy of TOYS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toy';
    btn.innerHTML = `
      <canvas width="40" height="40" aria-hidden="true"></canvas>
      <span class="toy__name">${toy.name}</span>
      <span class="toy__gain">+${toy.happy} joy</span>`;
    btn.addEventListener('click', () => playAction(toy.id));
    toyGridEl.appendChild(btn);
    drawToy(btn.querySelector('canvas').getContext('2d'), toy.id);
  }
}

function playAction(id) {
  if (!state.pet) return;
  const toy = TOYS.find((t) => t.id === id);
  if (!toy) return;
  initAudio();
  bumpStreak();
  const { pts } = award(toy.points, toy.xp);
  const p = state.pet;

  p.happiness = clamp(p.happiness + toy.happy, 0, 100);
  anim.hopV = toy.id === 'ball' ? 86 : toy.id === 'frisbee' ? 60 : 34;
  anim.wiggle = 0.5;
  react('sparkle', 1);
  spawnText(80, 40, `+${pts}`, '#e04c7c');
  if (toy.id === 'frisbee') spawnStars(8);
  else if (toy.id === 'bubbles') spawnDrops(7);
  else spawnHearts(3);
  speech(pick(toy.line));
  sfx.chirp();

  checkStage();
  save();
  renderHud();
  renderStats();
  renderCare();
}

/* ---------------- shop ---------------- */

function onShopClick(id, el) {
  const item = findClothing(id);
  if (!item) return;
  initAudio();

  const owned = state.closet.owned.includes(id);
  if (owned) {
    const current = state.closet.equipped[item.cat];
    if (current === id) {
      state.closet.equipped[item.cat] = null;
      sfx.blip();
    } else {
      state.closet.equipped[item.cat] = id;
      react('sparkle', 1.1);
      speech('Looking cute!');
      sfx.sparkle();
    }
  } else if (state.points < item.cost) {
    speech(`Need ${item.cost - state.points} more CP`);
    sfx.error();
    if (el) {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }
    return;
  } else {
    state.points -= item.cost;
    state.closet.owned.push(id);
    state.closet.equipped[item.cat] = id;
    react('heart', 1.5);
    spawnHearts(5);
    speech('Ooh, fancy!');
    sfx.buy();
  }

  save();
  renderHud();
  renderCloset();
}

/* ---------------- rendering: chrome ---------------- */

function renderHud() {
  $('#points-val').textContent = state.points;
  $('#streak-val').textContent = state.streak;
  $('#mult-val').textContent = formatMult(multiplier());
  $('#streak-badge').classList.toggle('is-hot', state.streak >= 4);
}

function renderNeeds() {
  if (!needsEl) return;
  const p = state.pet;
  const needs = [];
  if (p) {
    if (p.hunger < 35) needs.push(['hungry', 'HUNGRY']);
    if (p.thirst < 35) needs.push(['thirsty', 'THIRSTY']);
    if (p.happiness < 30) needs.push(['lonely', 'NEEDS ATTENTION']);
  }
  needsEl.innerHTML = '';
  if (!needs.length) {
    const ok = document.createElement('span');
    ok.className = 'need need--ok';
    ok.textContent = p ? 'ALL NEEDS MET \u2665' : 'NO PAL YET';
    needsEl.appendChild(ok);
    return;
  }
  for (const [cls, label] of needs) {
    const chip = document.createElement('span');
    chip.className = `need need--${cls}`;
    chip.textContent = label;
    needsEl.appendChild(chip);
  }
}

function renderStats() {
  renderNeeds();
  const p = state.pet;
  if (!p) return;
  const set = (id, value) => {
    const bar = $(`#bar-${id}`);
    if (!bar) return;
    bar.style.width = `${clamp(value, 0, 100)}%`;
    bar.parentElement.classList.toggle('is-low', value < 30);
  };
  set('hunger', p.hunger);
  set('thirst', p.thirst);
  set('happiness', p.happiness);
}

function renderCare() {
  const p = state.pet;
  if (!p) return;
  const info = stageInfo(p);
  const stage = p.stage;
  const isMax = stage >= MAX_STAGE;
  const nextXp = STAGE_XP[Math.min(stage + 1, MAX_STAGE)];
  const pct = isMax ? 100 : clamp(((p.xp - STAGE_XP[stage]) / (nextXp - STAGE_XP[stage])) * 100, 0, 100);

  const xpBar = $('#bar-xp');
  xpBar.style.width = `${pct}%`;
  xpBar.parentElement.classList.toggle('is-max', isMax);
  $('#growth-label').textContent = isMax ? `${info.stages[stage]} · MAX` : info.stages[stage];
  $('#growth-hint').textContent = isMax
    ? `Fully grown — max stage reached (${STAGE_XP[MAX_STAGE]} XP)`
    : `${Math.max(0, nextXp - p.xp)} XP to ${info.stages[stage + 1]}`;
  petNameEl.textContent = p.name;
  stageLabelEl.textContent = STAGE_CHIP[stage];
}

function renderCloset() {
  const cats = [
    ['hat', 'HATS'],
    ['neck', 'NECK'],
    ['eyes', 'EYES'],
    ['outfit', 'OUTFITS'],
  ];

  catTabsEl.innerHTML = '';
  for (const [id, label] of cats) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `cat-tab${activeCat === id ? ' is-active' : ''}`;
    b.textContent = label;
    b.addEventListener('click', () => {
      activeCat = id;
      initAudio();
      sfx.blip();
      renderCloset();
    });
    catTabsEl.appendChild(b);
  }

  shopEl.innerHTML = '';
  for (const item of CLOTHING.filter((c) => c.cat === activeCat)) {
    const owned = state.closet.owned.includes(item.id);
    const wearing = state.closet.equipped[item.cat] === item.id;
    const broke = !owned && state.points < item.cost;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'shop-item' + (owned ? ' is-owned' : '') + (wearing ? ' is-wearing' : '') + (broke ? ' is-broke' : '');
    btn.innerHTML = `
      <canvas width="48" height="48" aria-hidden="true"></canvas>
      <span class="shop-item__meta">
        <span class="shop-item__name">${item.name}</span>
        <span class="shop-item__price">${wearing ? 'WEARING' : owned ? 'WEAR' : `★ ${item.cost}`}</span>
      </span>`;
    btn.addEventListener('click', () => onShopClick(item.id, btn));
    shopEl.appendChild(btn);
    drawItemIcon(btn.querySelector('canvas').getContext('2d'), item);
  }
}

/* ---------------- pet store ---------------- */

function archiveActivePet() {
  const current = state.pet;
  if (!current) return;
  if (!state.roster.some((p) => p.id === current.id)) state.roster.push({ ...current });
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function adoptPet(id) {
  const target = state.roster.find((p) => p.id === id);
  if (!target || (state.pet && state.pet.id === id)) return;
  initAudio();

  // The outgoing pal is archived, then the adopted one leaves the roster.
  // Filtering by id also clears a duplicate if a save ever contains one.
  archiveActivePet();
  state.roster = state.roster.filter((p) => p.id !== id);
  state.pet = target;

  anim.hopV = 60;
  react('heart', 1.3);
  spawnHearts(4);
  speech(`${target.name} is back!`, 2200);
  sfx.sparkle();
  save();
  renderAll();
}

function renderStore() {
  if (!storeEl) return;
  storeEl.innerHTML = '';

  const cards = [];
  if (state.pet) cards.push({ pal: state.pet, active: true });
  for (const pal of state.roster) cards.push({ pal, active: false });

  for (const { pal, active } of cards) {
    const info = stageInfo(pal);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `store-item${active ? ' is-active' : ''}`;
    btn.innerHTML = `
      <canvas width="44" height="44" aria-hidden="true"></canvas>
      <span class="store-item__meta">
        <span class="store-item__name">${esc(pal.name)}</span>
        <span class="store-item__sub">${info.stages[pal.stage]}</span>
        <span class="store-item__tag">${active ? 'ACTIVE' : 'ADOPT'}</span>
      </span>`;
    if (!active) btn.addEventListener('click', () => adoptPet(pal.id));
    storeEl.appendChild(btn);
    drawPetThumb(btn.querySelector('canvas').getContext('2d'), pal);
  }

  if (state.roster.length === 0) {
    const note = document.createElement('p');
    note.className = 'store__empty';
    note.textContent = 'Name a new pal and this one will wait here for you.';
    storeEl.appendChild(note);
  }
}

function renderAll() {
  renderHud();
  renderStats();
  renderCare();
  renderCloset();
  renderStore();
  renderDoors();
  renderPlayground();
  renderSceneDots();
  updateMute();
}

/* ---------------- rendering: creator ---------------- */

function renderCreator() {
  speciesGridEl.innerHTML = '';
  for (const sp of SPECIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `species${draft.species === sp.id ? ' is-active' : ''}`;
    btn.innerHTML = `<canvas width="48" height="48" aria-hidden="true"></canvas><span>${sp.name}</span>`;
    btn.addEventListener('click', () => {
      draft.species = sp.id;
      initAudio();
      sfx.blip();
      renderCreator();
    });
    speciesGridEl.appendChild(btn);
    drawPetThumb(btn.querySelector('canvas').getContext('2d'), {
      species: sp.id,
      tint: draft.tint,
      stage: 0,
    });
  }

  tintRowEl.innerHTML = '';
  for (const t of TINTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `swatch${draft.tint === t.hex ? ' is-active' : ''}`;
    b.style.background = t.hex;
    b.title = t.name;
    b.setAttribute('aria-label', `${t.name} tint`);
    b.addEventListener('click', () => {
      draft.tint = t.hex;
      initAudio();
      sfx.blip();
      renderCreator();
    });
    tintRowEl.appendChild(b);
  }
}

function openCreator() {
  draft.species = state.pet ? state.pet.species : 'bunny';
  draft.tint = state.pet ? state.pet.tint : TINTS[0].hex;
  // Suggest a name that isn't the current pal's, so a new pal doesn't start
  // life looking like a duplicate of the one being archived.
  draft.name = pick(NAME_POOL.filter((n) => !state.pet || n !== state.pet.name));
  nameInput.value = draft.name;
  $('#cancel-create').hidden = !state.pet;
  renderCreator();
  onboardEl.hidden = false;
  setTab('home');
}

function startPet() {
  const typed = nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 12);
  const name = typed || pick(NAME_POOL);
  const firstPet = !state.pet;

  archiveActivePet();

  state.pet = {
    id: newId(),
    species: draft.species,
    tint: draft.tint,
    name,
    stage: 0,
    xp: 0,
    hunger: 72,
    thirst: 70,
    happiness: 76,
  };
  if (firstPet) {
    state.streak = 1;
    state.lastActionAt = Date.now();
  }

  onboardEl.hidden = true;
  anim.hopV = 62;
  react('sparkle', 1.6);
  spawnStars(10);
  speech(`${name}! Nice to meet you!`, 2400);
  initAudio();
  sfx.sparkle();
  setTab('home');
  save();
  renderAll();
}

/* ---------------- rendering: tabs ---------------- */

function setTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
}

/* ---------------- snacks ---------------- */

function attachFoodDrag(btn, id) {
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    initAudio();
    e.preventDefault();

    const ghost = document.createElement('div');
    ghost.className = 'food-ghost';
    const gc = document.createElement('canvas');
    gc.width = 32;
    gc.height = 32;
    ghost.appendChild(gc);
    document.body.appendChild(ghost);
    drawFood(gc.getContext('2d'), id, { blink: false });

    const start = { x: e.clientX, y: e.clientY };
    let moved = false;

    const place = (x, y) => {
      ghost.style.left = `${x}px`;
      ghost.style.top = `${y}px`;
    };
    const overStage = (x, y) => {
      const r = stageEl.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    place(start.x + 14, start.y);
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
      place(ev.clientX + 14, ev.clientY);
      ghost.classList.toggle('is-over', overStage(ev.clientX, ev.clientY));
    };

    const cleanup = () => {
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerup', onUp);
      btn.removeEventListener('pointercancel', onCancel);
      ghost.remove();
    };

    const onUp = (ev) => {
      const dropped = overStage(ev.clientX, ev.clientY);
      cleanup();
      if (dropped || !moved) feed(id);
    };

    const onCancel = () => cleanup();

    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerup', onUp);
    btn.addEventListener('pointercancel', onCancel);
  });
}

function buildFoodGrid() {
  foodGrid.innerHTML = '';
  FOODS.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'food';
    btn.dataset.food = f.id;
    btn.innerHTML = `
      <canvas width="32" height="32" aria-hidden="true"></canvas>
      <span class="food__name">${f.name}</span>
      <span class="food__gain">+${f.hunger} food</span>`;
    foodGrid.appendChild(btn);
    const canvas = btn.querySelector('canvas');
    foodCanvases.push({ id: f.id, ctx: canvas.getContext('2d'), phase: i * 0.8 });
    attachFoodDrag(btn, f.id);
  });
}

function drawFoodCanvases(now) {
  for (const f of foodCanvases) {
    const c = f.ctx;
    c.clearRect(0, 0, 32, 32);
    const bob = Math.sin(now / 520 + f.phase * 1.7);
    const blink = ((now / 1000 + f.phase * 2.3) % 4.2) < 0.12;
    c.save();
    c.translate(0, bob * 1.3);
    drawFood(c, f.id, { blink });
    c.restore();
  }
}

/* ---------------- scenes (swipe) ---------------- */

let suppressPetUntil = 0;

const sceneIndex = () => {
  const i = SCENES.findIndex((s) => s.id === state.scene);
  return i < 0 ? 0 : i;
};

function setScene(index) {
  const next = ((index % SCENES.length) + SCENES.length) % SCENES.length;
  state.scene = SCENES[next].id;
  renderSceneDots();
  save();
}

function cycleScene(dir) {
  initAudio();
  sfx.blip();
  setScene(sceneIndex() + dir);
  speech(SCENES[sceneIndex()].name, 1100);
}

function renderSceneDots() {
  if (!sceneDotsEl) return;
  sceneDotsEl.innerHTML = '';
  SCENES.forEach((scene, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'scene-dot' + (scene.id === state.scene ? ' is-on' : '');
    dot.title = scene.name;
    dot.setAttribute('aria-label', `Background: ${scene.name}`);
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      setScene(i);
      speech(scene.name, 1100);
    });
    sceneDotsEl.appendChild(dot);
  });
}

function wireSwipe() {
  let start = null;
  stageEl.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  stageEl.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) {
      suppressPetUntil = performance.now() + 400;
      cycleScene(dx < 0 ? 1 : -1);
    }
  });
  stageEl.addEventListener('pointercancel', () => {
    start = null;
  });
}

function currentExpression() {
  if (anim.chompT > 0) return 'chomp';
  if (anim.moodT > 0) return anim.mood;
  if (state.pet && isNeedy(state.pet)) return 'droop';
  return 'normal';
}

function drawParticles(ctx) {
  for (const p of particles) {
    const alpha = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = alpha;
    if (p.type === 'heart') drawHeart(ctx, p.x, p.y, p.size, '#ff5c8a');
    else if (p.type === 'star') drawStar(ctx, p.x, p.y, p.size, '#ffcf4d');
    else if (p.type === 'drop') {
      px(ctx, p.x, p.y, 2, 3, '#7cc6ff');
      px(ctx, p.x, p.y, 1, 1, '#e6f6ff');
    } else if (p.type === 'text') {
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color || '#c98b12';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}

function drawStage(now) {
  petCtx.clearRect(0, 0, 160, 160);
  petCtx.imageSmoothingEnabled = false;
  drawScene(petCtx, state.scene, anim.t);

  if (state.pet) {
    const expression = currentExpression();
    const chomp =
      anim.chompT > 0
        ? Math.abs(Math.sin((1.15 - anim.chompT) * 16)) * (anim.chompT > 0.2 ? 1 : anim.chompT / 0.2)
        : 0;
    const bob = Math.sin(anim.t * 2.1) * 0.9;
    const wiggleX = anim.wiggle > 0 ? Math.sin(anim.t * 42) * 2.4 : 0;

    petCtx.save();
    petCtx.translate(wiggleX, -anim.hopY + bob);
    drawPet(petCtx, state.pet, {
      t: anim.t,
      expression,
      open: anim.eyeOpen,
      chomp: expression === 'chomp' ? chomp : 0,
      equipped: state.closet.equipped,
    });
    petCtx.restore();
  }

  drawParticles(petCtx);

  if (anim.evolveT > 0) {
    const flash = Math.max(0, Math.sin((2.6 - anim.evolveT) * 9)) * (anim.evolveT / 2.6);
    petCtx.globalAlpha = Math.min(0.55, flash * 0.55);
    petCtx.fillStyle = '#fff6c8';
    petCtx.fillRect(0, 0, 160, 160);
    petCtx.globalAlpha = 1;
  }
}

/* ---------------- loop ---------------- */

function updateAnim(dt) {
  anim.t += dt;
  anim.moodT = Math.max(0, anim.moodT - dt);
  anim.chompT = Math.max(0, anim.chompT - dt);
  anim.evolveT = Math.max(0, anim.evolveT - dt);
  anim.wiggle = Math.max(0, anim.wiggle - dt);

  if (anim.hopY !== 0 || anim.hopV !== 0) {
    anim.hopY += anim.hopV * dt;
    anim.hopV -= 430 * dt;
    if (anim.hopY <= 0) {
      anim.hopY = 0;
      anim.hopV = 0;
    }
  }

  if (anim.blinkT > 0) {
    anim.blinkT = Math.max(0, anim.blinkT - dt);
    const q = 1 - anim.blinkT / 0.16;
    anim.eyeOpen = anim.blinkT === 0 ? 1 : Math.abs(Math.cos(q * Math.PI));
  } else {
    anim.nextBlink -= dt;
    if (anim.nextBlink <= 0) {
      anim.blinkT = 0.16;
      anim.nextBlink = 2 + Math.random() * 3.6;
    }
    anim.eyeOpen = 1;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.gravity) p.vy += p.gravity * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

let lastFrame = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  updateAnim(dt);
  drawStage(now);
  drawFoodCanvases(now);

  requestAnimationFrame(loop);
}

/* ---------------- decay + streak timer ---------------- */

let lastDecay = Date.now();

function startTimers() {
  setInterval(() => {
    if (!state.pet) return;
    const now = Date.now();
    const mins = Math.min(1, (now - lastDecay) / 60000);
    lastDecay = now;

    const p = state.pet;
    p.hunger = clamp(p.hunger - mins * DECAY.hunger, 0, 100);
    p.thirst = clamp(p.thirst - mins * DECAY.thirst, 0, 100);
    p.happiness = clamp(p.happiness - mins * DECAY.happiness, 0, 100);

    if (now - state.lastActionAt > STREAK_WINDOW && state.streak > 1) state.streak = 1;

    renderStats();
    renderHud();
    save();
  }, 4000);
}

/* ---------------- wiring ---------------- */

function wireEvents() {
  petCanvas.addEventListener('click', () => {
    if (performance.now() < suppressPetUntil) return;
    petAction();
  });

  wireSwipe();

  $$('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      initAudio();
      sfx.blip();
      setTab(btn.dataset.tab);
    });
  });

  $$('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      initAudio();
      sfx.blip();
      setTab(btn.dataset.go);
    });
  });

  $$('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      if (act === 'pet') petAction();
      else if (act === 'water') waterAction();
      else if (act === 'snacks') {
        initAudio();
        sfx.blip();
        setTab('snacks');
      }
    });
  });

  $('#mute-btn').addEventListener('click', () => {
    state.muted = !state.muted;
    updateMute();
    if (!state.muted) {
      initAudio();
      sfx.blip();
    }
    save();
  });

  $('#new-pet').addEventListener('click', () => {
    initAudio();
    sfx.blip();
    openCreator();
  });

  $('#start-btn').addEventListener('click', startPet);

  $('#cancel-create').addEventListener('click', () => {
    onboardEl.hidden = true;
    sfx.blip();
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startPet();
  });

  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushSave();
  });
}

/* ---------------- boot ---------------- */

function init() {
  const hadSave = loadState();

  if (hadSave && state.pet) {
    const mins = clamp((Date.now() - state.savedAt) / 60000, 0, 240);
    state.pet.hunger = clamp(state.pet.hunger - mins * DECAY.hunger, 0, 100);
    state.pet.thirst = clamp(state.pet.thirst - mins * DECAY.thirst, 0, 100);
    state.pet.happiness = clamp(state.pet.happiness - mins * DECAY.happiness, 0, 100);
    if (Date.now() - state.lastActionAt > STREAK_WINDOW) state.streak = 1;
  }

  drawIcon($('#ico-coin').getContext('2d'), 'coin');
  drawIcon($('#ico-flame').getContext('2d'), 'flame');
  $$('[data-icon]').forEach((c) => drawIcon(c.getContext('2d'), c.dataset.icon));

  buildFoodGrid();
  wireEvents();
  updateMute();
  renderAll();

  if (state.pet) {
    setTab('home');
    renderCare();
    speech(`${state.pet.name} missed you!`, 2200);
  } else {
    openCreator();
  }

  startTimers();
  requestAnimationFrame(loop);
}

init();
