"use strict";
/*
 * Gains Gym — an arcade-idle gym tycoon (Monkey Mart / Voodoo "arcade idle" style).
 *
 * Walk with the joystick (drag anywhere, or WASD / arrows).
 *  - Stand on the TOWEL SHELF zone: towels stack on your back. Walk to a machine's
 *    zone to drop them; members need a clean towel to work out.
 *  - Stand at the FRONT DESK to check members in (they pay a membership fee).
 *  - Finished workouts leave cash at the machine; walk over it to collect.
 *  - Stand on a price pad: your cash drains into it and builds the next thing.
 *  - Shake bar: carry shakes from the blender to the counter, members buy them.
 *  - Hire staff to automate jobs, buy upgrades, then open a bigger gym.
 */

// ------------------------------------------------------------------ helpers
const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return "£" + n;
  if (n < 1e6) return "£" + (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "K";
  return "£" + (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace(/\.0+$/, "") + "M";
}

// ------------------------------------------------------------------ world data
const ROOM = { w: 432, h: 760 };
const DOOR = { x: 372, y: 806 };
const ZONE_R = 26;

const GYMS = [
  { name: "Garage Gains", mult: 1, floor: "#efe8da", tile: "#e6dece", wall: "#4b5070", mat: "#d6deec" },
  { name: "Iron Temple", mult: 6, floor: "#e6edf5", tile: "#dae2ee", wall: "#3a4a5e", mat: "#f4dccb" },
  { name: "Muscle Palace", mult: 36, floor: "#f4e9f1", tile: "#ecdbe7", wall: "#5b3f66", mat: "#d6eedb" },
];
function gymInfo(i) {
  if (i < GYMS.length) return GYMS[i];
  const g = GYMS[GYMS.length - 1], extra = i - GYMS.length + 2;
  return { ...g, name: `${g.name} ${["", "", "II", "III", "IV", "V", "VI", "VII"][extra] || extra}`, mult: g.mult * Math.pow(6, extra - 1) };
}

const MTYPES = {
  bench: { name: "Bench Press", pay: 4, time: 4.0, color: "#3d8bff" },
  tread: { name: "Treadmill", pay: 5, time: 4.5, color: "#2fbf71" },
  squat: { name: "Squat Rack", pay: 7, time: 5.0, color: "#ff7a3d" },
  dumb: { name: "Dumbbells", pay: 9, time: 5.0, color: "#a65cff" },
  bag: { name: "Boxing Bag", pay: 12, time: 5.5, color: "#ff5a6e" },
};
// where members stand to use each machine; the towel drop zone is just below it
const SLOTS = [
  { type: "bench", x: 84, y: 120 }, { type: "bench", x: 216, y: 120 }, { type: "tread", x: 348, y: 120 },
  { type: "tread", x: 348, y: 250 }, { type: "squat", x: 84, y: 250 }, { type: "squat", x: 216, y: 250 },
  { type: "dumb", x: 84, y: 380 }, { type: "bag", x: 216, y: 380 },
];
const SHELF = { x: 30, y: 520, zx: 82, zy: 520 };
const BIN = { x: 200, y: 520 };
const MAKER = { x: 396, y: 410, zx: 344, zy: 410 };
const COUNTER = { x: 396, y: 555, zx: 344, zy: 520, cx: 396, cy: 612 };
const COUNTER_Q = [[332, 585], [292, 600], [252, 610], [212, 615]];
const DESK = { x: 100, y: 652, zx: 100, zy: 704, cx: 168, cy: 660 };
const DESK_Q = [[100, 608], [142, 604], [184, 604], [226, 606], [268, 610]];
const LOBBY = [[262, 690], [302, 700], [262, 730], [302, 735], [222, 720]];

// The build order. Two pads are offered at a time.
const UNLOCKS = [
  { id: "m1", kind: "machine", slot: 1, cost: 10 },
  { id: "m2", kind: "machine", slot: 2, cost: 25 },
  { id: "shake", kind: "shake", cost: 60, x: COUNTER.zx, y: COUNTER.zy - 8 },
  { id: "m3", kind: "machine", slot: 3, cost: 100 },
  { id: "recep", kind: "hire", role: "recep", cost: 150, x: 34, y: 700, label: "Receptionist" },
  { id: "m4", kind: "machine", slot: 4, cost: 220 },
  { id: "towel", kind: "hire", role: "towel", cost: 300, x: 140, y: 470, label: "Towel staff" },
  { id: "m5", kind: "machine", slot: 5, cost: 400 },
  { id: "m6", kind: "machine", slot: 6, cost: 550 },
  { id: "barista", kind: "hire", role: "barista", cost: 700, x: 290, y: 470, label: "Barista" },
  { id: "m7", kind: "machine", slot: 7, cost: 900 },
  { id: "next", kind: "next", cost: 2000, x: 216, y: 470 },
];
for (const u of UNLOCKS) if (u.kind === "machine") { u.x = SLOTS[u.slot].x; u.y = SLOTS[u.slot].y; }

const UPGRADES = [
  { key: "speed", name: "Run Speed", icon: "👟", desc: "Move faster", max: 5, base: 35 },
  { key: "stack", name: "Big Arms", icon: "💪", desc: "Carry more", max: 5, base: 45 },
  { key: "price", name: "Membership Fees", icon: "💷", desc: "+25% on everything", max: 5, base: 80 },
  { key: "workout", name: "Better Kit", icon: "⚙️", desc: "Faster workouts", max: 5, base: 60 },
  { key: "staff", name: "Staff Training", icon: "🧢", desc: "Staff move & carry more", max: 4, base: 160, needsStaff: true },
];
const upCost = (u, lvl) => Math.round(u.base * Math.pow(2.1, lvl) * G.info.mult);

// ------------------------------------------------------------------ save
const SAVE_KEY = "gainsgym.v1";
function freshGym() { return { built: ["m0"], up: { speed: 0, stack: 0, price: 0, workout: 0, staff: 0 } }; }
function freshSave() { return { v: 1, cash: 10, gym: 0, g: freshGym(), muted: false, lastSeen: 0, rate: 0, total: 0, moved: false }; }
let save = (() => {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) return Object.assign(freshSave(), s); } catch (e) {}
  return freshSave();
})();
function persist() { save.lastSeen = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ------------------------------------------------------------------ audio (soft)
const Snd = {
  ctx: null, out: null, paused: false,
  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended" && !this.paused) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
    this.out = c.createGain(); this.out.gain.value = save.muted ? 0 : 0.5;
    this.out.connect(lp); lp.connect(c.destination);
  },
  mute(m) { save.muted = m; persist(); if (this.out) this.out.gain.value = m ? 0 : 0.5; },
  pause() { this.paused = true; if (this.ctx) this.ctx.suspend(); },
  resume() { this.paused = false; if (this.ctx) this.ctx.resume(); },
  tone(f, d, g, type = "sine", delay = 0) {
    if (!this.ctx || save.muted) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), a = this.ctx.createGain();
    o.type = type; o.frequency.value = f;
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(a); a.connect(this.out); o.start(t); o.stop(t + d + 0.05);
  },
  last: {},
  limited(key, gap, fn) { const n = performance.now(); if (n - (this.last[key] || 0) < gap) return; this.last[key] = n; fn(); },
  pickup(i) { this.limited("p", 55, () => this.tone(520 + (i % 6) * 40, 0.09, 0.07, "triangle")); },
  drop(i) { this.limited("d", 55, () => this.tone(440 - (i % 6) * 25, 0.09, 0.07, "triangle")); },
  cash() { this.limited("c", 45, () => { this.tone(880, 0.07, 0.05); this.tone(1175, 0.09, 0.04, "sine", 0.03); }); },
  pay() { this.limited("pay", 70, () => this.tone(330, 0.06, 0.05, "triangle")); },
  build() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 0.09, "sine", i * 0.07)); },
  ding() { this.tone(784, 0.2, 0.07); },
  angry() { this.tone(220, 0.25, 0.06, "triangle"); },
};

