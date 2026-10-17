// Automated playthrough of stage 1 with a scripted bot, to check the stage can be finished
// and to measure difficulty. Usage: node tests/autoplay.cjs [players=1] [speed=4]
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const players = Number(process.argv[2] || 1);
const speed = Number(process.argv[3] || 4);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click(players > 1 ? '#btn2p' : '#btn1p');
  await page.evaluate(({ speed }) => {
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
          if (g.lock) {
            // in an arena: keep some distance from the boss
            const boss = g.bossTarget;
            const want = boss ? Math.min(boss.x - 160, g.cam.x + 420) : g.cam.x + 200;
            mx = Math.abs(pl.x - want) < 20 ? 0 : Math.sign(want - pl.x);
          }
          const ahead = pl.x + pl.w + 26;
          const pit = g.groundTopAt(ahead) == null && !g.level.platforms().some((q) => ahead > q.x && ahead < q.x + q.w && q.y > pl.y);
          const runnerClose = g.enemies.some((e) => e.constructor.name === 'Runner' && Math.abs(e.cx - pl.cx) < 50);
          const wantJump = pl.onGround && (pit || runnerClose || Math.random() < 0.01);
          const jump = wantJump && !prevJump;
          prevJump = wantJump;
          return { mx, down: false, up: false, aim, fire: true, jump, jumpHeld: true, dash: false, skill: pl.energy >= 50, lock: false, pause: false, assist: 0 };
        },
      };
    }
  }, { speed });

  const t0 = Date.now();
  let last = '';
  for (;;) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => {
      const g = window.__game;
      const log = window.__log;
      for (const m of [1000, 2000, 3000, 4000, 5000, 6000]) if (g.cam.x >= m && !log.marks[m]) log.marks[m] = +g.time.toFixed(1);
      if (g.lock && g.lock.x === 3300 && !log.eliteStart) log.eliteStart = g.time;
      if (log.eliteStart && !g.lock && !log.elite) log.elite = +(g.time - log.eliteStart).toFixed(1);
      if (g.lock && g.lock.x === 6400 && !log.bossStart) log.bossStart = g.time;
      return { state: g.state, cam: Math.round(g.cam.x), time: +g.time.toFixed(1), deaths: g.deaths, hurts: log.hurts, freed: g.freed, spawned: g.catSpawned, score: g.score };
    });
    const line = `${s.state} cam=${s.cam} t=${s.time}s hurts=${s.hurts} deaths=${s.deaths}`;
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
