// Poki animated thumbnail renderer: served temporarily as docs/_video_thumb.js and injected
// into the game page together with _thumbnail.js. Renders the 5.5 s video frame by frame with
// the real game code (no screen recording, so no cursor, no UI, no dropped frames) and POSTs
// each frame to tools/receive_frames.py; ffmpeg then encodes the MP4.
//
// Poki spec (developers.poki.com/guide/your-game-page): 1:1, >= 1080x1080, .mp4, >= 50 fps,
// 4-6 s, muted, 2-3 scenes of 1-2 s, begin from the static artwork, minimal text, no UI.
//
//   scene 1  1.5 s  the static thumbnail comes alive (run cycle, cash flying in)
//   scene 2  2.0 s  real gameplay: drop towels for waiting members, sweep up cash
//   scene 3  2.0 s  stand on a price pad, cash pours in, a Squat Rack builds (confetti)
//
// Usage: await VT.render()  (resumable: VT.render() again continues from VT.frame).
window.VT = {
  SIZE: 1080, FPS: 60, PORT: 8652,
  SCENES: [90, 120, 120],
  frame: 0,
  ready: false,

  setup() {
    if (this.ready) return;
    this.U = window.update; this.D = window.draw;   // the real game functions
    window.update = () => {}; window.draw = () => {}; // freeze the live loop
    window.goal = () => null;                       // no tutorial arrow in the video
    ["hud", "title", "modal"].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
    cv.width = cv.height = this.SIZE; W = H = this.SIZE; DPR = 1;
    this.ready = true;
  },

  // drive the player towards a target; returns true once there
  steer(target) {
    this.target = target;
    const P = G.player;
    return Math.hypot(target[0] - P.x, target[1] - P.y) < 4;
  },
  installInput() {
    window.inputVec = () => {
      if (!this.target) return [0, 0];
      const P = G.player, dx = this.target[0] - P.x, dy = this.target[1] - P.y, d = Math.hypot(dx, dy);
      return d < 4 ? [0, 0] : [dx / d, dy / d];
    };
  },

  freshGym(built, up) {
    save = freshSave(); save.gym = 0; save.g.built = built; Object.assign(save.g.up, up);
    buildGym(); started = true;
  },
  warm(seconds) { for (let i = 0; i < seconds * this.FPS; i++) this.U(1 / this.FPS); },

  // put a member at machine m, waiting for its supply (towel bubble), replacing whoever was there
  waiter(m) {
    if (m.user) { const old = m.user; old.machine = null; old.gone = true; }
    const w = makeMember();
    Object.assign(w, { x: m.x, y: m.y, tx: m.x, ty: m.y, state: "needTowel", machine: m, bubble: m.needs, patience: 40 });
    m.user = w; G.members.push(w);
  },

  // ---- scene 2: deliver towels to waiting members, then sweep up their cash
  prepScene2() {
    // a full Garage Gains (all 8 machines busy) but no towel staff: towels are your job here
    this.freshGym(["m0", "m1", "m2", "shake", "m3", "recep", "m4", "m5", "m6", "m7"], { stack: 1, workout: 2, speed: 2 });
    this.target = null;
    G.player.x = 330; G.player.y = 600;               // out of shot while the gym fills up
    this.warm(30);
    G.members = G.members.filter((m) => !m.gone);
    const [m0, m1] = G.machines;
    m0.stock = 0; m1.stock = 0;
    this.waiter(m0); this.waiter(m1);
    G.members = G.members.filter((m) => !m.gone);
    for (const m of G.machines.slice(2)) if (!m.stock) m.stock = 2;
    m1.cash.amt += 20; m1.cash.n = Math.max(m1.cash.n, 8);
    G.player.x = 58; G.player.y = 186; G.player.stack = Array(6).fill("towel");
    G.texts = []; G.fly = [];
    this.s2 = { step: 0 };
  },
  stepScene2() {
    const [m0, m1] = G.machines, P = G.player, s = this.s2;
    if (s.step === 0) { this.steer([m0.zx, m0.zy - 2]); if (m0.stock >= 3 || !P.stack.length) s.step = 1; }
    if (s.step === 1) { this.steer([m1.zx, m1.zy - 2]); if (m1.stock >= 3 || !P.stack.length) s.step = 2; }
    if (s.step === 2) this.steer([m1.cash.x + 6, m1.cash.y + 8]);
    this.U(1 / this.FPS);
    // same close framing as scene 1 (~300 world units across), panning gently with the player
    const tx = clamp(P.x + 30, 130, 200);
    if (!s.camInit) { G.cam.x = tx; s.camInit = true; }
    G.cam.x += (tx - G.cam.x) * 0.06; G.cam.y = 150; G.cam.z = this.SIZE / 300;
  },

  // ---- scene 3: fund a price pad, the machine builds
  prepScene3() {
    this.freshGym(["m0", "m1", "m2", "shake", "m3", "recep", "m4", "towel"], { stack: 1, workout: 2, staff: 1, speed: 2 });
    this.target = null;
    G.player.x = 400; G.player.y = 600;
    this.warm(30);
    const pad = G.pads.find((p) => p.id === "m5");
    save.cash = pad.cost * 1.35;
    G.player.x = pad.x - 30; G.player.y = pad.y + 8; G.player.stack = [];
    G.texts = []; G.fly = [];
    this.s3 = { pad: [pad.x, pad.y] };
  },
  stepScene3(i) {
    this.steer(this.s3.pad);
    this.U(1 / this.FPS);
    G.cam.x = this.s3.pad[0]; G.cam.y = this.s3.pad[1] - 14;
    G.cam.z = this.SIZE / 300 * (1 + Math.min(i / 120, 1) * 0.12);   // slow push-in
  },

  async send(i) {
    const url = cv.toDataURL("image/jpeg", 0.93);
    await fetch(`http://localhost:${this.PORT}/${String(i).padStart(4, "0")}`, { method: "POST", mode: "no-cors", body: url });
  },

  async render(maxFrames = 1e9) {
    this.setup(); this.installInput();
    const [a, b, c] = this.SCENES, total = a + b + c;
    let done = 0;
    while (this.frame < total && done < maxFrames) {
      const i = this.frame;
      if (i < a) {
        makeThumb(this.SIZE, i / this.FPS, false);
      } else if (i < a + b) {
        if (i === a) this.prepScene2();
        this.stepScene2();   // (sets our camera after update() moved it)
        this.D();
      } else {
        if (i === a + b) this.prepScene3();
        this.stepScene3(i - a - b);
        this.D();
      }
      await this.send(i);
      this.frame++; done++;
    }
    return `${this.frame}/${total}`;
  },
};