// ------------------------------------------------------------------ canvas
const cv = $("c"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; }
addEventListener("resize", resize); resize();

// ------------------------------------------------------------------ game state
let G;
const SKINS = ["#f5d0b5", "#e8b896", "#c98e6a", "#9c6644", "#6f4630", "#f1c7a6"];
const HAIR = ["#2b1d14", "#5a3a22", "#d9a441", "#111", "#8a4b2a", "#c7c7c7"];
const SHIRTS = ["#ff7a3d", "#3d8bff", "#2fbf71", "#a65cff", "#ffc531", "#1fb5c9", "#8bc34a", "#6d7cff"];   // no red: red is YOU

function buildGym() {
  const info = gymInfo(save.gym);
  G = {
    info, t: 0,
    player: { x: 216, y: 560, stack: [], face: 1, bob: 0, moving: false },
    machines: [], members: [], staff: [], deskQ: [], counterQ: [], lobby: [],
    shelf: { towels: 6, t: 0 }, maker: { shakes: 0, t: 0 }, counter: { shakes: 0 },
    deskCash: pile(DESK.cx, DESK.cy), counterCash: pile(COUNTER.cx, COUNTER.cy),
    shakeBuilt: false, spawnT: 1.5, deskT: 0,
    fly: [], texts: [], confetti: [], pads: [],
    xfer: 0, padT: 0, boostT: 0, boostOfferT: 50, income: 0, incomeT: 0,
    cam: { x: 216, y: 560, z: 1 },
  };
  for (const id of save.g.built) applyUnlock(id, true);
  refreshPads();
  updateHud();
}
function pile(x, y) { return { x, y, amt: 0, n: 0 }; }
function addMachine(slot) {
  const s = SLOTS[slot], ty = MTYPES[s.type];
  G.machines.push({ slot, type: s.type, ...ty, x: s.x, y: s.y, zx: s.x, zy: s.y + 48, towels: 2, user: null, cash: pile(s.x + 42, s.y + 12) });
}
function applyUnlock(id, silent) {
  if (id === "m0") return addMachine(0);
  const u = UNLOCKS.find((u) => u.id === id);
  if (!u) return;
  if (u.kind === "machine") addMachine(u.slot);
  if (u.kind === "shake") { G.shakeBuilt = true; G.maker.shakes = 3; }
  if (u.kind === "hire") G.staff.push(makeStaff(u.role));
  if (!silent) {
    Snd.build();
    burst(u.x, u.y, 26);
    floatText(u.x, u.y - 40, u.kind === "hire" ? `${u.label} hired!` : u.kind === "shake" ? "Shake Bar open!" : `${MTYPES[SLOTS[u.slot].type].name}!`, "#2b2e45");
  }
}
function refreshPads() {
  G.pads = [];
  for (const u of UNLOCKS) {
    if (save.g.built.includes(u.id)) continue;
    G.pads.push({ ...u, cost: Math.round(u.cost * G.info.mult), paid: (save.g.paid && save.g.paid[u.id]) || 0 });
    if (G.pads.length === 2) break;
  }
}
const builtCount = () => save.g.built.length - 1;
const hasStaff = (role) => G.staff.some((s) => s.role === role);

// ------------------------------------------------------------------ stats from upgrades
const up = (k) => save.g.up[k];
const playerSpeed = () => 150 * (1 + 0.14 * up("speed"));
const playerCap = () => 4 + 2 * up("stack");
const priceMult = () => G.info.mult * (1 + 0.25 * up("price")) * (G.boostT > 0 ? 2 : 1);
const workoutMult = () => 1 - 0.11 * up("workout");
const staffSpeed = () => 95 * (1 + 0.15 * up("staff"));
const staffCap = () => 3 + up("staff");

// ------------------------------------------------------------------ people
function makeMember() {
  return { x: DOOR.x + rand(-10, 10), y: DOOR.y, tx: DOOR.x, ty: DOOR.y, speed: rand(70, 90), state: "toDesk",
    shirt: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIR), bob: rand(0, 6), patience: 40, bubble: null, mood: 0, machine: null, doneT: 0, face: 1 };
}
function makeStaff(role) {
  const home = role === "recep" ? [DESK.zx, DESK.zy] : role === "towel" ? [SHELF.zx, SHELF.zy] : [MAKER.zx, MAKER.zy];
  return { role, x: home[0], y: home[1] + 30, tx: home[0], ty: home[1], stack: [], state: "toSource", wait: 0, bob: 0, face: 1,
    shirt: role === "recep" ? "#2b2e45" : role === "towel" ? "#1fb5c9" : "#ff8fc7", skin: pick(SKINS), hair: pick(HAIR), cap: true, xfer: 0 };
}
function walk(p, speed, dt) {
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
  if (d < 1.5) { p.x = p.tx; p.y = p.ty; p.moving = false; return true; }
  const s = Math.min(d, speed * dt);
  p.x += dx / d * s; p.y += dy / d * s; p.moving = true;
  if (Math.abs(dx) > 0.5) p.face = dx > 0 ? 1 : -1;
  p.bob += dt * 12;
  return false;
}

