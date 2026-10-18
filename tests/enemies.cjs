// Enemy variety: each Red Mouse soldier type and the runner / bat variants do their own thing. Usage: node tests/enemies.cjs
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);

// empty stage; P1 stands still, never fires, can't be hurt unless a test says so
const reset = () => {
  const g = __game; const p = g.players[0];
  g.enemies = []; g.ebullets = []; g.bullets = []; g.spawnIdx = 9999; g.runnerT = 999;
  p.inv = 999; p.hp = 3; p.catnip = 0; p.x = g.cam.x + 120; p.vx = 0;
  p.ctl.poll = () => ({ mx: 0, down: false, up: false, aim: { x: 1, y: 0 }, fire: false, jump: false, jumpHeld: false, dash: false, skill: false, lock: false, pause: false, assist: 0 });
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

  // gunner: a three-round burst
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; g.spawn({ t: 'gunner', at: g.players[0].x + 260, y: 300 }); const e = g.enemies[0]; e.cool = 0.05; window.__e = e; });
  await sleep(700);
  let r = await page.evaluate(() => ({ shots: __game.ebullets.length, hp: __e.maxHp }));
  check('gunner fires a 3-round burst and is tougher', r.shots === 3 && r.hp >= 4, JSON.stringify(r));

  // grenadier: a lobbed bomb that lands by the hero and bursts, hurting it
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; p.inv = 0; g.spawn({ t: 'grenadier', at: p.x + 240, y: 300 }); const e = g.enemies[0]; e.cool = 0.05; window.__e = e; });
  await sleep(250);
  const bomb = await page.evaluate(() => { const b = __game.ebullets[0]; return b ? { bomb: !!b.bomb, up: b.vy < 0 } : null; });
  let boom = false;
  for (let i = 0; i < 18; i++) {
    await sleep(80);
    boom = boom || (await page.evaluate(() => __game.effects.some((f) => f.key === 'explosion')));
  }
  r = await page.evaluate(() => ({ hp: __game.players[0].hp, left: __game.ebullets.filter((b) => b.bomb).length }));
  r.boom = boom;
  check('grenadier lobs a bomb that bursts where the hero stands', bomb && bomb.bomb && bomb.up && r.hp < 3 && r.left === 0 && r.boom, JSON.stringify({ bomb, ...r }));

  // grenadier backs off when a hero walks up
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; g.spawn({ t: 'grenadier', at: p.x + 90, y: 300 }); window.__e = g.enemies[0]; __e.cool = 99; window.__x0 = __e.x; });
  await sleep(600);
  r = await page.evaluate(() => Math.round(__e.x - __x0));
  check('grenadier backs away from a close hero', r > 15, 'moved ' + r);

  // sniper: aims with a laser that tracks, locks, then one fast shot
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; g.spawn({ t: 'sniper', at: g.players[0].x + 330, y: 300 }); window.__e = g.enemies[0]; __e.phaseT = 1.15; });
  await sleep(200);
  const aiming = await page.evaluate(() => __e.phase);
  await sleep(1300);
  r = await page.evaluate(() => { const b = __game.ebullets[0]; return b ? Math.round(Math.hypot(b.vx, b.vy)) : 0; });
  check('sniper shows its aim first, then fires a fast shot', aiming === 'aim' && r >= 400, JSON.stringify({ aiming, speed: r }));

  // charger: runs in from the right, then crouches and leaps at the hero
  await page.evaluate(reset);
  await page.evaluate(() => { __game.spawn({ t: 'charger' }); window.__e = __game.enemies[0]; window.__states = new Set(); });
  for (let i = 0; i < 70; i++) {
    await sleep(60);
    await page.evaluate(() => { if (__e) __states.add(__e.state); });
  }
  r = await page.evaluate(() => [...__states]);
  check('charger sprints in, crouches, then leaps', r.includes('run') && r.includes('crouch') && r.includes('leap'), JSON.stringify(r));

  // bat dropper: hovers over the hero, then drops
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; g.spawn({ t: 'bat', y: 120 }); const b = g.enemies[0]; b.dropper = true; b.x = g.players[0].x + 180; window.__e = b; window.__modes = new Set(); });
  for (let i = 0; i < 30; i++) {
    await sleep(60);
    await page.evaluate(() => __modes.add(__e.mode));
  }
  r = await page.evaluate(() => [...__modes]);
  check('dropper bat hovers over the hero then drops', r.includes('hover') && r.includes('drop'), JSON.stringify(r));

  // pouncing runner leaps when it gets close
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; g.spawnRunner(-1); const e = g.enemies[g.enemies.length - 1]; e.pouncer = true; window.__e = e; });
  let leapt = false;
  for (let i = 0; i < 90 && !leapt; i++) {
    await sleep(60);
    leapt = await page.evaluate(() => !!__e.pounced);
  }
  check('pouncing runner leaps at the hero', leapt, String(leapt));

  // stage 1 now fields every type
  r = await page.evaluate(() => [...new Set(__game.level.spawns.map((s) => s.t))]);
  check('stage 1 uses gunner, grenadier, sniper and charger', ['gunner', 'grenadier', 'sniper', 'charger', 'rat'].every((k) => r.includes(k)), JSON.stringify(r));

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
