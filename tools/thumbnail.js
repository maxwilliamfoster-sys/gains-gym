// Poki thumbnail composer: served temporarily as docs/_thumbnail.js and injected into the
// running game page, so the thumbnail is drawn with the game's own sprites (Poki: "a store
// window: show the core gameplay"). Rules followed (developers.poki.com/guide/thumbnail):
// square >= 628px, full bleed, NO text or logos, main character in a dynamic pose, low
// detail so it reads on small tiles, nothing near Poki's turquoise (#83FFE7).
//
// makeThumb(size, t) draws the scene on the main canvas at time t seconds. t = 0 is the
// static thumbnail; tools/video_thumb.js animates t for scene 1 of the video thumbnail, so
// the video starts exactly on the static art (Poki: "begin from your static artwork").
// It returns a PNG data URL unless encode is false. sendThumb(url, port) POSTs it to
// tools/receive.py to save it.
window.makeThumb = function (size = 1024, t = 0, encode = true) {
  window.draw = () => {};                       // stop the game loop repainting over us
  if (cv.width !== size) { cv.width = size; cv.height = size; }
  const z = size / 300;                          // ~300 world units across: big, readable sprites
  ctx.setTransform(z, 0, 0, z, size / 2, size / 2);
  G.t = 1.3 + t;

  // floor: warm gym tiles, a touch more saturated than in-game so it pops on the site
  ctx.fillStyle = "#f4e4c8"; ctx.fillRect(-200, -200, 400, 400);
  ctx.fillStyle = "#ebd5b0";
  for (let y = -216; y < 200; y += 48) for (let x = -216 + (((y + 216) / 48) % 2 ? 48 : 0); x < 200; x += 96) ctx.fillRect(x, y, 48, 48);

  const info = G.info;
  const machine = (type, x, y, color, mat, stock = 3) => {
    G.info = { ...info, mat };
    const m = { type, x, y, color, needs: "towel", stock, big: false, user: { state: "workout" } };
    drawMachine(m); return m;
  };
  const person = (x, y, shirt, skin, hair, bob, opts = {}, extra = {}) =>
    drawPerson({ x, y, shirt, skin, hair, bob, face: 1, moving: false, ...extra }, opts);

  // machines in use behind the player, each on a mat tinted with its own colour
  machine("bench", -96, -92, "#3d8bff", "#cfe0ff");
  person(-96, -92, "#a65cff", "#c98e6a", "#2b1d14", 2.2 + t * 10, { working: true });
  machine("tread", 98, -98, "#2fbf71", "#cdeedb", 2);
  person(98, -98, "#ffc531", "#f1c7a6", "#d9a441", 4.1 + t * 10, { working: true });
  G.info = info;

  // a member waiting for a towel (the core job, shown not told)
  person(-112, 60, "#3d8bff", "#9c6644", "#111", 0, {}, { bubble: "towel", patience: 40, face: 1 });

  // cash pile, bottom right
  for (let i = 0; i < 9; i++) drawItem("cash", 104 + (i % 3) * 13 - 13, 122 - Math.floor(i / 3) * 6 - (i % 2) * 2, 1.5);
  for (let i = 0; i < 7; i++) drawItem("cash", 92 + (i % 2) * 20, 98 - i * 5, 1.5);

  // motion lines behind the running player (they stream backwards over time)
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineCap = "round";
  for (const [y, len, w, ph] of [[62, 40, 4, 0], [80, 54, 4.5, 0.4], [98, 34, 3.5, 0.75]]) {
    const off = ((t * 1.6 + ph) % 1) * 18;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(-52 - len - off, y); ctx.lineTo(-52 - off, y); ctx.stroke();
  }

  // the player: mid-stride, leaning into the run, with a tall towel stack on top
  const P = { x: -8, y: 120 - Math.abs(Math.sin(t * 7)) * 3, shirt: "#ff5a6e", skin: "#f1c7a6", hair: "#2b1d14", cap: true, face: 1,
    moving: true, bob: 1.35 + t * 14, stack: Array(8).fill("towel") };
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(0.08); ctx.translate(-P.x, -P.y);
  drawPerson(P, { carry: true, capCol: "#2b2e45", scale: 1.9, you: true });
  ctx.restore();

  // bills flying from the pile to the player along an arc; 3 in flight, evenly spaced
  for (let k = 0; k < 3; k++) {
    const ph = (k / 3 + 0.2 + t * 0.9) % 1;
    const u = 1 - ph;
    const x = u * u * 100 + 2 * u * ph * 92 + ph * ph * 24;     // quadratic bezier: pile -> over -> player
    const y = u * u * 80 + 2 * u * ph * -70 + ph * ph * 20;
    const scale = 1.45 * (ph > 0.85 ? (1 - ph) / 0.15 : 1);      // shrink into the player at the end
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.4 + ph * 0.9); drawItem("cash", 0, 0, scale); ctx.restore();
  }
  // twinkling sparkles
  ctx.fillStyle = "#ffc531";
  for (const [x, y, s, ph] of [[96, 22, 6, 0], [38, -46, 5, 1.7], [128, 62, 4, 3.1], [-138, -10, 4.5, 4.4], [140, -40, 4, 2.2]]) {
    const ss = s * (0.75 + 0.25 * Math.cos(t * 6 + ph));
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? ss * 0.38 : ss; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }

  // soft vignette to pull the eye to the player
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const v = ctx.createRadialGradient(size / 2, size * 0.55, size * 0.32, size / 2, size / 2, size * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(60,40,20,.25)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, size, size);
  return encode ? cv.toDataURL("image/png") : null;
};
window.sendThumb = (url, port = 8651) => fetch(`http://localhost:${port}/`, { method: "POST", mode: "no-cors", body: url });