// ------------------------------------------------------------------ input (virtual joystick + keys)
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
const keys = {};
cv.addEventListener("pointerdown", (e) => {
  e.preventDefault(); Snd.ensure();
  joy.active = true; joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener("pointermove", (e) => { if (joy.active && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
const endJoy = (e) => { if (e.pointerId === joy.id) { joy.active = false; joy.id = null; } };
cv.addEventListener("pointerup", endJoy); cv.addEventListener("pointercancel", endJoy);
addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true; Snd.ensure();
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
function inputVec() {
  let x = 0, y = 0;
  if (keys["arrowleft"] || keys["a"]) x -= 1;
  if (keys["arrowright"] || keys["d"]) x += 1;
  if (keys["arrowup"] || keys["w"]) y -= 1;
  if (keys["arrowdown"] || keys["s"]) y += 1;
  if (x || y) { const d = Math.hypot(x, y); return [x / d, y / d]; }
  if (joy.active) {
    let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const d = Math.hypot(dx, dy);
    if (d < 6) return [0, 0];
    const maxR = 50;
    if (d > maxR) { joy.ox = joy.x - dx / d * maxR; joy.oy = joy.y - dy / d * maxR; dx = joy.x - joy.ox; dy = joy.y - joy.oy; }
    const m = Math.min(1, d / 28);
    return [dx / Math.hypot(dx, dy) * m, dy / Math.hypot(dx, dy) * m];
  }
  return [0, 0];
}

// ------------------------------------------------------------------ effects
function floatText(x, y, text, col = "#2fbf71", size = 15) { G.texts.push({ x, y, text, col, size, life: 1.2 }); }
function burst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(80, 220);
    G.confetti.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: rand(0.7, 1.3), col: pick(SHIRTS), r: rand(2, 4) });
  }
}
function flyItem(type, x0, y0, x1, y1, delay = 0) { G.fly.push({ type, x0, y0, x1, y1, t: -delay, dur: 0.26 }); }

// ------------------------------------------------------------------ economy
function payInto(p, base, x, y) {
  const amt = base * priceMult();
  p.amt += amt; p.n = Math.min(14, p.n + 1);
  floatText(x, y - 30, "+" + fmt(amt), "#2fbf71");
}
function collect(p) {
  if (p.amt <= 0) return;
  const n = Math.max(1, Math.min(8, p.n));
  for (let i = 0; i < n; i++) flyItem("cash", p.x, p.y - i * 3, 0, 0, i * 0.03);
  save.cash += p.amt; save.total += p.amt; G.income += p.amt;
  p.amt = 0; p.n = 0;
  Snd.cash();
  updateHud();
}

// ------------------------------------------------------------------ update
let started = false;
function startPlay() {
  if (started) return; started = true;
  $("title").style.opacity = 0; setTimeout(() => $("title").classList.add("hidden"), 400);
  save.moved = true; persist();
  PokiSDK.gameplayStart();
}

function update(dt) {
  G.t += dt;
  const P = G.player;
  // --- player movement
  const [vx, vy] = modalOpen ? [0, 0] : inputVec();
  if (vx || vy) {
    startPlay();
    const sp = playerSpeed();
    P.x = clamp(P.x + vx * sp * dt, 16, ROOM.w - 16);
    P.y = clamp(P.y + vy * sp * dt, 22, ROOM.h - 14);
    if (Math.abs(vx) > 0.1) P.face = vx > 0 ? 1 : -1;
    P.bob += dt * 14; P.moving = true;
  } else P.moving = false;

  // --- production
  G.shelf.t += dt;
  if (G.shelf.t > 0.9 && G.shelf.towels < 12) { G.shelf.t = 0; G.shelf.towels++; }
  if (G.shakeBuilt) { G.maker.t += dt; if (G.maker.t > 1.4 && G.maker.shakes < 8) { G.maker.t = 0; G.maker.shakes++; } }

  // --- player interactions (one item every ~0.08s)
  G.xfer -= dt;
  const near = (x, y, r = ZONE_R + 6) => dist(P.x, P.y, x, y) < r;
  if (G.xfer <= 0) {
    const top = P.stack[P.stack.length - 1];
    if (near(SHELF.zx, SHELF.zy) && G.shelf.towels > 0 && (!top || top === "towel") && P.stack.length < playerCap()) {
      G.shelf.towels--; P.stack.push("towel"); flyItem("towel", SHELF.x + 10, SHELF.y, P.x, P.y - 40); Snd.pickup(P.stack.length); G.xfer = 0.08;
    } else if (G.shakeBuilt && near(MAKER.zx, MAKER.zy) && G.maker.shakes > 0 && (!top || top === "shake") && P.stack.length < playerCap()) {
      G.maker.shakes--; P.stack.push("shake"); flyItem("shake", MAKER.x, MAKER.y, P.x, P.y - 40); Snd.pickup(P.stack.length); G.xfer = 0.08;
    } else if (top === "towel") {
      const m = G.machines.find((m) => near(m.zx, m.zy) && m.towels < 3);
      if (m) { P.stack.pop(); m.towels++; flyItem("towel", P.x, P.y - 40, m.x, m.y); Snd.drop(m.towels); G.xfer = 0.1; }
    } else if (top === "shake" && G.shakeBuilt && near(COUNTER.zx, COUNTER.zy) && G.counter.shakes < 8) {
      P.stack.pop(); G.counter.shakes++; flyItem("shake", P.x, P.y - 40, COUNTER.x, COUNTER.y); Snd.drop(G.counter.shakes); G.xfer = 0.1;
    }
    if (top && near(BIN.x, BIN.y, 24) && G.xfer <= 0) { P.stack.pop(); flyItem(top, P.x, P.y - 40, BIN.x, BIN.y); G.xfer = 0.06; }
  }
  // --- cash
  for (const m of G.machines) if (near(m.cash.x, m.cash.y, 40)) collect(m.cash);
  if (near(G.deskCash.x, G.deskCash.y, 40)) collect(G.deskCash);
  if (near(G.counterCash.x, G.counterCash.y, 40)) collect(G.counterCash);

  // --- build pads: stand on one and your cash drains into it
  // a short dwell before paying, so walking across a pad on the way somewhere doesn't fund it
  G.padT -= dt;
  for (const pad of G.pads) {
    if (!near(pad.x, pad.y, 30)) { pad.dwell = 0; continue; }
    pad.dwell = (pad.dwell || 0) + dt;
    if (pad.dwell < 0.35 || save.cash < 1) continue;
    const rate = Math.max(pad.cost / 1.4, 20) * dt;
    const amt = Math.min(rate, save.cash, pad.cost - pad.paid);
    save.cash -= amt; pad.paid += amt;
    (save.g.paid = save.g.paid || {})[pad.id] = pad.paid;
    if (G.padT <= 0) { flyItem("cash", P.x, P.y - 30, pad.x, pad.y); Snd.pay(); G.padT = 0.07; }
    if (pad.paid >= pad.cost - 0.01) {
      if (pad.kind === "next") { openNextGym(); return; }
      save.g.built.push(pad.id); delete save.g.paid[pad.id];
      applyUnlock(pad.id); refreshPads(); persist();
    }
    updateHud();
  }

  // --- members
  const staffAtDesk = near(DESK.zx, DESK.zy, ZONE_R + 8) || hasStaff("recep");
  const maxMembers = 3 + G.machines.length * 2;
  G.spawnT -= dt;
  if (G.spawnT <= 0 && G.members.length < maxMembers && G.deskQ.length < DESK_Q.length) {
    G.spawnT = Math.max(1.4, 6.5 - G.machines.length * 0.6) * rand(0.8, 1.2);
    const m = makeMember(); G.members.push(m); G.deskQ.push(m);
  }
  // desk check-in
  G.deskQ.forEach((m, i) => { m.tx = DESK_Q[i][0]; m.ty = DESK_Q[i][1]; });
  const front = G.deskQ[0];
  if (front && dist(front.x, front.y, DESK_Q[0][0], DESK_Q[0][1]) < 3 && staffAtDesk) {
    G.deskT += dt;
    if (G.deskT > 0.55) {
      G.deskT = 0; G.deskQ.shift();
      payInto(G.deskCash, 3, DESK.x, DESK.y); Snd.ding();
      front.state = "findMachine"; front.patience = 40;
    }
  } else G.deskT = 0;
  // counter queue
  G.counterQ.forEach((m, i) => { const q = COUNTER_Q[Math.min(i, COUNTER_Q.length - 1)]; m.tx = q[0]; m.ty = q[1] + (i >= COUNTER_Q.length ? 14 * (i - COUNTER_Q.length + 1) : 0); });
  const cf = G.counterQ[0];
  if (cf && dist(cf.x, cf.y, COUNTER_Q[0][0], COUNTER_Q[0][1]) < 3) {
    if (G.counter.shakes > 0) {
      cf.doneT += dt; cf.bubble = null;
      if (cf.doneT > 0.4) {
        G.counter.shakes--; G.counterQ.shift(); cf.holding = "shake";
        payInto(G.counterCash, 6, COUNTER.x, COUNTER.y); Snd.ding();
        leave(cf, true);
      }
    } else cf.bubble = "shake";
  }

  for (const m of G.members) updateMember(m, dt);
  G.members = G.members.filter((m) => !m.gone);
  for (const s of G.staff) updateStaff(s, dt);

  // --- boost + offers
  if (G.boostT > 0) { G.boostT -= dt; $("boostLeft").textContent = Math.ceil(G.boostT); if (G.boostT <= 0) $("boostTimer").classList.add("hidden"); }
  G.boostOfferT -= dt;
  if (started && G.boostOfferT <= 0 && G.boostT <= 0) { $("boostBtn").classList.remove("hidden"); G.boostOfferT = 1e9; }

  // --- income rate (for offline earnings)
  G.incomeT += dt;
  if (G.incomeT >= 10) { const r = G.income / G.incomeT; save.rate = save.rate ? save.rate * 0.7 + r * 0.3 : r; G.income = 0; G.incomeT = 0; }

  // --- effects
  for (const f of G.fly) f.t += dt;
  G.fly = G.fly.filter((f) => f.t < f.dur);
  for (const t of G.texts) { t.y -= 34 * dt; t.life -= dt; }
  G.texts = G.texts.filter((t) => t.life > 0);
  for (const c of G.confetti) { c.vy += 420 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt; }
  G.confetti = G.confetti.filter((c) => c.life > 0);

  // --- camera
  // close follow-cam (characters stay big on phones); shows the whole room only on big screens
  const z = clamp(Math.min(W / 330, H / 580), 0.7, 2.4);
  G.cam.z = z;
  const halfW = W / z / 2, halfH = H / z / 2;
  const tx = ROOM.w + 40 <= halfW * 2 ? ROOM.w / 2 : clamp(P.x, halfW - 24, ROOM.w - halfW + 24);
  const ty = ROOM.h + 150 <= halfH * 2 ? ROOM.h / 2 - 10 : clamp(P.y - 20, halfH - 70, ROOM.h - halfH + 70);
  const k = 1 - Math.exp(-dt * 6);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
}

function leave(m, happy) {
  if (m.machine) { m.machine.user = null; m.machine = null; }
  G.deskQ = G.deskQ.filter((x) => x !== m);
  G.counterQ = G.counterQ.filter((x) => x !== m);
  m.state = "leave"; m.tx = DOOR.x + rand(-8, 8); m.ty = DOOR.y; m.bubble = happy ? null : "angry"; m.mood = happy ? 1 : -1;
  if (!happy) { Snd.angry(); G.lost = (G.lost || 0) + 1; }
}

function updateMember(m, dt) {
  const arrived = walk(m, m.speed, dt);
  const waiting = m.state === "toDesk" || m.state === "lobby" || m.state === "needTowel" || m.state === "shakeQ";
  if (waiting && arrived) {
    m.patience -= dt;
    if (m.state === "toDesk" && G.deskQ[0] === m) m.bubble = (G.player && dist(G.player.x, G.player.y, DESK.zx, DESK.zy) < ZONE_R + 8) || hasStaff("recep") ? null : "desk";
    if (m.patience <= 0) { leave(m, false); return; }
  }
  if (m.state === "findMachine" || (m.state === "lobby" && (m.retry = (m.retry || 0) - dt) <= 0)) {
    const free = G.machines.filter((x) => !x.user);
    if (free.length) {
      const withTowels = free.filter((x) => x.towels > 0);
      const mc = pick(withTowels.length ? withTowels : free);
      mc.user = m; m.machine = mc; m.state = "toMachine"; m.tx = mc.x; m.ty = mc.y; m.bubble = null;
    } else {
      if (m.state !== "lobby") { const spot = LOBBY[G.members.indexOf(m) % LOBBY.length]; m.tx = spot[0] + rand(-6, 6); m.ty = spot[1]; m.state = "lobby"; }
      m.retry = 0.5;
    }
  }
  if (m.state === "toMachine" && dist(m.x, m.y, m.machine.x, m.machine.y) < 2) { m.state = "needTowel"; m.patience = Math.max(m.patience, 30); }
  if (m.state === "needTowel") {
    if (m.machine.towels > 0) { m.machine.towels--; m.state = "workout"; m.doneT = m.machine.time * workoutMult(); m.bubble = null; }
    else m.bubble = "towel";
  }
  if (m.state === "workout") {
    m.doneT -= dt; m.bob += dt * 10;
    if (m.doneT <= 0) {
      const mc = m.machine;
      payInto(mc.cash, mc.pay, mc.x, mc.y);
      mc.user = null; m.machine = null;
      if (G.shakeBuilt && Math.random() < 0.6 && G.counterQ.length < 7) { m.state = "shakeQ"; m.patience = 35; m.doneT = 0; G.counterQ.push(m); }
      else leave(m, true);
    }
  }
  if (m.state === "leave" && arrived) m.gone = true;
}

function updateStaff(s, dt) {
  const sp = staffSpeed();
  if (s.role === "recep") { s.tx = DESK.zx; s.ty = DESK.zy; walk(s, sp, dt); return; }
  const towel = s.role === "towel";
  const src = towel ? { x: SHELF.zx, y: SHELF.zy } : { x: MAKER.zx, y: MAKER.zy };
  const item = towel ? "towel" : "shake";
  if (!towel && !G.shakeBuilt) return;
  const arrived = walk(s, sp, dt);
  s.xfer -= dt;
  if (s.state === "toSource") {
    s.tx = src.x + 10; s.ty = src.y + 8;
    if (arrived) {
      const store = towel ? G.shelf : G.maker, key = towel ? "towels" : "shakes";
      if (s.xfer <= 0 && store[key] > 0 && s.stack.length < staffCap()) { store[key]--; s.stack.push(item); s.xfer = 0.15; Snd.pickup(s.stack.length); }
      s.wait += dt;
      if (s.stack.length >= staffCap() || (s.stack.length && s.wait > 1.5)) { s.wait = 0; s.state = "deliver"; s.target = null; }
    }
  }
  if (s.state === "deliver") {
    if (!s.target) {
      if (towel) {
        const needy = G.machines.filter((m) => m.towels < 3).sort((a, b) => a.towels - b.towels);
        s.target = needy[0] ? { x: needy[0].zx + 12, y: needy[0].zy + 6, m: needy[0] } : null;
      } else s.target = G.counter.shakes < 8 ? { x: COUNTER.zx + 12, y: COUNTER.zy + 8 } : null;
      if (!s.target) return;
      s.tx = s.target.x; s.ty = s.target.y;
    }
    if (arrived && s.xfer <= 0) {
      if (towel) {
        const m = s.target.m;
        if (m.towels < 3 && s.stack.length) { s.stack.pop(); m.towels++; s.xfer = 0.15; }
        else s.target = null;
      } else if (G.counter.shakes < 8 && s.stack.length) { s.stack.pop(); G.counter.shakes++; s.xfer = 0.15; }
      else s.target = null;
      if (!s.stack.length) { s.state = "toSource"; s.target = null; }
    }
  }
}

// ------------------------------------------------------------------ tutorial arrow
function goal() {
  const P = G.player;
  if (builtCount() >= 4) {
    const pad = G.pads.find((p) => save.cash >= p.cost - p.paid);
    return pad && dist(P.x, P.y, pad.x, pad.y) > 40 ? [pad.x, pad.y] : null;
  }
  const top = P.stack[P.stack.length - 1];
  if (top === "towel") { const m = G.machines.filter((m) => m.towels < 3).sort((a, b) => a.towels - b.towels)[0]; if (m) return [m.zx, m.zy]; }
  if (top === "shake") return [COUNTER.zx, COUNTER.zy];
  if (G.deskQ[0] && !hasStaff("recep") && dist(P.x, P.y, DESK.zx, DESK.zy) > ZONE_R && G.deskQ[0].bubble) return [DESK.zx, DESK.zy];
  const dry = G.machines.find((m) => m.towels === 0);
  if (dry && !top) return [SHELF.zx, SHELF.zy];
  if (G.shakeBuilt && G.counter.shakes === 0 && G.counterQ.length && !top) return [MAKER.zx, MAKER.zy];
  const piles = [G.deskCash, G.counterCash, ...G.machines.map((m) => m.cash)].filter((p) => p.amt > 0).sort((a, b) => b.amt - a.amt);
  const pad = G.pads.find((p) => save.cash >= p.cost - p.paid);
  if (pad) return [pad.x, pad.y];
  if (piles[0]) return [piles[0].x, piles[0].y];
  return null;
}

// ------------------------------------------------------------------ drawing
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function box(x, y, w, h, top, side, r = 6, depth = 8) {
  ctx.fillStyle = side; rr(x, y + depth, w, h, r); ctx.fill();
  ctx.fillStyle = top; rr(x, y, w, h, r); ctx.fill();
}
function shadow(x, y, rx, ry = rx * 0.45) { ctx.fillStyle = "rgba(30,25,40,.16)"; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }

function drawItem(type, x, y, s = 1) {
  if (type === "towel") {
    ctx.fillStyle = "#c9e4ff"; rr(x - 9 * s, y - 3 * s, 18 * s, 7 * s, 2 * s); ctx.fill();
    ctx.fillStyle = "#ffffff"; rr(x - 9 * s, y - 5 * s, 18 * s, 6 * s, 2 * s); ctx.fill();
    ctx.fillStyle = "#3d8bff"; ctx.fillRect(x - 9 * s, y - 2 * s, 18 * s, 1.5 * s);
  } else if (type === "shake") {
    ctx.fillStyle = "#ff8fc7"; ctx.beginPath(); ctx.moveTo(x - 6 * s, y - 9 * s); ctx.lineTo(x + 6 * s, y - 9 * s); ctx.lineTo(x + 4 * s, y + 4 * s); ctx.lineTo(x - 4 * s, y + 4 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(x - 7 * s, y - 11 * s, 14 * s, 3 * s);
    ctx.fillStyle = "#2b2e45"; ctx.fillRect(x + 1 * s, y - 16 * s, 1.6 * s, 6 * s);
  } else if (type === "cash") {
    ctx.fillStyle = "#1f9a58"; rr(x - 9 * s, y - 4 * s, 18 * s, 9 * s, 2 * s); ctx.fill();
    ctx.fillStyle = "#2fbf71"; rr(x - 9 * s, y - 5 * s, 18 * s, 8 * s, 2 * s); ctx.fill();
    ctx.fillStyle = "#c8f5d9"; ctx.beginPath(); ctx.arc(x, y - 1 * s, 2.4 * s, 0, TAU); ctx.fill();
  }
}

function drawPerson(p, opts = {}) {
  const walkB = p.moving ? Math.sin(p.bob) : 0;
  const workB = opts.working ? Math.sin(p.bob * 1.4) * 2.5 : 0;
  const x = p.x, y = p.y;
  const sc = opts.scale || 1;
  if (opts.you) { ctx.strokeStyle = "#ffc531"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 2, 17, 8, 0, 0, TAU); ctx.stroke(); }
  shadow(x, y + 2, 11 * sc);
  // legs
  ctx.fillStyle = opts.pants || "#2b2e45";
  ctx.fillRect(x - 6 * sc, y - 10 * sc - walkB * 2, 5 * sc, 10 * sc + walkB * 2);
  ctx.fillRect(x + 1 * sc, y - 10 * sc + walkB * 2, 5 * sc, 10 * sc - walkB * 2);
  // body
  const by = y - 26 * sc - Math.abs(walkB) * 1.5 + workB;
  ctx.fillStyle = p.shirt; rr(x - 9 * sc, by, 18 * sc, 18 * sc, 6 * sc); ctx.fill();
  // arms
  ctx.fillStyle = p.skin;
  if (opts.carry) { ctx.fillRect(x - 11 * sc, by + 2, 4 * sc, 9 * sc); ctx.fillRect(x + 7 * sc, by + 2, 4 * sc, 9 * sc); }
  else { ctx.fillRect(x - 12 * sc, by + 3 + walkB * 2, 4 * sc, 11 * sc); ctx.fillRect(x + 8 * sc, by + 3 - walkB * 2, 4 * sc, 11 * sc); }
  // head
  const hy = by - 10 * sc;
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(x, hy, 9 * sc, 0, TAU); ctx.fill();
  ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(x, hy - 2 * sc, 9 * sc, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  if (p.cap) { ctx.fillStyle = opts.capCol || "#ff5a6e"; ctx.beginPath(); ctx.arc(x, hy - 3 * sc, 9.5 * sc, Math.PI, TAU); ctx.fill(); ctx.fillRect(x + (p.face > 0 ? 2 : -13) * sc, hy - 4 * sc, 11 * sc, 3 * sc); }
  // eyes
  ctx.fillStyle = "#2b2e45";
  ctx.beginPath(); ctx.arc(x - 3 * sc + p.face * 1.5, hy + 1, 1.3 * sc, 0, TAU); ctx.arc(x + 3 * sc + p.face * 1.5, hy + 1, 1.3 * sc, 0, TAU); ctx.fill();
  // carried stack
  if (p.stack && p.stack.length) {
    const gap = p.stack[0] === "shake" ? 12 : 7;
    for (let i = 0; i < p.stack.length; i++) drawItem(p.stack[i], x + Math.sin(p.bob * 0.5 + i * 0.4) * (p.moving ? i * 0.25 : 0), by - 14 * sc - i * gap, sc);
  }
  if (p.holding) drawItem(p.holding, x + 10, by + 4, 0.7);
  // speech bubble
  if (p.bubble) {
    const bx = x + 14, byy = hy - 26;
    ctx.fillStyle = "#fff"; rr(bx - 14, byy - 13, 28, 24, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 8, byy + 10); ctx.lineTo(bx - 14, byy + 18); ctx.lineTo(bx - 2, byy + 10); ctx.fill();
    if (p.bubble === "towel") drawItem("towel", bx, byy + 1, 0.85);
    else if (p.bubble === "shake") drawItem("shake", bx, byy + 4, 0.75);
    else { ctx.font = "15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.bubble === "angry" ? "😠" : "🛎️", bx, byy); }
    // patience ring
    if (p.bubble !== "angry" && p.patience < 20) {
      ctx.strokeStyle = p.patience < 8 ? "#ff5a6e" : "#ffc531"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx, byy - 1, 15, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.patience / 20, 0, 1)); ctx.stroke();
    }
  }
}

function drawZone(x, y, col, active, label) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = active ? 3.5 : 2.5; ctx.globalAlpha = active ? 1 : 0.75;
  ctx.setLineDash([7, 5]); rr(x - ZONE_R, y - ZONE_R * 0.7, ZONE_R * 2, ZONE_R * 1.4, 10); ctx.stroke();
  ctx.setLineDash([]);
  if (active) { ctx.fillStyle = col; ctx.globalAlpha = 0.15; ctx.fill(); }
  ctx.restore();
}

