// Checks for the stage-1 polish pass. Usage: node tests/polish.cjs
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.click('#btn1p');
  await sleep(2500); // let the drop-in intro finish

  // coyote time: just ran off a ledge, jump still counts as a ground jump
  await page.evaluate(() => { const p = __game.players[0]; p.inv = 99; p.y = 150; p.vy = 40; p.onGround = false; p.airT = 0.05; p.jumped = false; p.jumps = 1; });
  await page.keyboard.press('Space');
  await sleep(40);
  let r = await page.evaluate(() => { const p = __game.players[0]; return { vy: Math.round(p.vy), jumps: p.jumps }; });
  // started at +40 (falling); a quick tap gives a short hop, so any upward speed means it jumped
  check('coyote time jump', r.vy < -100 && r.jumps === 1, JSON.stringify(r));

  // jump buffer: press just before landing, the jump fires on touchdown
  await sleep(1200);
  await page.evaluate(() => { const p = __game.players[0]; p.y = 300 - p.h - 14; p.vy = 250; p.onGround = false; p.jumps = 2; p.jumped = true; p.airT = 0.5; });
  await page.keyboard.press('Space');
  let minY = 999;
  for (let i = 0; i < 15; i++) { await sleep(20); minY = Math.min(minY, await page.evaluate(() => __game.players[0].y)); }
  r = await page.evaluate(() => ({ jumps: __game.players[0].jumps }));
  r.minY = Math.round(minY);
  // ground top is 300 and the cat is 46 tall: rising clearly above 254 means it jumped after landing
  check('jump buffer fires on landing', r.minY < 254 - 15, JSON.stringify(r));

  // aim poses follow the mouse
  await sleep(1200);
  const pc = await page.evaluate(() => { const p = __game.players[0]; return { x: p.cx - __game.cam.x, y: p.cy }; });
  const scale = 1280 / 640;
  await page.mouse.move(pc.x * scale + 4, 20);
  await sleep(100);
  const up = await page.evaluate(() => __game.players[0].pose().f.file);
  await page.mouse.move(pc.x * scale + 300, pc.y * scale - 300);
  await sleep(100);
  const diag = await page.evaluate(() => __game.players[0].pose().f.file);
  check('aim poses (up / diagonal)', /aimup/.test(up) && /aimdiag/.test(diag), `${up} ${diag}`);

  // hurt pose
  r = await page.evaluate(() => { const p = __game.players[0]; p.inv = 0; p.catnip = 0; p.dashT = 0; p.hp = 3; p.hurt(); return p.pose().f.file; });
  check('hurt pose', /hurt/.test(r), r);

  // hit-stop pauses the simulation, then resumes
  const t0 = await page.evaluate(() => { __game.freeze(0.4); return __game.time; });
  await sleep(150);
  const t1 = await page.evaluate(() => __game.time);
  await sleep(700);
  const t2 = await page.evaluate(() => __game.time);
  check('hit-stop freezes then resumes', Math.abs(t1 - t0) < 0.02 && t2 > t1 + 0.2, `${t0.toFixed(2)} ${t1.toFixed(2)} ${t2.toFixed(2)}`);

  // rank formula
  r = await page.evaluate(async () => {
    const { rankFor } = await import('./src/options.js');
    return [
      rankFor({ time: 200, deaths: 0, freedRate: 0.8, score: 40000 }),
      rankFor({ time: 200, deaths: 0, freedRate: 0.8, score: 1000 }),
      rankFor({ time: 300, deaths: 2, freedRate: 0.8, score: 40000 }),
      rankFor({ time: 300, deaths: 2, freedRate: 0.1, score: 0 }),
    ].join('');
  });
  check('rank S/A/B/C', r === 'SABC', r);

  // boss WARNING banner
  // skip straight to the boss trigger (jumping past the mid-boss would otherwise lock the camera there)
  await page.evaluate(() => { const g = __game; g.spawnIdx = g.level.spawns.findIndex((s) => s.t === 'boss'); g.cam.x = 6390; for (const p of g.players) if (p) { p.x = 6720; p.y = 150; p.inv = 99; } });
  await sleep(600);
  r = await page.evaluate(() => (__game.banner && __game.banner.style) || null);
  check('boss WARNING banner', r === 'warn', String(r));
  await page.screenshot({ path: __dirname + '/shots/p1-warning.png' });

  // freed counter shows rescued / spawned
  r = await page.evaluate(() => ({ freed: __game.freed, spawned: __game.catSpawned }));
  check('freed / spawned counted', r.spawned > 0, JSON.stringify(r));

  // results screen with rank
  await sleep(2500);
  await page.evaluate(() => __game.bossTarget.damage(999, __game.players[0]));
  await sleep(5500);
  r = await page.evaluate(() => ({ rank: document.getElementById('clearRank').textContent, best: document.getElementById('clearBest').textContent, vis: !document.getElementById('clear').hidden }));
  await page.screenshot({ path: __dirname + '/shots/p2-results.png' });
  check('results screen with rank and best', r.vis && /^[SABC]$/.test(r.rank) && r.best.length > 0, JSON.stringify(r));

  // options persist across reloads
  await page.click('#btnClearTitle');
  await page.click('#btnSettings');
  await page.click('[data-shake="off"]');
  await page.click('[data-assist="strong"]');
  await page.fill('#optMusic', '30');
  await page.dispatchEvent('#optMusic', 'input');
  await page.reload();
  await page.waitForFunction(() => window.__game);
  await page.click('#btnSettings');
  r = await page.evaluate(() => ({
    shakeOff: document.querySelector('[data-shake="off"]').getAttribute('aria-pressed'),
    strong: document.querySelector('[data-assist="strong"]').getAttribute('aria-pressed'),
    music: document.getElementById('optMusic').value,
  }));
  check('options persist', r.shakeOff === 'true' && r.strong === 'true' && r.music === '30', JSON.stringify(r));
  const best = await page.evaluate(() => localStorage.getItem('contracat.best.v1'));
  check('best result saved', !!best, best || '');
  // character select: P1 picks Gulp, P2 gets Blaze
  await page.click('#btnSettingsDone');
  await page.click('.pick[data-char="1"]');
  await page.click('#btn2p');
  await sleep(400);
  r = await page.evaluate(() => __game.players.map((p) => p && p.char.id));
  check('character select (P1 Gulp, P2 Blaze)', r[0] === 'gulp' && r[1] === 'blaze', JSON.stringify(r));
  // the choice is remembered for next time
  await page.reload();
  await page.waitForFunction(() => window.__game);
  r = await page.evaluate(() => document.querySelector('.pick[data-char="1"]').getAttribute('aria-checked'));
  check('character choice remembered', r === 'true', r);
  await page.click('.pick[data-char="0"]');

  // new projectile / effect sprites are in use
  await page.click('#btn1p');
  await sleep(2400);
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();

  // phone: floating stick appears where the thumb lands
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const m = await ctx.newPage();
  await m.goto(URL);
  await m.waitForFunction(() => window.__game);
  await m.tap('#btn1p');
  await sleep(2400);
  const zone = await m.evaluate(() => { const r = document.getElementById('zoneR').getBoundingClientRect(); return { x: r.x + r.width * 0.3, y: r.y + r.height * 0.35 }; });
  const cdp = await ctx.newCDPSession(m);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: zone.x, y: zone.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: zone.x + 30, y: zone.y - 20, id: 1 }] });
  await sleep(400);
  r = await m.evaluate(({ zone }) => {
    const s = document.getElementById('stickR');
    const b = s.getBoundingClientRect();
    return { live: s.classList.contains('live'), dx: Math.round(b.x + b.width / 2 - zone.x), dy: Math.round(b.y + b.height / 2 - zone.y), bullets: __game.bullets.length };
  }, { zone });
  await m.screenshot({ path: __dirname + '/shots/p3-phone-stick.png' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('floating stick appears at touch point and fires', r.live && Math.abs(r.dx) < 4 && Math.abs(r.dy) < 4 && r.bullets > 0, JSON.stringify(r));
  await ctx.close();

  // portrait phone renders without sideways scroll
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const pp = await ctx2.newPage();
  await pp.goto(URL);
  await pp.waitForFunction(() => window.__game);
  await sleep(300);
  await pp.screenshot({ path: __dirname + '/shots/p4-portrait.png' });
  r = await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  check('portrait: no sideways scroll', r);
  await ctx2.close();

  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
