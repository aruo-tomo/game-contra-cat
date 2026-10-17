const { chromium } = require('playwright');
const OUT = process.env.SHOTS_DIR || require('path').join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__game, null, { timeout: 10000 });
  await sleep(500);
  await page.screenshot({ path: OUT + '01-title.png' });

  // Konami on the title screen
  for (const k of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyJ']) await page.keyboard.press(k);
  await page.click('#btn1p');
  await sleep(300);
  let st = await page.evaluate(() => ({ lives: __game.players[0].lives, state: __game.state }));
  check('konami gives 30 lives', st.lives === 30, JSON.stringify(st));

  // mouse + keyboard: run right while aiming up-right and holding fire
  await page.mouse.move(1100, 200);
  const x0 = await page.evaluate(() => __game.players[0].x);
  await page.keyboard.down('KeyD');
  await page.mouse.down();
  await sleep(1500);
  const shot = await page.evaluate(() => ({ bullets: __game.bullets.length, x: __game.players[0].x, aim: __game.players[0].aim }));
  await page.screenshot({ path: OUT + '02-play.png' });
  await page.mouse.up();
  await page.keyboard.up('KeyD');
  check('moves right', shot.x > x0 + 100, `${x0} -> ${shot.x}`);
  check('fires toward mouse (up-right)', shot.bullets > 0 && shot.aim.x > 0 && shot.aim.y < 0, JSON.stringify(shot));

  // dash invulnerability
  const dash = await page.evaluate(() => { const p = __game.players[0]; p.inv = 0; p.catnip = 0; p.dashCd = 0; return p.hp; });
  await page.keyboard.down('ShiftLeft');
  await sleep(50);
  const dashHurt = await page.evaluate(() => { const p = __game.players[0]; const before = p.hp; const d = p.dashT > 0; p.hurt(); return { d, before, after: p.hp }; });
  await page.keyboard.up('ShiftLeft');
  check('dash = invulnerable', dashHurt.d && dashHurt.after === dashHurt.before, JSON.stringify(dashHurt));

  // double jump
  await page.evaluate(() => { const p = __game.players[0]; p.y = 200; p.vy = 0; });
  await sleep(300);
  await page.keyboard.press('Space');
  await sleep(150);
  await page.keyboard.press('Space');
  await sleep(50);
  const dj = await page.evaluate(() => __game.players[0].jumps);
  check('double jump', dj === 2, 'jumps=' + dj);

  // weapon pickup + death downgrade
  const wp = await page.evaluate(() => {
    const p = __game.players[0];
    p.pickup('S'); p.pickup('S');
    const a = { ...p.weapon };
    p.state = 'alive'; p.inv = 0; p.catnip = 0; p.dashT = 0; p.hp = 1; p.hurt();
    return { a, b: { ...p.weapon }, state: p.state, lives: p.lives };
  });
  check('S pickup twice = Lv2, death drops one level', wp.a.lvl === 2 && wp.b.type === 'S' && wp.b.lvl === 1, JSON.stringify(wp));
  await sleep(1600);

  // Mid-boss: jump to the arena
  await page.evaluate(() => { const g = __game; g.cam.x = 3290; for (const p of g.players) if (p) { p.state='alive'; p.x = 3680; p.y = 200; p.inv = 99; } });
  await sleep(2500);
  st = await page.evaluate(() => ({ lock: __game.lock, elite: __game.enemies.some((e) => e.constructor.name === 'Elite'), cam: __game.cam.x }));
  await page.screenshot({ path: OUT + '03-elite.png' });
  check('mid-boss locks camera', !!st.lock && st.elite, JSON.stringify(st));
  await page.evaluate(() => { const e = __game.enemies.find((e) => e.constructor.name === 'Elite'); e.damage(999, __game.players[0]); });
  await sleep(300);
  st = await page.evaluate(() => ({ lock: __game.lock, freed: __game.freed }));
  check('mid-boss defeated unlocks camera', !st.lock && st.freed >= 1, JSON.stringify(st));

  // Boss wall
  await page.evaluate(() => { const g = __game; g.cam.x = 6390; for (const p of g.players) if (p) { p.x = 6720; p.y = 150; p.inv = 99; } });
  await sleep(2500);
  await page.screenshot({ path: OUT + '04-boss.png' });
  st = await page.evaluate(() => ({ lock: __game.lock, core: !!__game.bossTarget }));
  check('boss spawns', !!st.lock && st.core, JSON.stringify(st));
  await page.evaluate(() => __game.bossTarget.damage(999, __game.players[0]));
  await sleep(4000);
  st = await page.evaluate(() => ({ state: __game.state, clearVisible: !document.getElementById('clear').hidden }));
  await page.screenshot({ path: OUT + '05-clear.png' });
  check('stage clear', st.state === 'clear' && st.clearVisible, JSON.stringify(st));

  // classic keyboard 2P
  await page.click('#btnClearTitle');
  await page.click('[data-mode="classic"]');
  await page.click('#btn2p');
  await sleep(1200);
  const c0 = await page.evaluate(() => __game.players.map((p) => p && p.x));
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyL'); // P1 lock: should not move
  await page.keyboard.down('KeyD');
  await sleep(600);
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('KeyL'); await page.keyboard.up('KeyD');
  const c1 = await page.evaluate(() => __game.players.map((p) => p && p.x));
  check('classic 2P: two players', c0.length === 2 && c0[1] != null, JSON.stringify(c0));
  check('classic: P2 arrows move, P1 lock holds still', c1[1] > c0[1] + 40 && Math.abs(c1[0] - c0[0]) < 3, `${c0} -> ${c1}`);

  // Gulp swallow
  const sw = await page.evaluate(() => {
    const p = __game.players[1]; p.energy = 100; return true; });
  await page.keyboard.down('Numpad5'); await sleep(60); await page.keyboard.up('Numpad5');
  const sw2 = await page.evaluate(() => {
    const g = __game; const p = g.players[1];
    for (let i = 0; i < 3; i++) g.ebullets.push({ x: p.cx + 60, y: p.cy, vx: -100, vy: 0, t: 0, kind: 'enemy', r: 4 });
    return p.skillT;
  });
  await sleep(200);
  const sw3 = await page.evaluate(() => ({ swallowed: __game.players[1].swallowed, hp: __game.players[1].hp }));
  check('Gulp swallows bullets', sw2 > 0 && sw3.swallowed >= 3, JSON.stringify({ sw2, ...sw3 }));
  await sleep(1600);
  const spit = await page.evaluate(() => __game.bullets.filter((b) => b.kind === 'spit').length);
  check('Gulp spits them back', spit > 0, 'spit=' + spit);

  // Blaze lock-on
  const lk = await page.evaluate(() => {
    const g = __game; const p = g.players[0];
    g.enemies.push(new (g.enemies.find(() => true)?.constructor || Object)());
    return true;
  }).catch(() => false);
  const lock = await page.evaluate(() => {
    const g = __game; const p = g.players[0]; p.energy = 100;
    return g.enemies.filter((e) => e.hittable()).length;
  });
  await page.keyboard.down('KeyI'); await sleep(60); await page.keyboard.up('KeyI');
  const lock2 = await page.evaluate(() => ({ locks: __game.players[0].locks.length, skillT: __game.players[0].skillT }));
  check('Blaze lock-on', lock2.skillT > 0, JSON.stringify({ enemies: lock, ...lock2 }));

  // down + revive
  const dn = await page.evaluate(() => {
    const g = __game; const [a, b] = g.players;
    a.state = 'alive'; b.state = 'alive'; a.inv = 0; a.catnip = 0; a.dashT = 0; a.hp = 1; a.hurt();
    b.x = a.x + 10; b.y = a.y; b.inv = 99;
    return a.state;
  });
  await sleep(1400);
  const rv = await page.evaluate(() => __game.players[0].state);
  check('down then revived by partner', dn === 'down' && rv === 'alive', `${dn} -> ${rv}`);

  // pause
  await page.keyboard.press('Escape');
  await sleep(100);
  st = await page.evaluate(() => ({ s: __game.state, v: !document.getElementById('pause').hidden }));
  check('Esc pauses', st.s === 'paused' && st.v, JSON.stringify(st));

  // settings rebind + reset
  await page.click('#btnPauseSettings');
  await page.click('[data-profile="classic1"]');
  await page.click('#bind-classic1-jump');
  await page.keyboard.press('KeyQ');
  const rb = await page.evaluate(() => document.getElementById('bind-classic1-jump').textContent);
  await page.screenshot({ path: OUT + '06-settings.png' });
  await page.click('#btnReset');
  const rs = await page.evaluate(() => document.getElementById('bind-classic1-jump').textContent);
  check('rebind then reset', rb === 'Q' && rs === 'J', `${rb} / ${rs}`);

  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await page.close();

  // phone, touch
  const ctx2 = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const m = await ctx2.newPage();
  const merr = [];
  m.on('pageerror', (e) => merr.push(e.message));
  await m.goto(URL);
  await m.waitForFunction(() => window.__game);
  await sleep(400);
  await m.screenshot({ path: OUT + '07-phone-title.png' });
  await m.tap('#btn1p');
  await sleep(800);
  const box = await m.evaluate(() => { const r = document.getElementById('stickR').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, vis: !document.getElementById('touch').hidden }; });
  // drag right stick up-right via CDP touch
  const cdp = await ctx2.newCDPSession(m);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.w * 0.4, y: box.y - box.w * 0.2, id: 1 }] });
  await sleep(600);
  const tb = await m.evaluate(() => __game.bullets.length);
  await m.screenshot({ path: OUT + '08-phone-play.png' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('phone: touch controls visible', box.vis, '');
  check('phone: right stick fires', tb > 0, 'bullets=' + tb);
  const ow = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('phone: no horizontal scroll', ow, '');
  check('phone: no errors', merr.length === 0, merr.join('|'));
  await ctx2.close();

  // gamepad stub
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx3.addInitScript(() => {
    const pad = { index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__pad = pad;
    navigator.getGamepads = () => [pad, null, null, null];
  });
  const g = await ctx3.newPage();
  const gerr = [];
  g.on('pageerror', (e) => gerr.push(e.message));
  await g.goto(URL);
  await g.waitForFunction(() => window.__game);
  await sleep(300);
  await g.evaluate(() => { __pad.buttons[0].pressed = true; });
  await sleep(100);
  await g.evaluate(() => { __pad.buttons[0].pressed = false; });
  await sleep(300);
  const gs = await g.evaluate(() => ({ state: __game.state, kind: __game.players[0] && __game.players[0].ctl.kind }));
  check('gamepad A starts game with pad as P1', gs.state === 'play' && gs.kind === 'pad', JSON.stringify(gs));
  await g.evaluate(() => { __pad.axes[2] = 0.7; __pad.axes[3] = -0.7; __pad.axes[0] = 1; });
  await sleep(700);
  const gp = await g.evaluate(() => ({ b: __game.bullets.length, aim: __game.players[0].aim, x: __game.players[0].x }));
  check('gamepad twin-stick: right stick fires up-right', gp.b > 0 && gp.aim.y < 0 && gp.aim.x > 0, JSON.stringify(gp));
  check('gamepad: no errors', gerr.length === 0, gerr.join('|'));
  await ctx3.close();

  await browser.close();
  console.log(results.join('\n'));
})().catch((e) => { console.log(results.join("\n")); console.error("TEST CRASH", e.message); process.exit(1); });