function drawMachine(m) {
  const x = m.x, y = m.y, c = m.color;
  ctx.fillStyle = G.info.mat; rr(x - 44, y - 46, 88, 80, 12); ctx.fill();
  if (m.type === "bench") {
    box(x - 12, y - 30, 24, 46, "#3a3f58", "#23263a", 6, 5);
    ctx.fillStyle = c; rr(x - 10, y - 28, 20, 40, 5); ctx.fill();
    ctx.fillStyle = "#555b78"; ctx.fillRect(x - 34, y - 36, 68, 4);
    ctx.fillStyle = "#23263a"; ctx.fillRect(x - 36, y - 44, 8, 20); ctx.fillRect(x + 28, y - 44, 8, 20);
  } else if (m.type === "tread") {
    box(x - 20, y - 38, 40, 62, "#3a3f58", "#23263a", 8, 6);
    ctx.fillStyle = "#2b2e45"; rr(x - 15, y - 26, 30, 46, 4); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 2;
    const off = (G.t * (m.user && m.user.state === "workout" ? 60 : 0)) % 10;
    for (let k = -26 + off; k < 20; k += 10) { ctx.beginPath(); ctx.moveTo(x - 14, y + k); ctx.lineTo(x + 14, y + k); ctx.stroke(); }
    ctx.fillStyle = c; rr(x - 18, y - 44, 36, 12, 4); ctx.fill();
  } else if (m.type === "squat") {
    ctx.fillStyle = "#23263a"; ctx.fillRect(x - 30, y - 40, 7, 56); ctx.fillRect(x + 23, y - 40, 7, 56);
    ctx.fillStyle = c; ctx.fillRect(x - 32, y - 42, 11, 6); ctx.fillRect(x + 21, y - 42, 11, 6);
    ctx.fillStyle = "#555b78"; ctx.fillRect(x - 40, y - 24, 80, 4);
    ctx.fillStyle = "#23263a"; ctx.fillRect(x - 44, y - 31, 7, 18); ctx.fillRect(x + 37, y - 31, 7, 18);
  } else if (m.type === "dumb") {
    box(x - 34, y - 42, 68, 20, "#3a3f58", "#23263a", 5, 5);
    for (let k = 0; k < 4; k++) {
      const dx = x - 26 + k * 17;
      ctx.fillStyle = "#23263a"; ctx.fillRect(dx - 1, y - 36, 12, 3);
      ctx.fillStyle = c; ctx.fillRect(dx - 3, y - 39, 4, 9); ctx.fillRect(dx + 9, y - 39, 4, 9);
    }
  } else if (m.type === "bag") {
    ctx.strokeStyle = "#555b78"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 50); ctx.lineTo(x, y - 36); ctx.stroke();
    const sw = m.user && m.user.state === "workout" ? Math.sin(G.t * 9) * 4 : 0;
    box(x - 11 + sw, y - 38, 22, 36, c, "#b8394a", 10, 4);
  }
  // towel tray
  for (let k = 0; k < 3; k++) {
    if (k < m.towels) drawItem("towel", x - 24 + k * 0, y + 30 - k * 5, 0.75);
  }
  if (!m.towels) { ctx.fillStyle = "rgba(255,90,110,.9)"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("NO TOWEL", x, y + 34); }
}

