// Stage 3 (fish-tank falls): the climb, swimming and air, bubble trails, currents, the new enemies,
// the pirate captain and the robot koi's phases. Usage: node tests/stage3.cjs
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);

// empty view at camera height camy; P1 at (x, y), standing still, not firing, can't be hurt unless a test says so
const reset = (camy, x = 300, y = null) => {
  const g = __game; const p = g.players[0];
  g.enemies = []; g.ebullets = []; g.bullets = []; g.spawnIdx = 9999; g.lock = null; g.bossTarget = null;
  g.cam.y = camy;
  p.inv = 999; p.hp = 3; p.lives = 99; p.catnip = 0; p.air = 1; p.state = 'alive'; p.vx = 0; p.vy = 0;
  p.x = x; p.y = y ?? camy + 200;
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

  // ---- going on from stage 2 ----
  await page.goto(URL + '?stage=2');
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(1200);
  await page.evaluate(() => __game.stageClear());
  await sleep(1900);
  await page.click('#btnNext');
  await sleep(500);
  let r = await page.evaluate(() => ({ n: __game.stage.n, vertical: __game.vertical, camy: Math.round(__game.cam.y) }));
  check('stage 2 leads on to the vertical stage 3', r.n === 3 && r.vertical && r.camy > 4000, JSON.stringify(r));

  await page.goto(URL + '?stage=3');
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(2500);
  r = await page.evaluate(() => { const p = __game.players[0]; return { water: p.inWater, y: Math.round(p.y + p.h), swimArt: p.pose().f && p.pose().f.file }; });
  check('stage 3 starts under water at the bottom of the tank', r.water && r.y > 4900, JSON.stringify(r));

  // swimming: a stroke pushes up, then the hero sinks slowly; airborne in water shows the swim art with the gun
  await page.evaluate(() => reset(4600, 470, 4900));
  await sleep(500);
  const sink = await page.evaluate(() => Math.round(__game.players[0].vy));
  await page.evaluate(() => { __in.jump = true; });
  await sleep(50);
  await page.evaluate(() => { __in.jump = false; });
  await sleep(60);
  r = await page.evaluate(() => { const p = __game.players[0]; const f = p.pose().f; return { vy: Math.round(p.vy), file: f && f.file, muzzle: !!p.muzzle() }; });
  check('swim: slow sinking, a stroke pushes up, swim art with a muzzle', sink > 0 && sink <= 110 && r.vy < -100 && /swim/.test(r.file || '') && r.muzzle, JSON.stringify({ sink, ...r }));

  // bubbles trail behind a swimmer
  await page.evaluate(() => { reset(4600, 470, 4900); __in.mx = 1; });
  await sleep(900);
  r = await page.evaluate(() => __game.effects.filter((f) => f.bubble).length);
  check('swimming leaves a bubble trail', r >= 2, String(r));

  // air: runs down under water, at zero the hero chokes; out of the water it refills
  await page.evaluate(() => { reset(4600, 470, 4900); const p = __game.players[0]; p.inv = 0; p.air = 0.02; });
  await sleep(900);
  r = await page.evaluate(() => ({ air: __game.players[0].air, hp: __game.players[0].hp }));
  check('running out of air hurts', r.air === 0 && r.hp < 3, JSON.stringify(r));
  await page.evaluate(() => { reset(3700, 460, 3900); __game.players[0].air = 0.3; });
  await sleep(600);
  r = await page.evaluate(() => ({ water: __game.players[0].inWater, air: +__game.players[0].air.toFixed(2) }));
  check('air refills out of the water', !r.water && r.air > 0.5, JSON.stringify(r));

  // camera: under water it follows the heroes back down; on land it only ever goes up
  await page.evaluate(() => { reset(4600, 470, 5000); });
  await sleep(700);
  const camWater = await page.evaluate(() => Math.round(__game.cam.y));
  await page.evaluate(() => reset(3500, 60, 3500));
  await sleep(200);
  await page.evaluate(() => { const p = __game.players[0]; p.y = 3600; p.x = 300; window.__c0 = __game.cam.y; });
  await sleep(500);
  r = await page.evaluate(() => ({ moved: Math.round(__game.cam.y - __c0) }));
  check('camera follows down under water but never down on land', camWater > 4600 && r.moved <= 0, JSON.stringify({ camWater, ...r }));

  // falling out of the bottom of the view on land costs a life
  await page.evaluate(() => { reset(3000, 300, 3000); const p = __game.players[0]; p.inv = 0; window.__lives = p.lives; p.y = 3460; });
  await sleep(300);
  r = await page.evaluate(() => __game.players[0].lives < __lives || __game.players[0].state !== 'alive');
  check('falling out of the view loses a life', r, String(r));

  // the waterfall pushes you down
  r = await page.evaluate(() => {
    reset(3500, 300, 3600);
    const g = __game; const p = g.players[0];
    p.x = 305; p.y = 3600; p.vy = 0; p.onGround = false; g.stage.update(g.level, g, 0.1); const inFall = p.vy;
    p.x = 120; p.vy = 0; g.stage.update(g.level, g, 0.1); const outside = p.vy;
    return { inFall: Math.round(inFall), outside: Math.round(outside) };
  });
  check('the waterfall current pushes down', r.inFall > 50 && r.outside === 0, JSON.stringify(r));

  // bubble platform pops after you stand on it, then comes back
  r = await page.evaluate(() => {
    reset(3400);
    const g = __game; const p = g.players[0]; const b = g.level.bubbles[0];
    p.onGround = true; p.groundRef = b;
    for (let i = 0; i < 10; i++) g.stage.update(g.level, g, 0.1);
    const popped = b.state;
    p.onGround = false; p.groundRef = null;
    for (let i = 0; i < 30; i++) g.stage.update(g.level, g, 0.1);
    return { popped, back: b.state };
  });
  check('bubble platform pops, then comes back', r.popped === 'pop' && r.back === 'ok', JSON.stringify(r));

  // fishbowl cat: a fishbone boomerang that goes out and comes back
  await page.evaluate(() => { reset(4450, 470, 4600); const g = __game; g.spawn({ t: 'bowl', at: 220, y: 4720 }); window.__e = g.enemies[0]; __e.cool = 0.05; window.__vx = []; });
  for (let i = 0; i < 25; i++) { await sleep(60); await page.evaluate(() => { const b = __game.ebullets.find((q) => q.kind === 'bone'); if (b) __vx.push(Math.sign(b.vx)); }); }
  r = await page.evaluate(() => ({ out: __vx.includes(1), back: __vx.includes(-1), cat: __e.cat }));
  check('fishbowl cat throws a boomerang that comes back', r.out && r.back && r.cat === 'bowl', JSON.stringify(r));

  // puffer mine: swells near a hero and bursts into 8 spikes; shot early, it just pops
  await page.evaluate(() => { reset(4600, 400, 4900); const g = __game; g.spawn({ t: 'puffer', at: 470, y: 4940 }); window.__e = g.enemies[0]; });
  await sleep(1100);
  r = await page.evaluate(() => ({ dead: __e.dead, spikes: __game.ebullets.filter((b) => b.kind === 'spike').length }));
  await page.evaluate(() => { reset(4600, 100, 4900); const g = __game; g.spawn({ t: 'puffer', at: 470, y: 4940 }); window.__e = g.enemies[0]; __e.damage(9, g.players[0]); });
  await sleep(100);
  const early = await page.evaluate(() => __game.ebullets.filter((b) => b.kind === 'spike').length);
  check('puffer swells and bursts into 8 spikes; shot early it just pops', r.dead && r.spikes === 8 && early === 0, JSON.stringify({ ...r, early }));

  // scuba rat: the harpoon sticks in the tank wall and makes a foothold for a while
  await page.evaluate(() => { reset(4450, 60, 4600); const g = __game; g.level.temps = []; g.spawn({ t: 'scuba', at: 300, y: 4720 }); window.__e = g.enemies[0]; __e.cool = 0.05; });
  await sleep(1500);
  r = await page.evaluate(() => ({ temps: __game.level.temps.length, plat: __game.level.platforms().some((q) => q.kind === 'harpoon') }));
  check('harpoon sticks in the wall as a foothold', r.temps >= 1 && r.plat, JSON.stringify(r));

  // eel: can't be hurt while hidden; bites out of its hole
  r = await page.evaluate(() => {
    reset(4600, 470, 4900);
    const g = __game; g.spawn({ t: 'eel', side: 1, y: 4900 }); const e = g.enemies[0];
    const hidden = e.hittable();
    e.mode = 'bite'; e.out = 1; e.modeT = 9; e.update(0.01);
    const p = g.players[0]; const box = e.bodyBox();
    return { hidden, bites: e.touches({ x: box.x + 10, y: box.y, w: 20, h: 20 }), hittable: e.hittable() };
  });
  check('eel hides (unhittable), then bites out of the wall', !r.hidden && r.bites && r.hittable, JSON.stringify(r));

  // can rat: rolls tins (shootable enemies) along the ledges
  await page.evaluate(() => { reset(3300, 300, 3400); const g = __game; g.spawn({ t: 'canrat', at: 560, y: 3560 }); window.__e = g.enemies[0]; __e.cool = 0.05; g.players[0].x = 300; g.players[0].y = 3500; });
  await sleep(700);
  r = await page.evaluate(() => __game.enemies.filter((e) => e.constructor.name === 'RollingCan').map((e) => Math.round(e.vx)));
  check('can rat rolls tins toward the hero', r.length >= 1 && r[0] < 0, JSON.stringify(r));

  // pirate captain: locks the arena (hatch shut), dashes, throws and reels in the anchor, leaps; freed when beaten
  await page.evaluate(() => { reset(3050, 200, 3150); const g = __game; const i = g.level.spawns.findIndex((s) => s.t === 'pirate'); g.cam.y = g.level.spawns[i].camy; g.spawnIdx = i; });
  await sleep(400);
  await page.evaluate(() => { window.__b = __game.bossTarget; __b.delay = 0; window.__st = new Set(); });
  for (let i = 0; i < 120; i++) {
    await sleep(60);
    await page.evaluate(() => { if (__b.dashing) __st.add('dash'); if (__b.anchor) __st.add('anchor:' + __b.anchor.mode); if (__b.leaping) __st.add('leap'); });
  }
  r = await page.evaluate(() => ({ st: [...__st], lock: __game.lock && __game.lock.y, gate: __game.level.solids.some((s) => s.gate) }));
  await page.evaluate(() => __b.damage(999, __game.players[0]));
  await sleep(300);
  const after = await page.evaluate(() => ({ lock: __game.lock, freed: __game.effects.some((f) => f.key === 'freed_pirate'), item: __game.items.some((it) => it.type === 'F') }));
  check('pirate captain: arena locks, hatch shuts', r.lock != null && r.gate, JSON.stringify(r));
  check('pirate captain dashes, throws and reels in the anchor, leaps', r.st.includes('dash') && r.st.includes('anchor:fly') && r.st.includes('anchor:reel') && r.st.includes('leap'), JSON.stringify(r.st));
  check('pirate captain is freed and the arena opens', after.lock === null && after.freed && after.item, JSON.stringify(after));

  // robot koi: phases by health, a stunned window after a slam, new attacks in phase 2, stage clear at the end
  await page.evaluate(() => { reset(0, 300, 200); const g = __game; const i = g.level.spawns.findIndex((s) => s.t === 'koi'); g.cam.y = g.level.spawns[i].camy; g.spawnIdx = i; g.players[0].y = 300; });
  await sleep(400);
  await page.evaluate(() => { window.__k = __game.bossTarget; __k.delay = 0; window.__ks = new Set(); });
  await page.evaluate(() => { window.__fast = 3; });
  for (let i = 0; i < 200; i++) { await sleep(50); await page.evaluate(() => __ks.add(__k.state)); }
  const p1 = await page.evaluate(() => [...__ks]);
  r = await page.evaluate(() => {
    const k = __k; const g = __game;
    k.state = 'stunned'; k.timer = 9;
    const hp0 = k.hp; k.damage(10, g.players[0]); const stunHit = hp0 - k.hp;
    k.state = 'swim';
    k.damage(k.hp - k.maxHp * 0.5, g.players[0]);
    const phase2 = k.phase;
    return { stunHit, phase2 };
  });
  await page.evaluate(() => { __ks.clear(); __k.plan = 0; });
  for (let i = 0; i < 300; i++) { await sleep(50); await page.evaluate(() => { __ks.add(__k.state); if (__game.enemies.some((e) => e.constructor.name === 'Torpedo')) __ks.add('torpedoes'); }); }
  const p2 = await page.evaluate(() => [...__ks]);
  await page.evaluate(() => { window.__fast = 1; });
  const p3 = await page.evaluate(() => { const k = __k; k.damage(k.hp - k.maxHp * 0.2, __game.players[0]); return { phase: k.phase, frenzy: k.frenzy }; });
  check('koi phase 1: swims, sprays, blows bubbles, rises and slams', ['enter', 'swim', 'spray', 'rise', 'slam'].every((s) => p1.includes(s)), JSON.stringify(p1));
  check('koi takes 1.5x damage while stunned after a slam', r.stunHit === 15, JSON.stringify(r));
  check('koi phase 2 (armour off): torpedoes and the low charge', r.phase2 === 2 && p2.includes('torpedoes') && p2.includes('sweep'), JSON.stringify(p2));
  check('koi phase 3: a frenzy of slams', p3.phase === 3 && p3.frenzy === 3, JSON.stringify(p3));
  await page.evaluate(() => __k.damage(9999, __game.players[0]));
  await sleep(4700);
  r = await page.evaluate(() => ({ state: __game.state, title: document.getElementById('clearTitle').textContent, next: !document.getElementById('btnNext').hidden }));
  check('sinking the koi clears stage 3 (last stage for now)', r.state === 'clear' && /3/.test(r.title) && !r.next, JSON.stringify(r));

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
