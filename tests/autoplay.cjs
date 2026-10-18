// Automated playthrough of a stage with a scripted bot, to check the stage can be finished
// and to measure difficulty. Usage: node tests/autoplay.cjs [players=1] [speed=4] [auto|aim] [stage=1]
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const players = Number(process.argv[2] || 1);
const speed = Number(process.argv[3] || 4);
// 'auto': the bot only moves and jumps; the game's auto-aim does the shooting
const autoAim = process.argv[4] === 'auto';
const stage = Number(process.argv[5] || 1);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(stage > 1 ? `${URL}?stage=${stage}` : URL);
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click(players > 1 ? '#btn2p' : '#btn1p');
  await page.evaluate(({ speed, autoAim }) => {
    const g = window.__game;
    window.__fast = speed;
    const log = (window.__log = { hurts: 0, marks: {}, elite: null, boss: null });
    // bot controller: shoot the nearest enemy, keep moving right, jump pits, hop over runners
    for (const p of g.players) {
      if (!p) continue;
      p.lives = 99;
      const hurt = p.hurt.bind(p);
      p.hurt = () => { const hp = p.hp; hurt(); if (p.hp < hp) log.hurts++; };
      let prevJump = false;
      p.ctl = {
        kind: 'bot',
        poll(pl) {
          const enemies = g.enemies.filter((e) => e.hittable() && g.onScreen(e));
          let target = null, best = 1e9;
          for (const e of enemies) {
            const d = Math.hypot(e.cx - pl.cx, e.cy - pl.cy);
            if (d < best) { best = d; target = e; }
          }
          const aim = target ? { x: (target.cx - pl.cx) / best, y: (target.cy - pl.cy) / best } : { x: 1, y: 0 };
          let mx = 1;
          // climbing stages: head for the next ledge up; under water, swim for the gap in the rock above
          if (g.vertical && !g.lock) {
            const feet = pl.y + pl.h;
            let want = null;
            let jump = false;
            if (pl.inWater) {
              const roof = g.level.solids.filter((s) => s.kind === 'ground' && s.y + s.h <= pl.y + 2 && s.y + s.h > pl.y - 160 && pl.x + pl.w > s.x && pl.x < s.x + s.w)
                .sort((a, b) => b.y - a.y)[0];
              if (roof) {
                // nearest open side of the rock above
                const left = roof.x - pl.w - 6;
                const right = roof.x + roof.w + 6;
                const lOk = left > 0;
                const rOk = right < g.W - pl.w;
                want = !rOk || (lOk && Math.abs(left - pl.x) < Math.abs(right - pl.x)) ? left : right;
              }
              pl.botStroke = (pl.botStroke || 0) - 1 / 60;
              if (pl.botStroke <= 0 && (!roof || pl.y - (roof.y + roof.h) > 30)) { jump = true; pl.botStroke = 0.28; }
              // just under the surface: aim for a ledge above it
              const tops = g.level.platforms().filter((q) => q.y < feet - 10 && q.y > feet - 170);
              if (!roof && tops.length) { const q = tops.sort((a, b) => b.y - a.y)[0]; want = q.x + q.w / 2 - pl.w / 2; }
            } else {
              const tops = [...g.level.platforms().map((q) => ({ x: q.x, w: q.w, y: q.y, mover: q.x0 != null })),
                ...g.level.solids.filter((s) => s.kind === 'ground').map((s) => ({ x: s.x, w: s.w, y: s.y, solid: true }))]
                .filter((q) => q.y < feet - 20 && q.y > feet - 175 && q.w >= 30);
              // choose on the ground; keep that choice through the jump
              if (pl.onGround) pl.botPick = tops.sort((a, b) => (Math.abs(a.x + a.w / 2 - pl.cx) + (feet - a.y) * 0.5) - (Math.abs(b.x + b.w / 2 - pl.cx) + (feet - b.y) * 0.5))[0];
              const live = pl.botPick && pl.botPick.mover ? g.level.movers.find((m) => m.y === pl.botPick.y) : null;
              const pick = live ? { x: live.x, w: live.w, y: live.y, mover: true } : pl.botPick;
              if (pick && pick.solid) {
                // a solid floor above: go up through the gap beside it, then step onto it
                const under = pl.x + pl.w > pick.x && pl.x < pick.x + pick.w;
                if (pl.onGround) {
                  // stand at the edge of the gap right beside that floor, then jump up and step across onto it
                  const edge = pl.cx < pick.x + pick.w / 2 ? pick.x - pl.w - 3 : pick.x + pick.w + 3;
                  if (under || Math.abs(pl.x - edge) > 8) want = edge;
                  else if (!prevJump) jump = true;
                } else {
                  want = feet < pick.y - 2 ? Math.max(pick.x + 4, Math.min(pick.x + pick.w - pl.w - 4, pl.x)) : pl.x;
                  if (pl.jumps === 1 && pl.vy > -80 && feet > pick.y - 4 && !prevJump) jump = true;
                }
              } else if (pick && pick.mover && pl.onGround && Math.abs(pick.x + pick.w / 2 - pl.cx) > pick.w / 2 + 30) {
                want = pl.x; // a drifting log: wait for it to come close rather than walk off the ledge after it
              } else if (pick) {
                want = Math.max(pick.x + 4, Math.min(pick.x + pick.w - pl.w - 4, pl.x));
                const under = pl.x + pl.w > pick.x + 4 && pl.x < pick.x + pick.w - 4;
                const close = Math.abs(want - pl.x) < 70;
                if (pl.onGround && (under || close) && !prevJump) jump = true;
                if (!pl.onGround && pl.jumps === 1 && pl.vy > -80 && feet > pick.y - 4 && !prevJump) jump = true;
              }
            }
            const wantMx = want == null ? 0 : Math.abs(want - pl.x) < 6 ? 0 : Math.sign(want - pl.x);
            prevJump = jump;
            if (autoAim) return { mx: wantMx, down: false, up: false, aim: null, autoAim: true, fire: 'auto', jump, jumpHeld: true, dash: false, skill: pl.energy >= 50, lock: false, pause: false, assist: 0 };
            return { mx: wantMx, down: false, up: false, aim, fire: true, jump, jumpHeld: true, dash: false, skill: pl.energy >= 50, lock: false, pause: false, assist: 0 };
          }
          if (g.lock) {
            // in an arena: keep some distance from the boss
            const boss = g.bossTarget;
            const want = boss ? Math.min(boss.x - 160, g.cam.x + 420) : g.cam.x + 200;
            mx = Math.abs(pl.x - want) < 20 ? 0 : Math.sign(want - pl.x);
            // step out from under the koi's slam shadow
            const slam = g.enemies.find((e) => (e.state === 'aim' || e.state === 'slam') && e.target != null);
            if (slam && Math.abs(slam.target - pl.cx) < 110) mx = pl.cx < slam.target ? -1 : 1;
          }
          const ahead = pl.x + pl.w + 26;
          const pit = g.groundTopAt(ahead) == null && !g.level.platforms().some((q) => ahead > q.x && ahead < q.x + q.w && q.y > pl.y);
          const runnerClose = g.enemies.some((e) => e.constructor.name === 'Runner' && Math.abs(e.cx - pl.cx) < 50)
            // what a player would see coming and hop: a charging boss, a sound wave rolling along the floor
            || g.enemies.some((e) => e.dashing && Math.abs(e.cx - pl.cx) < 140)
            || g.ebullets.some((b) => b.kind === 'wave' && Math.abs(b.x - pl.cx) < 60)
            // the koi charging low along the floor
            || g.enemies.some((e) => e.state === 'sweep' && e.sweepStage === 2 && Math.abs(e.cx - pl.cx) < 200);
          // walls and steps (the lift shaft up to the upper ward): jump at them
          const wantJump = pl.onGround && (pit || runnerClose || (pl.hitWall && mx) || Math.random() < 0.01);
          const jump = wantJump && !prevJump;
          prevJump = wantJump;
          if (autoAim) return { mx, down: false, up: false, aim: null, autoAim: true, fire: 'auto', jump, jumpHeld: true, dash: false, skill: pl.energy >= 50, lock: false, pause: false, assist: 0 };
          return { mx, down: false, up: false, aim, fire: true, jump, jumpHeld: true, dash: false, skill: pl.energy >= 50, lock: false, pause: false, assist: 0 };
        },
      };
    }
  }, { speed, autoAim });

  const t0 = Date.now();
  let last = '';
  for (;;) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => {
      const g = window.__game;
      const log = window.__log;
      for (const m of [1000, 2000, 3000, 4000, 5000, 6000, 7000]) if (g.cam.x >= m && !log.marks[m]) log.marks[m] = +g.time.toFixed(1);
      const mid = g.stage.midbossCamx ?? g.stage.midbossCamy;
      const boss = g.stage.bossCamx ?? g.stage.bossCamy;
      const lk = g.lock && (g.lock.x ?? g.lock.y);
      if (g.vertical) for (const m of [4000, 3000, 2000, 1000]) if (g.cam.y <= m && !log.marks['y' + m]) log.marks['y' + m] = +g.time.toFixed(1);
      // climbing: if the bot makes no progress for 15 s of game time, put it on the next ledge up and note where
      if (g.vertical && !g.lock && g.state === 'play') {
        if (log.bestY == null || g.cam.y < log.bestY - 4) { log.bestY = g.cam.y; log.bestT = g.time; }
        const p = g.players.find((q) => q && q.state === 'alive');
        if (p && g.time - log.bestT > 15) {
          const feet = p.y + p.h;
          const up = [...g.level.platforms(), ...g.level.solids.filter((s) => s.kind === 'ground')].filter((q) => q.y < feet - 40 && q.y > feet - 260 && q.w >= 40)
            .sort((a, b) => b.y - a.y)[0];
          if (up) { p.x = up.x + up.w / 2 - p.w / 2; p.y = up.y - p.h - 2; p.vy = 0; (log.skips = log.skips || []).push(Math.round(feet)); }
          log.bestT = g.time;
        }
      }
      if (g.lock && lk === mid && !log.eliteStart) log.eliteStart = g.time;
      if (log.eliteStart && !g.lock && !log.elite) log.elite = +(g.time - log.eliteStart).toFixed(1);
      if (g.lock && lk === boss && !log.bossStart) log.bossStart = g.time;
      return { state: g.state, cam: Math.round(g.cam.x), camy: Math.round(g.cam.y), time: +g.time.toFixed(1), deaths: g.deaths, hurts: log.hurts, freed: g.freed, spawned: g.catSpawned, score: g.score };
    });
    const line = `${s.state} cam=${s.cam}/${s.camy} t=${s.time}s hurts=${s.hurts} deaths=${s.deaths}`;
    if (line !== last && Date.now() % 5 === 0) console.log(line);
    last = line;
    if (s.state === 'clear' || s.state === 'over' || Date.now() - t0 > 240000) {
      const log = await page.evaluate(() => { const g = window.__game; const l = window.__log; return { ...l, bossFight: l.bossStart ? +(g.time - l.bossStart).toFixed(1) : null, result: g.result }; });
      console.log(JSON.stringify({ final: s, log, errors }, null, 1));
      break;
    }
  }
  await browser.close();
})();