function drawPile(p) {
  if (p.amt <= 0) return;
  for (let i = 0; i < Math.max(1, p.n); i++) drawItem("cash", p.x + (i % 2) * 4 - 2, p.y - i * 3.2, 0.9);
}

function drawPad(pad) {
  const x = pad.x, y = pad.y, s = 30;
  ctx.save();
  if (pad.kind === "machine") { ctx.globalAlpha = 0.35; ctx.setLineDash([6, 5]); ctx.strokeStyle = "#7c809c"; ctx.lineWidth = 2; rr(x - 44, y - 46, 88, 80, 12); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
  const afford = save.cash >= pad.cost - pad.paid;
  ctx.fillStyle = "rgba(255,255,255,.85)"; rr(x - s, y - s * 0.75, s * 2, s * 1.5, 12); ctx.fill();
  const f = pad.paid / pad.cost;
  if (f > 0) { ctx.save(); rr(x - s, y - s * 0.75, s * 2, s * 1.5, 12); ctx.clip(); ctx.fillStyle = "rgba(47,191,113,.45)"; ctx.fillRect(x - s, y + s * 0.75 - s * 1.5 * f, s * 2, s * 1.5 * f); ctx.restore(); }
  ctx.strokeStyle = afford ? "#2fbf71" : "#ffc531"; ctx.lineWidth = 3; rr(x - s, y - s * 0.75, s * 2, s * 1.5, 12); ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "16px system-ui";
  const icon = pad.kind === "machine" ? { bench: "🏋️", tread: "🏃", squat: "🦵", dumb: "💪", bag: "🥊" }[SLOTS[pad.slot].type]
    : pad.kind === "shake" ? "🥤" : pad.kind === "hire" ? "🧑‍💼" : "🏢";
  ctx.fillText(icon, x, y - 8);
  ctx.font = "900 12px system-ui"; ctx.fillStyle = "#2b2e45";
  ctx.fillText(fmt(pad.cost - pad.paid), x, y + 11);
  if (pad.kind === "hire" || pad.kind === "next") {
    ctx.font = "800 10px system-ui"; ctx.fillStyle = "#2b2e45";
    ctx.fillText(pad.kind === "next" ? "NEW GYM" : pad.label.toUpperCase(), x, y - s * 0.75 - 9);
  }
  ctx.restore();
}

function drawRoom() {
  const info = G.info;
  // floor tiles
  ctx.fillStyle = info.floor; ctx.fillRect(0, 0, ROOM.w, ROOM.h);
  ctx.fillStyle = info.tile;
  for (let y = 0; y < ROOM.h; y += 48) for (let x = (y / 48) % 2 ? 48 : 0; x < ROOM.w; x += 96) ctx.fillRect(x, y, 48, 48);
  // walls
  ctx.fillStyle = info.wall; ctx.fillRect(-16, -54, ROOM.w + 32, 54);
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(-16, -12, ROOM.w + 32, 12);
  ctx.fillStyle = info.wall; ctx.fillRect(-16, 0, 16, ROOM.h); ctx.fillRect(ROOM.w, 0, 16, ROOM.h);
  ctx.fillRect(-16, ROOM.h, 356 + 16, 14); ctx.fillRect(404, ROOM.h, ROOM.w + 16 - 404, 14);
  // gym sign on the back wall
  ctx.fillStyle = "#fff"; ctx.font = "900 20px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(info.name.toUpperCase(), ROOM.w / 2, -30);
  // door mat
  ctx.fillStyle = "#c7b9a0"; rr(342, ROOM.h - 24, 60, 22, 4); ctx.fill();
}

function drawStations() {
  const P = G.player;
  const near = (x, y) => dist(P.x, P.y, x, y) < ZONE_R + 6;
  // towel shelf
  box(SHELF.x - 22, SHELF.y - 40, 32, 70, "#8b6b4a", "#6b5038", 4, 6);
  for (let i = 0; i < Math.min(G.shelf.towels, 12); i++) drawItem("towel", SHELF.x - 6, SHELF.y + 22 - i * 5, 0.8);
  drawZone(SHELF.zx, SHELF.zy, "#3d8bff", near(SHELF.zx, SHELF.zy));
  // bin
  shadow(BIN.x, BIN.y + 8, 12); box(BIN.x - 10, BIN.y - 14, 20, 22, "#7c809c", "#555b78", 5, 4);
  // front desk
  box(DESK.x - 52, DESK.y - 16, 104, 30, "#ffc531", "#c79300", 8, 10);
  ctx.fillStyle = "#2b2e45"; ctx.font = "900 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("FRONT DESK", DESK.x, DESK.y);
  if (!hasStaff("recep")) drawZone(DESK.zx, DESK.zy, "#ffc531", near(DESK.zx, DESK.zy));
  drawPile(G.deskCash);
  // shake bar
  if (G.shakeBuilt) {
    box(MAKER.x - 18, MAKER.y - 32, 30, 56, "#ff8fc7", "#d1679f", 6, 6);
    for (let i = 0; i < G.maker.shakes; i++) drawItem("shake", MAKER.x - 3, MAKER.y + 18 - i * 6, 0.7);
    drawZone(MAKER.zx, MAKER.zy, "#ff8fc7", near(MAKER.zx, MAKER.zy));
    box(COUNTER.x - 22, COUNTER.y - 40, 34, 80, "#fff2f8", "#e2c4d4", 6, 8);
    for (let i = 0; i < G.counter.shakes; i++) drawItem("shake", COUNTER.x - 6 + (i % 2) * 8, COUNTER.y + 28 - Math.floor(i / 2) * 15, 0.75);
    drawZone(COUNTER.zx, COUNTER.zy, "#ff8fc7", near(COUNTER.zx, COUNTER.zy));
    drawPile(G.counterCash);
  }
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#2b2f45"; ctx.fillRect(0, 0, W, H);
  const c = G.cam;
  ctx.setTransform(DPR * c.z, 0, 0, DPR * c.z, DPR * (W / 2 - c.x * c.z), DPR * (H / 2 - c.y * c.z));
  drawRoom();
  drawStations();
  for (const pad of G.pads) drawPad(pad);
  for (const m of G.machines) drawZone(m.zx, m.zy, m.color, dist(G.player.x, G.player.y, m.zx, m.zy) < ZONE_R + 6);

  // depth-sorted: machines, people
  const things = [];
  for (const m of G.machines) things.push({ y: m.y - 20, d: () => drawMachine(m) });
  for (const m of G.machines) things.push({ y: m.cash.y, d: () => drawPile(m.cash) });
  for (const m of G.members) things.push({ y: m.y + (m.state === "workout" ? 1 : 0), d: () => drawPerson(m, { working: m.state === "workout" }) });
  for (const s of G.staff) things.push({ y: s.y, d: () => drawPerson(s, { carry: s.stack.length > 0, capCol: "#ffc531" }) });
  things.push({ y: G.player.y, d: () => drawPerson({ ...G.player, shirt: "#ff5a6e", skin: "#f1c7a6", hair: "#2b1d14", cap: true }, { carry: G.player.stack.length > 0, capCol: "#2b2e45", scale: 1.12, you: true }) });
  things.sort((a, b) => a.y - b.y).forEach((t) => t.d());

  // stack-full hint
  const P = G.player;
  if (P.stack.length >= playerCap()) { ctx.fillStyle = "#ff5a6e"; ctx.font = "900 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("MAX", P.x, P.y - 56 - P.stack.length * (P.stack[0] === "shake" ? 12 : 7)); }

  // flying items
  for (const f of G.fly) {
    if (f.t < 0) continue;
    const k = f.t / f.dur;
    const x1 = f.type === "cash" && f.x1 === 0 ? P.x : f.x1, y1 = f.type === "cash" && f.y1 === 0 ? P.y - 30 : f.y1;
    const x = f.x0 + (x1 - f.x0) * k, y = f.y0 + (y1 - f.y0) * k - Math.sin(k * Math.PI) * 30;
    drawItem(f.type, x, y, 0.85);
  }
  for (const cf of G.confetti) { ctx.globalAlpha = Math.min(1, cf.life * 2); ctx.fillStyle = cf.col; ctx.fillRect(cf.x - cf.r, cf.y - cf.r, cf.r * 2, cf.r * 1.3); }
  ctx.globalAlpha = 1;
  // goal arrow
  const g = started ? goal() : null;
  if (g) {
    const bounce = Math.sin(G.t * 6) * 5;
    ctx.fillStyle = "#ffc531"; ctx.strokeStyle = "#2b2e45"; ctx.lineWidth = 2.5;
    ctx.beginPath(); const ax = g[0], ay = g[1] - 38 + bounce;
    ctx.moveTo(ax - 11, ay - 14); ctx.lineTo(ax + 11, ay - 14); ctx.lineTo(ax + 11, ay - 2); ctx.lineTo(ax + 18, ay - 2); ctx.lineTo(ax, ay + 14); ctx.lineTo(ax - 18, ay - 2); ctx.lineTo(ax - 11, ay - 2); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  // floating text
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const t of G.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2); ctx.font = `900 ${t.size}px system-ui`;
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.col; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // screen space: joystick + off-screen goal pointer
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (joy.active) {
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3; ctx.stroke();
    let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const d = Math.hypot(dx, dy);
    if (d > 50) { dx = dx / d * 50; dy = dy / d * 50; }
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(joy.ox + dx, joy.oy + dy, 22, 0, TAU); ctx.fill();
  }
  if (g) {
    const sx = W / 2 + (g[0] - c.x) * c.z, sy = H / 2 + (g[1] - c.y) * c.z;
    const m = 40;
    if (sx < m || sx > W - m || sy < 90 || sy > H - 100) {
      const cx = clamp(sx, m, W - m), cy = clamp(sy, 90, H - 100);
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = "#ffc531"; ctx.strokeStyle = "#2b2e45"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------------ HUD + menus
let modalOpen = false;
function updateHud() {
  $("cash").textContent = fmt(save.cash);
  $("gymName").textContent = G.info.name;
  $("progress").style.width = `${(builtCount() / UNLOCKS.length) * 100}%`;
  const affordable = UPGRADES.some((u) => (!u.needsStaff || G.staff.length) && up(u.key) < u.max && save.cash >= upCost(u, up(u.key)));
  $("upDot").classList.toggle("hidden", !affordable);
  if (modalOpen === "up") renderUpgrades();
}
function openModal(kind, html) {
  modalOpen = kind; $("card").innerHTML = html; $("modal").classList.remove("hidden");
  joy.active = false; PokiSDK.gameplayStop();
}
function closeModal(withBreak) {
  $("modal").classList.add("hidden"); modalOpen = false;
  const resume = () => { if (started) PokiSDK.gameplayStart(); };
  if (withBreak) commercial().then(resume); else resume();
}
function renderUpgrades() {
  const rows = UPGRADES.filter((u) => !u.needsStaff || G.staff.length).map((u) => {
    const lvl = up(u.key), maxed = lvl >= u.max, cost = upCost(u, lvl);
    return `<div class="upg"><div class="ic">${u.icon}</div><div class="txt"><b>${u.name}</b><small>${u.desc}</small>
      <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</div></div>
      <button class="buy" data-k="${u.key}" ${maxed || save.cash < cost ? "disabled" : ""}>${maxed ? "MAX" : fmt(cost)}</button></div>`;
  }).join("");
  const freeable = UPGRADES.filter((u) => (!u.needsStaff || G.staff.length) && up(u.key) < u.max).sort((a, b) => upCost(a, up(a.key)) - upCost(b, up(b.key)))[0];
  $("card").innerHTML = `<h2>Upgrades</h2>${rows}
    ${freeable && !G.freeUsed ? `<button class="btn ad" id="freeUp"><span class="vid"></span> Free ${freeable.name}</button>` : ""}
    <button class="btn plain" id="closeUp">Back to the gym</button>`;
  $("card").querySelectorAll("[data-k]").forEach((b) => b.onclick = () => {
    const u = UPGRADES.find((x) => x.key === b.dataset.k), cost = upCost(u, up(u.key));
    if (save.cash < cost || up(u.key) >= u.max) return;
    save.cash -= cost; save.g.up[u.key]++; persist(); Snd.build(); updateHud();
  });
  if ($("freeUp")) $("freeUp").onclick = () => rewarded().then((ok) => { if (ok) { save.g.up[freeable.key]++; G.freeUsed = true; persist(); Snd.build(); } updateHud(); renderUpgrades(); });
  $("closeUp").onclick = () => closeModal(true);
}
$("upBtn").addEventListener("click", (e) => { e.stopPropagation(); Snd.ensure(); openModal("up", ""); renderUpgrades(); });
$("muteBtn").addEventListener("click", (e) => { e.stopPropagation(); Snd.ensure(); Snd.mute(!save.muted); syncMute(); });
function syncMute() { $("muteBtn").textContent = save.muted ? "🔇" : "🔊"; }
syncMute();
$("boostBtn").addEventListener("click", (e) => {
  e.stopPropagation(); Snd.ensure();
  rewarded().then((ok) => {
    $("boostBtn").classList.add("hidden");
    if (ok) { G.boostT = 60; $("boostTimer").classList.remove("hidden"); Snd.build(); }
    G.boostOfferT = 120;
  });
});

function openNextGym() {
  const nextInfo = gymInfo(save.gym + 1);
  openModal("next", `<div style="font-size:56px">🏢</div><h2>${nextInfo.name} unlocked!</h2>
    <p>A bigger gym with richer members: everything pays ×${nextInfo.mult / G.info.mult}.</p>
    <button class="btn" id="goNext">Open ${nextInfo.name}</button>`);
  $("goNext").onclick = () => {
    save.gym++; save.g = freshGym(); persist();
    closeModal(true);
    buildGym(); burst(216, 500, 60); Snd.build();
  };
}

function offlineEarnings() {
  if (!save.lastSeen || !save.rate) return;
  const anyStaff = save.g.built.some((id) => ["recep", "towel", "barista"].includes(id));
  if (!anyStaff) return;
  const secs = Math.min((Date.now() - save.lastSeen) / 1000, 2 * 3600);
  if (secs < 60) return;
  const amt = Math.floor(save.rate * 0.3 * secs);
  if (amt < 1) return;
  openModal("away", `<div style="font-size:52px">😴</div><h2>Welcome back!</h2><p>Your staff kept the gym running while you were away.</p>
    <div class="earn">+${fmt(amt)}</div>
    <button class="btn ad" id="away3"><span class="vid"></span> Collect ×3</button>
    <button class="btn plain" id="away1">Collect</button>`);
  const give = (m) => { save.cash += amt * m; persist(); updateHud(); Snd.cash(); closeModal(false); };
  $("away1").onclick = () => give(1);
  $("away3").onclick = () => rewarded().then((ok) => give(ok ? 3 : 1));
}

function commercial() { return PokiSDK.commercialBreak(() => Snd.pause()).then(() => Snd.resume()).catch(() => Snd.resume()); }
function rewarded() {
  PokiSDK.gameplayStop();
  return PokiSDK.rewardedBreak(() => Snd.pause()).then((ok) => { Snd.resume(); if (started && !modalOpen) PokiSDK.gameplayStart(); return !!ok; })
    .catch(() => { Snd.resume(); return false; });
}

// ------------------------------------------------------------------ loop
let last = performance.now(), saveT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!Snd.paused) {
    update(dt);
    saveT += dt; if (saveT > 4) { saveT = 0; persist(); }
    if (Math.floor(G.t * 4) !== Math.floor((G.t - dt) * 4)) updateHud();
  }
  draw();
  requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { persist(); if (Snd.ctx) Snd.ctx.suspend(); }
  else if (Snd.ctx && !Snd.paused) Snd.ctx.resume();
});

PokiSDK.init().catch(() => {}).then(() => {
  buildGym();
  if (save.moved) { $("title").classList.add("hidden"); }
  offlineEarnings();
  PokiSDK.gameLoadingFinished();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
});
