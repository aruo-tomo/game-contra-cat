// Music, excitement and secrets: per-stage songs and boss themes, muffled music under water, kill combos,
// extra lives, the head stomp, boss phase roars and the slow-motion finish, the golden cans,
// the title codes (MEOW, MUSIC, logo taps) and the jukebox. Usage: node tests/extras.cjs
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);

const reset = (camx, camy, x, floorY) => {
  const g = __game; const p = g.players[0];
  g.enemies = []; g.ebullets = []; g.bullets = []; g.items = []; g.spawnIdx = 9999; g.runnerT = 999; g.lock = null; g.bossTarget = null;
  g.cam.x = camx; g.cam.y = camy;
  p.inv = 999; p.hp = 3; p.lives = 9; p.catnip = 0; p.state = 'alive'; p.vx = 0; p.vy = 0;
  p.x = x; p.y = floorY - p.h; p.setCrouch(false);
  window.__in = { mx: 0, down: false, up: false, aim: { x: 1, y: 0 }, fire: false, jump: false, jumpHeld: false, dash: false, skill: false, lock: false, pause: false, assist: 0 };
  p.ctl.poll = () => window.__in;
};

async function startStage(page, n, extra = '') {
  await page.goto(`${URL}?stage=${n}${extra}`);
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(1500);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(`window.reset = ${reset.toString()}`);
  await page.addInitScript(() => { try { localStorage.removeItem('contracat.options.v1'); } catch {} });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // ---- each stage plays its own song ----
  const songs = [];
  for (const n of [1, 2, 3, 4]) {
    await startStage(page, n);
    songs.push(await page.evaluate(() => __game.musicWanted()));
  }
  check('each stage has its own theme', songs.join() === 'stage1,stage2,stage3,stage4', songs.join());

  // ---- stage 1: combo, 1UP, stomp, golden can ----
  await startStage(page, 1);
  let r = await page.evaluate(async () => {
    reset(400, 0, 500, 300);
    const g = __game; const { Rat } = await import('./src/entities.js');
    const s0 = g.score;
    for (let i = 0; i < 3; i++) { const e = g.addEnemy(new Rat(g, 700 + i * 30, 300)); e.damage(99, g.players[0]); }
    return { combo: g.combo, bonus: g.score - s0 };
  });
  check('kills in quick succession build a combo with bonus points', r.combo === 3 && r.bonus > 300, JSON.stringify(r));
  await sleep(2300);
  r = await page.evaluate(() => __game.combo);
  check('the combo runs out after two seconds', r === 0, String(r));

  r = await page.evaluate(async () => {
    const g = __game; const p = g.players[0]; const l0 = p.lives;
    g.score = g.nextLife - 10; g.score += 20;
    await new Promise((res) => setTimeout(res, 200));
    return { gained: p.lives - l0, next: g.nextLife };
  });
  check('an extra life every 50,000 points', r.gained === 1 && r.next === 100000, JSON.stringify(r));

  r = await page.evaluate(async () => {
    reset(400, 0, 500, 300);
    const g = __game; const p = g.players[0]; p.inv = 0;
    const { Rat } = await import('./src/entities.js');
    const e = g.addEnemy(new Rat(g, 600, 300));
    p.x = e.cx - p.w / 2; p.y = e.y - p.h + 6; p.vy = 300; p.onGround = false;
    g.collide();
    return { dead: e.dead, vy: p.vy, hp: p.hp };
  });
  check('dropping onto a rat stomps it and bounces the hero up', r.dead && r.vy < -300 && r.hp === 3, JSON.stringify(r));

  r = await page.evaluate(async () => {
    reset(1000, 0, 1150, 184);
    const g = __game; const { Secret, SECRETS } = await import('./src/secrets.js');
    const s = g.addEnemy(new Secret(g, 1, SECRETS[1]));
    const aimed = g.autoAimTarget(g.players[0]);
    for (let i = 0; i < 3; i++) s.damage(1, g.players[0]);
    const can = g.items.find((it) => it.type === 'G');
    return { aimedAtSecret: aimed === s, open: s.dead, can: !!can };
  });
  check('the hidden crate is ignored by auto-aim and bursts open after three hits', !r.aimedAtSecret && r.open && r.can, JSON.stringify(r));
  r = await page.evaluate(() => {
    const g = __game; const p = g.players[0]; const l0 = p.lives; const s0 = g.score;
    const can = g.items.find((it) => it.type === 'G');
    can.x = p.x; can.y = p.y; g.collide();
    return { lives: p.lives - l0, score: g.score - s0, found: JSON.parse(localStorage.getItem('contracat.options.v1')).secrets };
  });
  check('the golden can gives a life and 5000 points and is remembered', r.lives === 1 && r.score >= 5000 && r.found.includes(1), JSON.stringify(r));

  // ---- boss: phase roar, slow-motion finish, faster music at low health ----
  await startStage(page, 3);
  r = await page.evaluate(() => {
    reset(0, 100, 300, 370);
    const g = __game; const i = g.level.spawns.findIndex((s) => s.t === 'koi'); g.spawnIdx = i;
    return i;
  });
  await sleep(800);
  r = await page.evaluate(async () => {
    const g = __game; const k = g.bossTarget; k.delay = 0; k.state = 'idle';
    const want = g.musicWanted();
    k.damage(k.maxHp * 0.5, g.players[0]);
    await new Promise((res) => setTimeout(res, 100));
    const flash = g.flashT > 0 || g.bossPhase === 2;
    k.damage(k.hp - k.maxHp * 0.2, g.players[0]);
    await new Promise((res) => setTimeout(res, 100));
    const fast = g.musicFast;
    k.damage(k.hp + 1, g.players[0]);
    await new Promise((res) => setTimeout(res, 400));
    return { want, flash, fast, down: g.bossDown, slow: g.slowT > 0, music: g.musicWanted() };
  });
  check('stage bosses get the boss theme, roar between phases, speed the music up near the end', r.want === 'final' && r.flash && r.fast, JSON.stringify(r));
  check('the killing blow goes slow-motion and the music cuts', r.down && r.slow && r.music === null, JSON.stringify(r));

  // ---- under water the music is muffled ----
  await startStage(page, 3);
  await sleep(600);
  r = await page.evaluate(async () => {
    reset(0, 4830, 300, 5100);
    await new Promise((res) => setTimeout(res, 300));
    return { inWater: __game.players[0].inWater, muffled: __game.muffled };
  });
  check('music is muffled while the heroes are under water', r.inWater && r.muffled, JSON.stringify(r));

  // ---- catnip plays its own sprint ----
  r = await page.evaluate(() => { reset(0, 2400, 300, 2470); __game.players[0].pickup('B'); return __game.musicWanted(); });
  check('catnip switches to the invincibility song', r === 'catnip', r);

  // ---- title codes ----
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.keyboard.type('meow');
  r = await page.evaluate(() => document.getElementById('toast').textContent);
  check('typing MEOW on the title turns on the meow gun', /喵喵槍|Meow Gun/.test(r), r);
  r = await page.evaluate(() => document.getElementById('btnJukebox').hidden);
  await page.keyboard.type('music');
  const shown = await page.evaluate(() => !document.getElementById('btnJukebox').hidden);
  check('typing MUSIC shows the jukebox', r && shown, JSON.stringify({ hiddenBefore: r, shown }));
  await page.click('#btnJukebox');
  await page.click('#btnJukebox');
  r = await page.evaluate(() => document.getElementById('btnJukebox').textContent);
  check('the jukebox steps through the songs', /2\/8/.test(r), r);
  for (let i = 0; i < 7; i++) await page.click('.logo-mark');
  r = await page.evaluate(() => document.getElementById('toast').textContent);
  check('tapping the logo seven times gives the 30-lives code', /30/.test(r), r);
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(500);
  r = await page.evaluate(() => __game.players[0].lives);
  check('the code really gives 30 lives', r === 30, String(r));

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((l) => l.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('TEST CRASH', e.message); process.exit(1); });
