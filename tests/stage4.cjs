// Stage 4 (pet hospital basement): conveyors, steam, pods, hypnosis, flame and tesla rats,
// spider-bots, the freight lift and the drill digger, the spider mech's phases. Usage: node tests/stage4.cjs
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);

// empty view at (camx, camy); P1 standing at x on the floor at floorY; still, not firing, invincible unless a test says so
const reset = (camx, camy, x, floorY) => {
  const g = __game; const p = g.players[0];
  g.enemies = []; g.ebullets = []; g.bullets = []; g.spawnIdx = 9999; g.runnerT = 999; g.lock = null; g.bossTarget = null;
  g.cam.x = camx; g.cam.y = camy; g.level.camMode = camy > 1000 ? 'C' : 'A';
  p.inv = 999; p.hp = 3; p.lives = 99; p.catnip = 0; p.confused = 0; p.state = 'alive'; p.vx = 0; p.vy = 0;
  p.x = x; p.y = floorY - p.h; p.setCrouch(false);
  window.__in = { mx: 0, down: false, up: false, aim: { x: 1, y: 0 }, fire: false, jump: false, jumpHeld: false, dash: false, skill: false, lock: false, pause: false, assist: 0 };
  p.ctl.poll = () => window.__in;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(`window.reset = ${reset.toString()}`);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // ---- going on from stage 3 ----
  await page.goto(URL + '?stage=3');
  await page.waitForFunction(() => window.__game);
  let r = await page.evaluate(() => document.querySelectorAll('#stageSeg [data-stage]').length);
  check('stage picker lists all four stages', r === 4, String(r));
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(1200);
  await page.evaluate(() => __game.stageClear());
  await sleep(1900);
  await page.click('#btnNext');
  await sleep(500);
  r = await page.evaluate(() => ({ n: __game.stage.n, vertical: __game.vertical, camy: __game.cam.y }));
  check('stage 3 leads on to stage 4', r.n === 4 && !r.vertical && r.camy === 0, JSON.stringify(r));

  await page.goto(URL + '?stage=4');
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(2200);

  // conveyor belt carries a standing hero
  await page.evaluate(() => reset(800, 0, 1000, 300));
  await sleep(600);
  r = await page.evaluate(() => Math.round(__game.players[0].x - 1000));
  check('conveyor belt carries the hero', r < -20, 'moved ' + r);

  // steam vent: hurts only while the jet is on
  r = await page.evaluate(() => {
    reset(600, 0, 750, 300);
    const g = __game; g.spawn({ t: 'steam', at: 760, y: 300, dir: -1, ph: 0 }); const v = g.enemies[0];
    const p = g.players[0]; const box = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 6 };
    v.t = 0.5; const off = v.touches(box); v.t = 2.0; const hiss = v.touches(box); v.t = 2.6; const on = v.touches(box);
    return { off, hiss, on };
  });
  check('steam jet hurts only when it blasts (after the hiss)', !r.off && !r.hiss && r.on, JSON.stringify(r));

  // specimen pod: breaking it frees the cat and gives the breaker a heart back
  r = await page.evaluate(() => {
    reset(1200, 0, 1300, 300);
    const g = __game; const p = g.players[0]; p.hp = 1; const f0 = g.freed;
    g.spawn({ t: 'pod', at: 1400, y: 300 }); const pod = g.enemies[0];
    pod.damage(99, p);
    return { freed: g.freed - f0, hp: p.hp, harmless: !pod.touches({ x: pod.x, y: pod.y, w: 10, h: 10 }) };
  });
  check('breaking a pod frees the cat and heals', r.freed === 1 && r.hp === 2 && r.harmless, JSON.stringify(r));

  // hypnosis: no damage, but left and right swap; a shot pops the ring
  await page.evaluate(() => { reset(800, 0, 900, 300); const p = __game.players[0]; p.inv = 0; __game.spawn({ t: 'hypno', y: 300 }); window.__e = __game.enemies[0]; __e.x = 1100; __e.cool = 0.05; });
  let confused = 0;
  for (let i = 0; i < 60 && !confused; i++) { await sleep(60); confused = await page.evaluate(() => __game.players[0].confused); }
  await page.evaluate(() => { __in.mx = 1; window.__x0 = __game.players[0].x; });
  await sleep(250);
  r = await page.evaluate(() => ({ hp: __game.players[0].hp, moved: Math.round(__game.players[0].x - __x0) }));
  check('hypnosis ring: no damage, left and right swapped', confused > 0 && r.hp === 3 && r.moved < 0, JSON.stringify({ confused, ...r }));
  r = await page.evaluate(() => {
    reset(800, 0, 900, 300);
    const g = __game; g.ebullets.push({ x: 1000, y: 280, vx: 0, vy: 0, t: 0, kind: 'hypno', r: 11, harmless: true, shootable: true, onHit() {} });
    g.bullets.push({ x: 990, y: 280, vx: 300, vy: 0, t: 0, owner: g.players[0], kind: 'N', r: 4, dmg: 1 });
    g.collide();
    return g.ebullets.filter((b) => !b.dead && b.kind === 'hypno').length;
  });
  check('a shot pops a hypnosis ring', r === 0, String(r));

  // flame rat: a sweeping stream of flame
  await page.evaluate(() => { reset(1200, 0, 1300, 300); __game.spawn({ t: 'flame', at: 1440, y: 300 }); window.__e = __game.enemies[0]; __e.cool = 0.05; window.__angs = new Set(); });
  for (let i = 0; i < 25; i++) { await sleep(50); await page.evaluate(() => { for (const b of __game.ebullets) if (b.kind === 'flame') __angs.add(Math.round(Math.atan2(b.vy, b.vx) * 10)); }); }
  r = await page.evaluate(() => [...__angs]);
  check('flame rat sweeps a stream of fire', r.length >= 3, JSON.stringify(r));

  // tesla rat: marks the spot, then strikes it — step away and you're safe
  await page.evaluate(() => { reset(1800, 0, 1900, 300); const g = __game; g.players[0].inv = 0; g.spawn({ t: 'tesla', at: 2150, y: 300 }); window.__e = g.enemies[0]; __e.cool = 0.05; __e.fenceT = 99; });
  await sleep(300);
  const marked = await page.evaluate(() => !!__e.mark);
  await page.evaluate(() => { __game.players[0].x += 90; });
  await sleep(900);
  r = await page.evaluate(() => __game.players[0].hp);
  check('tesla rat marks a spot first; stepping off it dodges the strike', marked && r === 3, JSON.stringify({ marked, hp: r }));
  // two tesla rats: a fence at head height — ducking passes under it
  r = await page.evaluate(() => {
    reset(1800, 0, 2000, 300);
    const g = __game; g.spawn({ t: 'tesla', at: 1920, y: 300 }); g.spawn({ t: 'tesla', at: 2200, y: 300 });
    const [a, b] = g.enemies; a.cool = b.cool = 99; a.facing = 1; b.facing = -1;
    return { a: Math.round(a.coil().y), top: Math.round(g.players[0].y), crouchTop: Math.round(g.players[0].y + 18), floor: 300 };
  });
  check('tesla fence runs at head height (over a crouching hero)', r.a > r.top && r.a < r.crouchTop, JSON.stringify(r));

  // spider-bot: crawls on the ceiling, lowers itself on a thread over a hero, drops
  await page.evaluate(() => { reset(1400, 0, 1500, 300); __game.spawn({ t: 'spider', at: 1560, ceil: 44 }); window.__e = __game.enemies[0]; window.__m = new Set(); });
  for (let i = 0; i < 40; i++) { await sleep(60); await page.evaluate(() => __m.add(__e.mode)); }
  r = await page.evaluate(() => [...__m]);
  check('spider-bot crawls, dangles on a thread, drops', ['crawl', 'dangle', 'drop'].every((m) => r.includes(m)), JSON.stringify(r));

  // the freight lift: sets off when a hero steps on, the camera rides down with it, it waits for the drill digger
  await page.evaluate(() => {
    reset(2600, 0, 2800, 300);
    const g = __game; const L = g.level.lift; L.y = 300; L.moving = false; g.level.drillDone = false; g.level.camMode = 'A';
    const i = g.level.spawns.findIndex((s) => s.yb != null); g.spawnIdx = i; window.__fast = 4;
  });
  await sleep(3500);
  r = await page.evaluate(() => { const g = __game; return { moving: g.level.lift.moving, liftY: Math.round(g.level.lift.y), camy: Math.round(g.cam.y), mode: g.level.camMode, drill: !!g.level.drill && !g.level.drill.dead }; });
  check('lift descends with the camera and stops for the drill digger', r.moving && r.mode === 'shaft' && r.liftY === 1200 && r.camy > 800 && r.drill, JSON.stringify(r));

  // drill digger: drills right across the lift (a low one hits a standing hero, a high one misses a crouching one),
  // throws saws that bounce off the shaft walls, leaps to the other wall
  await page.evaluate(() => { window.__fast = 1; const d = __game.level.drill; d.delay = 0; window.__d = d; window.__ds = new Set(); });
  for (let i = 0; i < 120; i++) {
    await sleep(60);
    await page.evaluate(() => { __ds.add(__d.state); if (__game.ebullets.some((b) => b.kind === 'saw' && b.bounces < 3)) __ds.add('bounced'); });
  }
  r = await page.evaluate(() => {
    const d = __d; const L = __game.level.lift;
    const stand = { x: 2700, y: L.y - 46 + 4, w: 18, h: 40 };
    const duck = { x: 2700, y: L.y - 28 + 4, w: 18, h: 22 };
    d.side = -1; d.x = d.wallX();
    d.drill = { h: 12, ext: 1 }; const lowStand = d.touches(stand);
    d.drill = { h: 38, ext: 1 }; const highStand = d.touches(stand); const highDuck = d.touches(duck);
    d.drill = null;
    return { lowStand, highStand, highDuck };
  });
  const ds = await page.evaluate(() => [...__ds]);
  check('drill digger: drill at jump or duck height', r.lowStand && r.highStand && !r.highDuck, JSON.stringify(r));
  check('drill digger drills, throws bouncing saws, swaps walls', ['drill', 'saw', 'swap'].every((s) => ds.includes(s)) && ds.includes('bounced'), JSON.stringify(ds));
  await page.evaluate(() => __d.damage(999, __game.players[0]));
  await sleep(300);
  r = await page.evaluate(() => ({ done: __game.level.drillDone, lock: __game.lock, item: __game.items.some((it) => it.type === 'M') }));
  check('beating the drill digger lets the lift go on', r.done && r.lock === null && r.item, JSON.stringify(r));

  // spider mech: walks (stomps, rings, eggs), climbs to the ceiling (beam that hypnotises, bombs), flies as a cockpit
  await page.evaluate(() => {
    reset(6760, 2000, 6900, 2300);
    const g = __game; const i = g.level.spawns.findIndex((s) => s.t === 'spidermech'); g.spawnIdx = i; g.level.camMode = 'C';
  });
  await sleep(400);
  await page.evaluate(() => { window.__m = __game.bossTarget; __m.delay = 0; window.__ms = new Set(); window.__fast = 3; });
  for (let i = 0; i < 120; i++) { await sleep(60); await page.evaluate(() => __ms.add(__m.state)); }
  const s1 = await page.evaluate(() => [...__ms]);
  await page.evaluate(() => { __ms.clear(); __m.damage(__m.hp - __m.maxHp * 0.55, __game.players[0]); __m.plan = 0; });
  for (let i = 0; i < 160; i++) { await sleep(60); await page.evaluate(() => { __ms.add(__m.state); if (__m.beam && __m.beam.on) __ms.add('beam-on'); }); }
  const s2 = await page.evaluate(() => [...__ms]);
  const beamHit = await page.evaluate(() => {
    const g = __game; const p = g.players[0]; p.inv = 0; p.confused = 0; p.hp = 3;
    __m.state = 'beam'; __m.beam = { x: p.cx, dir: 1, t: 0.5, on: true };
    __m.update(0.016);
    return { hp: p.hp, confused: p.confused > 0 };
  });
  await page.evaluate(() => { __ms.clear(); __game.players[0].inv = 999; __m.damage(__m.hp - __m.maxHp * 0.2, __game.players[0]); __m.plan = 0; });
  for (let i = 0; i < 160; i++) { await sleep(60); await page.evaluate(() => __ms.add(__m.state)); }
  const s3 = await page.evaluate(() => ({ st: [...__ms], phase: __m.phase }));
  check('spider mech phase 1: walks, stomps, fires rings, lays spider-bots', ['walk', 'stomp', 'rings', 'eggs'].every((s) => s1.includes(s)), JSON.stringify(s1));
  check('spider mech phase 2: climbs onto the ceiling, beam sweeps, bombs', ['climb', 'hang', 'beam', 'beam-on', 'bombs'].every((s) => s2.includes(s)), JSON.stringify(s2));
  check('the brainwave beam hurts and hypnotises', beamHit.hp === 2 && beamHit.confused, JSON.stringify(beamHit));
  check('spider mech phase 3: the cockpit flies and dives', s3.phase === 3 && ['fall', 'fly', 'dive'].every((s) => s3.st.includes(s)), JSON.stringify(s3));
  await page.evaluate(() => { window.__fast = 1; __m.damage(9999, __game.players[0]); });
  await sleep(4700);
  r = await page.evaluate(() => ({ state: __game.state, title: document.getElementById('clearTitle').textContent, next: !document.getElementById('btnNext').hidden }));
  check('wrecking the spider mech clears stage 4 (last stage for now)', r.state === 'clear' && /4/.test(r.title) && !r.next, JSON.stringify(r));

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
