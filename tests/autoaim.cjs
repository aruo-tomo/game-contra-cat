// Flying-can contact and auto-aim checks. Usage: node tests/autoaim.cjs
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);

// clear the stage around P1 and put one rat soldier in front of it
const setupRat = () => {
  const g = __game; const p = g.players[0];
  g.enemies = []; g.ebullets = []; g.spawnIdx = 9999; g.runnerT = 999;
  p.inv = 999;
  g.spawn({ t: 'rat', at: p.x + 220, y: 300 });
  const rat = g.enemies[g.enemies.length - 1];
  rat.cool = 999; rat.hp = 6; rat.maxHp = 6;
  window.__rat = rat;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(2600);

  // the flying can is harmless to touch
  let r = await page.evaluate(() => {
    const g = __game; const p = g.players[0];
    g.enemies = []; p.inv = 0; p.catnip = 0; p.hp = 3;
    g.spawn({ t: 'capsule', item: 'S' });
    const c = g.enemies[g.enemies.length - 1];
    window.__can = c;
    c.update = function (dt) { this.base(dt); this.x = p.x; this.y = p.y + 10; };
    return true;
  });
  await sleep(400);
  r = await page.evaluate(() => ({ hp: __game.players[0].hp, canAlive: !__can.dead }));
  check('flying can does not hurt on contact', r.hp === 3, JSON.stringify(r));

  // auto-aim: only hold right, the gun finds the rat
  await page.evaluate(setupRat);
  await page.keyboard.down('KeyD');
  await sleep(300);
  await page.keyboard.up('KeyD');
  r = await page.evaluate(() => {
    const p = __game.players[0];
    const a = Math.atan2(p.aim.y, p.aim.x);
    const want = Math.atan2(__rat.cy - p.cy, __rat.cx - p.cx);
    return { diff: +Math.abs(a - want).toFixed(3), target: p.autoTarget === __rat, bullets: __game.bullets.length };
  });
  check('auto-aim points at the nearest enemy and fires', r.target && r.diff < 0.05 && r.bullets > 0, JSON.stringify(r));
  await sleep(2500);
  r = await page.evaluate(() => __rat.dead);
  check('auto-aim kills the target without aiming by hand', r === true, String(r));

  // holding up overrides auto-aim, releasing returns to it
  await page.evaluate(setupRat);
  await page.keyboard.down('KeyW');
  await sleep(150);
  const up = await page.evaluate(() => __game.players[0].aim.y);
  await page.keyboard.up('KeyW');
  await sleep(150);
  const back = await page.evaluate(() => __game.players[0].autoTarget === __rat);
  check('hold W aims up, release returns to auto-aim', up < -0.9 && back, `${up.toFixed(2)} ${back}`);

  // enemies take priority over the flying can, even when the can is closer
  r = await page.evaluate(() => {
    const g = __game; const p = g.players[0];
    g.spawn({ t: 'capsule', item: 'M' });
    const c = g.enemies[g.enemies.length - 1];
    c.update = function (dt) { this.base(dt); this.x = p.x + 60; this.y = p.y - 40; };
    return true;
  });
  await sleep(150);
  r = await page.evaluate(() => __game.players[0].autoTarget === __rat);
  check('auto-aim prefers enemies over the flying can', r, String(r));

  // auto-aim can be switched off in settings, then direction keys aim again
  await page.keyboard.press('Escape');
  await page.click('#btnPauseSettings');
  await page.click('[data-autoaim="off"]');
  await page.click('#btnSettingsDone');
  await page.click('#btnResume');
  await sleep(150);
  r = await page.evaluate(() => ({ aim: __game.players[0].aim, auto: __game.players[0].autoTarget }));
  check('auto-aim off: aims straight ahead', !r.auto && Math.abs(r.aim.y) < 0.01, JSON.stringify(r));

  // a rat firing level leaves its rifle tip, not its chest
  r = await page.evaluate(() => {
    const g = __game; const p = g.players[0];
    g.enemies = []; g.ebullets = []; p.inv = 999;
    g.spawn({ t: 'rat', at: p.x + 240, y: 300 });
    const rat = g.enemies[g.enemies.length - 1];
    rat.y = p.y + p.h * 0.45 - 18; rat.vy = 0; rat.update = function () {}; // pin it level with P1
    rat.cool = 0;
    Object.getPrototypeOf(rat).update.call(rat, 0.001);
    const b = g.ebullets[g.ebullets.length - 1];
    return b ? { dx: Math.round(rat.cx - b.x), fireT: rat.fireT > 0 } : null;
  });
  check('rat level shot leaves the rifle muzzle', r && r.dx >= 30, JSON.stringify(r));
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();

  // phone: aim stick untouched still auto-fires
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const m = await ctx.newPage();
  await m.goto(URL);
  await m.waitForFunction(() => window.__game);
  await m.tap('#btn1p');
  await sleep(2600);
  await m.evaluate(setupRat);
  await sleep(500);
  r = await m.evaluate(() => ({ bullets: __game.bullets.length, target: __game.players[0].autoTarget === __rat }));
  check('phone: auto-fires at enemies without touching the aim stick', r.bullets > 0 && r.target, JSON.stringify(r));
  await ctx.close();

  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
