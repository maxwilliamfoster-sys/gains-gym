// Pacing harness: served temporarily as docs/_pacing.js and injected into the game page.
// A bot plays a fresh copy of gym `gymIndex` at 60 fps simulated time and logs when each
// unlock lands, so we can check the "next thing to buy" rhythm (arcade idles aim for
// ~20-60s gaps early, stretching later). Upgrades are bought greedily when affordable.
// Every gym starts with the first gym's seed cash, scaled by that gym's multiplier.
window.runPacing = function (maxMinutes = 30, buyUpgrades = true, gymIndex = 0) {
  const keep = JSON.stringify(save);
  save = freshSave(); save.gym = gymIndex; save.cash = 10 * gymInfo(gymIndex).mult; buildGym(); started = true;
  const P = G.player, log = [], dt = 1 / 60;
  let target = null;
  const realInput = window.inputVec;
  window.inputVec = () => {
    if (!target) return [0, 0];
    const dx = target[0] - P.x, dy = target[1] - P.y, d = Math.hypot(dx, dy);
    return d < 6 ? [0, 0] : [dx / d, dy / d];
  };
  const builtBefore = new Set(save.g.built);
  for (let f = 0; f < maxMinutes * 60 * 60; f++) {
    const top = P.stack[P.stack.length - 1];
    // the emptiest machine whose supply nobody on staff is handling
    const needy = G.machines.filter((m) => m.stock < 2 && !hasStaff(m.needs)).sort((a, b) => a.stock - b.stock);
    const piles = [G.deskCash, G.counterCash, ...G.machines.map((m) => m.cash)].filter((p) => p.amt > 0).sort((a, b) => b.amt - a.amt);
    const pad = G.pads.find((p) => save.cash >= p.cost - p.paid);
    if ((top === "towel" || top === "water") && G.machines.some((m) => m.needs === top && m.stock < 3)) {
      const m = G.machines.filter((m) => m.needs === top && m.stock < 3).sort((a, b) => a.stock - b.stock)[0]; target = [m.zx, m.zy];
    }
    else if (top === "shake" && G.counter.shakes < 8) target = [COUNTER.zx, COUNTER.zy];
    else if (top) target = [BIN.x, BIN.y];
    // man the desk while someone is waiting at the front of the queue (a human stands still here)
    else if (G.deskQ.length && !hasStaff("recep") && dist(G.deskQ[0].x, G.deskQ[0].y, DESK_Q[0][0], DESK_Q[0][1]) < 12) target = [DESK.zx, DESK.zy];
    else if (pad) target = [pad.x, pad.y];
    else if (needy.length) { const s = supplyAt(needy[0].needs); target = [s.zx, s.zy]; }
    else if (G.shakeBuilt && G.counter.shakes < 3 && !hasStaff("barista")) target = [MAKER.zx, MAKER.zy];
    else if (piles[0]) target = [piles[0].x, piles[0].y];
    else if (G.deskQ.length && !hasStaff("recep")) target = [DESK.zx, DESK.zy];
    else target = null;
    if (buyUpgrades) for (const u of UPGRADES) {
      if ((u.needsStaff && !G.staff.length) || up(u.key) >= u.max) continue;
      const c = upCost(u, up(u.key));
      const nextPad = G.pads[0];
      if (save.cash >= c && (!nextPad || save.cash - c > (nextPad.cost - nextPad.paid) * 0.5)) { save.cash -= c; save.g.up[u.key]++; log.push([+(f / 3600).toFixed(2), "up:" + u.key]); }
    }
    update(dt);
    for (const id of save.g.built) if (!builtBefore.has(id)) { builtBefore.add(id); log.push([+(f / 3600).toFixed(2), id]); }
    if (modalOpen === "next") { log.push([+(f / 3600).toFixed(2), "NEXT GYM"]); break; }
  }
  const angry = G.lost || 0;
  window.inputVec = realInput;
  if (modalOpen) { $("modal").classList.add("hidden"); modalOpen = false; }
  save = JSON.parse(keep); buildGym(); started = false;
  return { gym: gymInfo(gymIndex).name, log: log.filter((l) => !String(l[1]).startsWith("up:")).map(([t, id]) => `${t}m ${id}`).join(" | "), angryLeft: angry };
};
