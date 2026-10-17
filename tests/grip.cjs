// Heroes hold the current weapon in their paws. Usage: node tests/grip.cjs
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
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(2600);
  // scripted input: no enemies, P1 obeys window.__in
  await page.evaluate(() => {
    const g = __game; const p = g.players[0];
    g.spawnIdx = 9999; g.runnerT = 999; g.enemies = []; p.inv = 999; p.weapon = { type: 'N', lvl: 1 }; g.items = [];
    window.__in = { mx: 0, aim: { x: 1, y: 0 }, down: false, fire: false };
    p.ctl.poll = () => ({ mx: __in.mx, down: __in.down, up: false, aim: __in.aim, fire: __in.fire, jump: false, jumpHeld: false, dash: false, skill: false, lock: false, pause: false, assist: 0 });
  });
  await sleep(150);

  let r = await page.evaluate(() => { const p = __game.players[0]; const h = p.heldGun(); return { pose: p.pose().f.file, gun: h && h.gun.file }; });
  check('standing: empty-paw grip pose holding the starting gun', /gripfwd/.test(r.pose) && /gun_blaze/.test(r.gun), JSON.stringify(r));

  // every weapon has its own gun in the paws
  r = await page.evaluate(() => {
    const p = __game.players[0];
    return ['N', 'S', 'M', 'L', 'F'].map((t) => { p.weapon = { type: t, lvl: 1 }; return p.heldGun().gun.file; });
  });
  check('switching weapon changes the gun in the paws', new Set(r).size === 5 && /gun_S/.test(r[1]) && /gun_F/.test(r[4]), JSON.stringify(r));

  // picking up an item swaps the gun too
  r = await page.evaluate(() => { const p = __game.players[0]; p.weapon = { type: 'N', lvl: 1 }; p.pickup('L'); return p.heldGun().gun.file; });
  check('pickup L: holds the laser-pointer rifle', /gun_L/.test(r), r);

  // shots leave the gun's muzzle, which is in front of the paws
  await page.evaluate(() => { const p = __game.players[0]; p.weapon = { type: 'M', lvl: 1 }; __game.bullets = []; p.cool = 0; __in.fire = true; });
  await sleep(40);
  r = await page.evaluate(() => {
    const p = __game.players[0]; __in.fire = false;
    const b = __game.bullets[0]; const m = p.lastMuzzle; const h = p.heldGun();
    return b && m ? { dx: +(b.x - m.x).toFixed(1), dy: +(b.y - m.y).toFixed(1), ahead: +(m.x - h.paw.x).toFixed(1), bx: b.x - p.cx } : null;
  });
  check('bullet starts at the muzzle, in front of the paws', r && Math.abs(r.dy) < 6 && r.ahead > 8, JSON.stringify(r));

  // aiming up: up pose, muzzle above the head
  await page.evaluate(() => { __in.aim = { x: 0, y: -1 }; });
  await sleep(120);
  r = await page.evaluate(() => { const p = __game.players[0]; return { pose: p.pose().f.file, my: p.muzzle().y, top: p.y }; });
  check('aim up: gripup pose, muzzle above the head', /gripup/.test(r.pose) && r.my < r.top, JSON.stringify(r));

  // running: the gun moves with the paws from frame to frame
  await page.evaluate(() => { __in.aim = { x: 1, y: 0 }; __in.mx = 1; });
  const ys = [];
  const files = new Set();
  for (let i = 0; i < 8; i++) {
    await sleep(45);
    const s = await page.evaluate(() => { const p = __game.players[0]; return { y: p.muzzle().y - p.y, f: p.pose().f.file }; });
    ys.push(+s.y.toFixed(1)); files.add(s.f);
  }
  await page.evaluate(() => { __in.mx = 0; });
  check('running: run-cycle grip frames, gun bobs with the paws', [...files].every((f) => /griprun/.test(f)) && Math.max(...ys) - Math.min(...ys) > 0.5, JSON.stringify({ ys, frames: files.size }));

  // facing left: gun mirrored in front, muzzle on the left
  await page.evaluate(() => { __in.aim = { x: -1, y: 0 }; });
  await sleep(120);
  r = await page.evaluate(() => { const p = __game.players[0]; return { facing: p.facing, mx: p.muzzle().x - p.cx }; });
  check('facing left: muzzle on the left', r.facing === -1 && r.mx < -10, JSON.stringify(r));

  // the gun is put away for hurt, dash and the roll
  r = await page.evaluate(() => {
    const p = __game.players[0]; const out = {};
    p.hurtT = 0.3; out.hurt = !!p.heldGun(); p.hurtT = 0;
    p.dashT = 0.2; out.dash = !!p.heldGun(); p.dashT = 0;
    p.spin = 0.5; out.roll = !!p.heldGun(); p.spin = 0;
    out.normal = !!p.heldGun();
    return out;
  });
  check('no gun while hurt, dashing or rolling', !r.hurt && !r.dash && !r.roll && r.normal, JSON.stringify(r));

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
