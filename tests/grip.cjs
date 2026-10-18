// Heroes are drawn holding the current weapon (hold frames). Usage: node tests/grip.cjs
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

  let r = await page.evaluate(() => { const p = __game.players[0]; return { pose: p.pose().f.file, hold: p.pose().hold }; });
  check('standing: drawn holding the starting blaster', r.hold && /holdNfwd/.test(r.pose), JSON.stringify(r));

  // every weapon has its own gun in the paws
  r = await page.evaluate(() => {
    const p = __game.players[0];
    return ['N', 'S', 'M', 'L', 'F'].map((t) => { p.weapon = { type: t, lvl: 1 }; return p.pose().f.file; });
  });
  check('switching weapon changes the gun in the paws', new Set(r).size === 5 && ['N', 'S', 'M', 'L', 'F'].every((t, i) => r[i].includes(`hold${t}fwd`)), JSON.stringify(r));

  // picking up an item swaps the gun too
  r = await page.evaluate(() => { const p = __game.players[0]; p.weapon = { type: 'N', lvl: 1 }; p.pickup('L'); return p.pose().f.file; });
  check('pickup L: holds the laser-pointer rifle', /holdLfwd/.test(r), r);

  // shots leave the gun's muzzle, which is in front of the paws
  await page.evaluate(() => { const p = __game.players[0]; p.weapon = { type: 'M', lvl: 1 }; __game.bullets = []; p.cool = 0; __in.fire = true; });
  await sleep(40);
  r = await page.evaluate(() => {
    const p = __game.players[0]; __in.fire = false;
    const b = __game.bullets[0]; const m = p.lastMuzzle;
    return b && m ? { dy: +(b.y - m.y).toFixed(1), ahead: +(m.x - p.cx).toFixed(1) } : null;
  });
  check('bullet starts at the muzzle, well in front of the body', r && Math.abs(r.dy) < 6 && r.ahead > 15, JSON.stringify(r));

  // aiming up: up pose, muzzle above the head
  await page.evaluate(() => { __in.aim = { x: 0, y: -1 }; });
  await sleep(120);
  r = await page.evaluate(() => { const p = __game.players[0]; return { pose: p.pose().f.file, my: p.muzzle().y, top: p.y }; });
  check('aim up: holding the gun up, muzzle above the head', /holdMup/.test(r.pose) && r.my < r.top, JSON.stringify(r));

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
  check('running: run-cycle frames holding the gun, muzzle bobs with them', [...files].every((f) => /holdMrun/.test(f)) && files.size > 2 && Math.max(...ys) - Math.min(...ys) > 0.5, JSON.stringify({ ys, frames: files.size }));

  // running while aiming 45 up / down: run-and-aim cycles, muzzle above / below the chest
  for (const [d, ay] of [['up', -0.707], ['down', 0.707]]) {
    await page.evaluate((ay) => { __in.aim = { x: 0.707, y: ay }; __in.mx = 1; }, ay);
    const fs = new Set();
    let my = 0;
    for (let i = 0; i < 6; i++) {
      await sleep(45);
      const q = await page.evaluate(() => { const p = __game.players[0]; return { f: p.pose().f.file, my: p.muzzle().y - p.cy }; });
      fs.add(q.f); my = q.my;
    }
    await page.evaluate(() => { __in.mx = 0; __in.aim = { x: 1, y: 0 }; });
    check(`running aiming 45 ${d}: run${d} cycle`, [...fs].every((f) => f.includes(`holdMrun${d}`)) && fs.size > 2 && (d === 'up' ? my < -10 : my > 10), JSON.stringify({ frames: [...fs].length, my: Math.round(my) }));
  }

  // facing left: gun mirrored in front, muzzle on the left
  await page.evaluate(() => { __in.aim = { x: -1, y: 0 }; });
  await sleep(120);
  r = await page.evaluate(() => { const p = __game.players[0]; return { facing: p.facing, mx: p.muzzle().x - p.cx }; });
  check('facing left: muzzle on the left', r.facing === -1 && r.mx < -10, JSON.stringify(r));

  // the gun is put away for hurt, dash and the roll
  r = await page.evaluate(() => {
    const p = __game.players[0]; const out = {};
    const armed = () => !!(p.pose().hold || p.pose().gun);
    p.hurtT = 0.3; out.hurt = armed(); p.hurtT = 0;
    p.dashT = 0.2; out.dash = armed(); p.dashT = 0;
    p.spin = 0.5; out.roll = armed(); p.spin = 0;
    out.normal = armed();
    return out;
  });
  check('no gun while hurt, dashing or rolling', !r.hurt && !r.dash && !r.roll && r.normal, JSON.stringify(r));

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
