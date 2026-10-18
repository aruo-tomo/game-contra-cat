// Stage 2 (pet hospital): stage select, going on from stage 1, every new enemy / hazard, moving
// platforms and both bosses. Usage: node tests/stage2.cjs
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);

// empty stage at camera x; P1 stands still, never fires, can't be hurt unless a test says so
const reset = (camx = 600) => {
  const g = __game; const p = g.players[0];
  g.enemies = []; g.ebullets = []; g.bullets = []; g.spawnIdx = 9999; g.runnerT = 999; g.lock = null; g.bossTarget = null;
  g.cam.x = camx;
  p.inv = 999; p.hp = 3; p.lives = 99; p.catnip = 0; p.x = camx + 120; p.y = 200; p.vx = 0; p.vy = 0; p.state = 'alive';
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

  // ---- going on from stage 1 ----
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game);
  let r = await page.evaluate(() => document.getElementById('stageSeg').hidden);
  check('stage select hidden before stage 1 is cleared', r === true, String(r));
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(1500);
  await page.evaluate(() => { const p = __game.players[0]; p.weapon = { type: 'L', lvl: 2 }; p.lives = 7; __game.stageClear(); });
  await sleep(1900);
  r = await page.evaluate(() => ({ title: document.getElementById('clearTitle').textContent, next: !document.getElementById('btnNext').hidden, unlocked: JSON.parse(localStorage.getItem('contracat.options.v1')).unlocked }));
  check('stage 1 clear offers the next stage and unlocks it', r.next && r.unlocked === 2 && /1/.test(r.title), JSON.stringify(r));
  await page.click('#btnNext');
  await sleep(600);
  r = await page.evaluate(() => { const g = __game; const p = g.players[0]; return { n: g.stage.n, state: g.state, lives: p.lives, w: p.weapon.type + p.weapon.lvl, cam: g.cam.x, ceil: g.level.solids.some((s) => s.kind === 'ceil') }; });
  check('next stage is the hospital, lives and gun carry over', r.n === 2 && r.state === 'play' && r.lives === 7 && r.w === 'L2' && r.cam === 0 && r.ceil, JSON.stringify(r));

  // ---- ?stage=2 starts there; the stage picker shows once unlocked ----
  await page.goto(URL + '?stage=2');
  await page.waitForFunction(() => window.__game);
  r = await page.evaluate(() => ({ seg: !document.getElementById('stageSeg').hidden, two: document.querySelector('[data-stage="1"]').getAttribute('aria-pressed') }));
  check('stage picker shows and ?stage=2 preselects stage 2', r.seg && r.two === 'true', JSON.stringify(r));
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(2200);
  r = await page.evaluate(() => __game.stage.n);
  check('?stage=2 starts stage 2', r === 2, String(r));

  // nurse: a fan of three arcing syringes, and heals a hurt soldier next to her
  await page.evaluate(reset);
  await page.evaluate(() => {
    const g = __game; const p = g.players[0];
    g.spawn({ t: 'nurse', at: p.x + 250, y: 300 }); g.spawn({ t: 'rat', at: p.x + 300, y: 300 });
    window.__n = g.enemies[0]; window.__r = g.enemies[1]; __n.cool = 0.05; __n.healT = 0.1; __r.hp = 1; __r.cool = 99;
  });
  await sleep(350);
  r = await page.evaluate(() => ({ syr: __game.ebullets.filter((b) => b.kind === 'syringe' && b.gravity > 0).length, hp: __r.hp }));
  check('nurse throws three arcing syringes and heals a hurt rat', r.syr === 3 && r.hp > 1, JSON.stringify(r));

  // shield guard: front shots bounce off; when it swings the shield aside to fire it can be hurt
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; g.spawn({ t: 'shield', at: p.x + 200, y: 300 }); window.__e = g.enemies[0]; __e.cycle = 99; });
  await sleep(200);
  const shoot = () => { const g = __game; const p = g.players[0]; g.bullets.push({ x: __e.cx - 30, y: __e.cy, vx: 600, vy: 0, t: 0, owner: p, kind: 'N', r: 4, dmg: 1 }); };
  await page.evaluate(shoot);
  await sleep(200);
  const guarded = await page.evaluate(() => __e.hp);
  await page.evaluate(() => { __e.open = 1.1; __e.shots = 0; });
  await page.evaluate(shoot);
  await sleep(150);
  r = await page.evaluate(() => __e.hp);
  check('shield guard blocks front shots, open shield takes damage', guarded === 5 && r === 4, JSON.stringify({ guarded, open: r }));

  // sprayer: gas puffs that slow down and hang in the air, hurting a hero who walks in
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; p.inv = 0; g.spawn({ t: 'sprayer', at: p.x + 110, y: 300 }); window.__e = g.enemies[0]; __e.cool = 0.05; });
  await sleep(1300);
  r = await page.evaluate(() => { const gas = __game.ebullets.filter((b) => b.kind === 'gas'); return { n: gas.length, slow: gas.every((b) => Math.abs(b.vx) < 60), hp: __game.players[0].hp }; });
  check('sprayer leaves lingering gas that hurts', r.n >= 2 && r.slow && r.hp < 3, JSON.stringify(r));

  // cone cat: yowls a wave along the floor — it hurts a standing hero, a jumping hero clears it
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; p.inv = 0; p.y = 254; g.spawn({ t: 'cone' }); window.__e = g.enemies[g.enemies.length - 1]; __e.x = p.x + 220; __e.cool = 0.01; });
  let wave = false;
  for (let i = 0; i < 20 && !wave; i++) { await sleep(60); wave = await page.evaluate(() => __game.ebullets.some((b) => b.kind === 'wave')); }
  await sleep(1000);
  r = await page.evaluate(() => ({ hp: __game.players[0].hp, cat: __e.cat }));
  check('cone cat yowl sends a floor wave that hurts', wave && r.hp < 3 && r.cat === 'cone', JSON.stringify({ wave, ...r }));
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; p.inv = 0; p.y = 254; g.ebullets.push({ x: p.cx + 110, y: 290, vx: -230, vy: 0, t: 0, kind: 'wave', r: 10, linger: true }); });
  await page.evaluate(() => { __in.jump = true; __in.jumpHeld = true; });
  await sleep(80);
  await page.evaluate(() => { __in.jump = false; });
  await sleep(700);
  r = await page.evaluate(() => __game.players[0].hp);
  check('jumping clears the floor wave', r === 3, String(r));

  // vent rat: hangs from the ceiling, drops pill bombs, then lets go and lands
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; g.spawn({ t: 'vent', at: p.x + 40 }); window.__e = g.enemies[0]; window.__pills = 0; });
  for (let i = 0; i < 70; i++) {
    await sleep(60);
    await page.evaluate(() => { __pills = Math.max(__pills, __game.ebullets.filter((b) => b.kind === 'pill' && b.bomb).length); });
  }
  r = await page.evaluate(() => ({ pills: __pills, hang: __e.hang, onGround: !!__e.onGround, dead: __e.dead }));
  check('vent rat drops pill bombs, then drops to the floor', r.pills >= 1 && !r.hang && (r.onGround || r.dead), JSON.stringify(r));

  // laser gate: hurts only while on; shooting the emitter turns it off for good
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; g.spawn({ t: 'gate', at: p.cx, ph: 0 }); window.__e = g.enemies[0]; p.y = 254; });
  r = await page.evaluate(() => { const p = __game.players[0]; const box = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 6 }; __e.t = 0.2; const on = __e.touches(box); __e.t = 1.6; const off = __e.touches(box); return { on, off }; });
  await page.evaluate(() => { __e.damage(99, __game.players[0]); __e.t = 0.2; });
  const gone = await page.evaluate(() => { const p = __game.players[0]; return __e.touches({ x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 6 }); });
  check('laser gate hurts only while on, and can be shot out', r.on && !r.off && !gone, JSON.stringify({ ...r, gone }));

  // wall laser: charge, then a beam; a head-height beam passes over a crouching hero
  await page.evaluate(reset);
  await page.evaluate(() => { const g = __game; const p = g.players[0]; g.spawn({ t: 'beam', at: p.x + 300, y: 264 }); window.__e = g.enemies[0]; __e.modeT = 0.05; window.__modes = new Set(); p.y = 254; });
  for (let i = 0; i < 20; i++) { await sleep(60); await page.evaluate(() => __modes.add(__e.mode)); }
  r = await page.evaluate(() => {
    const p = __game.players[0]; __e.mode = 'fire';
    const stand = __e.touches({ x: p.x + 4, y: 254 + 4, w: p.w - 8, h: 46 - 6 });
    const duck = __e.touches({ x: p.x + 4, y: 272 + 4, w: p.w - 8, h: 28 - 6 });
    return { modes: [...__modes], stand, duck };
  });
  check('wall laser charges then fires; ducking dodges a head-high beam', r.modes.includes('charge') && r.modes.includes('fire') && r.stand && !r.duck, JSON.stringify(r));

  // moving platforms: the lift carries a hero up to the upper ward; a gurney carries sideways
  await page.evaluate(() => {
    reset(4300);
    const g = __game; const p = g.players[0]; const lift = g.level.movers.find((m) => m.kind === 'lift');
    lift.y = 300; lift.vy = -60; lift.wait = 0; p.x = lift.x + 40; p.y = lift.y - p.h - 2; p.vy = 0;
  });
  await sleep(2600);
  r = await page.evaluate(() => { const p = __game.players[0]; const lift = __game.level.movers.find((m) => m.kind === 'lift'); return { py: Math.round(p.y + p.h), ly: Math.round(lift.y), on: p.groundRef === lift }; });
  check('lift carries the hero up', r.on && r.ly < 260 && Math.abs(r.py - r.ly) < 3, JSON.stringify(r));
  await page.evaluate(() => {
    reset(1300);
    const g = __game; const p = g.players[0]; const m = g.level.movers.find((q) => q.kind === 'gurney');
    m.x = m.x0; m.vx = Math.abs(m.vx); p.x = m.x + 20; p.y = m.y - p.h - 2; window.__x0 = p.x;
  });
  await sleep(1200);
  r = await page.evaluate(() => Math.round(__game.players[0].x - __x0));
  check('gurney carries the hero along', r > 30, 'moved ' + r);

  // head nurse mid-boss: locks the arena, charges with the lance, drops the laser when beaten
  await page.evaluate(() => { reset(2900); const g = __game; const i = g.level.spawns.findIndex((s) => s.t === 'headnurse'); g.cam.x = 3000; g.spawnIdx = i; });
  await sleep(300);
  await page.evaluate(() => { const g = __game; window.__b = g.bossTarget; __b.delay = 0; window.__st = new Set(); });
  for (let i = 0; i < 90; i++) { await sleep(60); await page.evaluate(() => { if (__b.dashing) __st.add('dash'); __st.add(__b.state); }); }
  r = await page.evaluate(() => ({ st: [...__st], lock: __game.lock && __game.lock.x, name: __b.boss }));
  await page.evaluate(() => __b.damage(999, __game.players[0]));
  await sleep(200);
  const after = await page.evaluate(() => ({ lock: __game.lock, item: __game.items.some((it) => it.type === 'L') }));
  check('head nurse charges, throws, and unlocks the arena when beaten', r.lock === 3000 && r.st.includes('dash') && r.st.includes('fan') && after.lock === null && after.item, JSON.stringify({ ...r, ...after }));

  // surgery machine: four parts; the jar is armoured while others stand; breaking it clears the stage
  await page.evaluate(() => { reset(7000); const g = __game; const i = g.level.spawns.findIndex((s) => s.t === 'surgeon'); g.cam.x = 7040; g.spawnIdx = i; });
  await sleep(300);
  r = await page.evaluate(() => {
    const g = __game; const core = g.bossTarget; const wall = core.wall;
    const kinds = wall.parts.map((p) => p.kind).sort().join(',');
    const hp0 = core.hp; core.damage(10, g.players[0]); const armoured = hp0 - core.hp;
    for (const p of wall.parts) if (p !== core) p.damage(999, g.players[0]);
    const hp1 = core.hp; core.damage(10, g.players[0]); const open = hp1 - core.hp;
    return { kinds, armoured, open };
  });
  check('surgery machine has cannon / arm / lamp / jar, jar armoured until alone', r.kinds === 'arm,cannon,core,lamp' && r.armoured === 5 && r.open === 10, JSON.stringify(r));
  // the scalpel arm locks on and stabs; the lamp marks the floor before its laser falls
  r = await page.evaluate(() => {
    reset(7000);
    const g = __game; const i = g.level.spawns.findIndex((s) => s.t === 'surgeon'); g.cam.x = 7040; g.spawnIdx = i;
    return true;
  });
  await sleep(300);
  await page.evaluate(() => { const w = __game.bossTarget.wall; for (const p of w.parts) p.cool = 0.01; window.__w = w; window.__seen = new Set(); });
  for (let i = 0; i < 30; i++) {
    await sleep(60);
    await page.evaluate(() => { const arm = __w.parts.find((p) => p.kind === 'arm'); if (arm.stab) __seen.add('stab:' + arm.stab.phase); for (const c of __w.columns) __seen.add('col:' + c.mode); });
  }
  r = await page.evaluate(() => [...__seen]);
  check('scalpel arm aims then stabs; lamp marks then fires', r.includes('stab:aim') && r.includes('stab:out') && r.includes('col:mark') && r.includes('col:fire'), JSON.stringify(r));
  await page.evaluate(() => __game.bossTarget.damage(9999, __game.players[0]));
  await sleep(4300);
  r = await page.evaluate(() => ({ state: __game.state, title: document.getElementById('clearTitle').textContent, next: !document.getElementById('btnNext').hidden }));
  check('breaking the jar clears stage 2 and offers stage 3', r.state === 'clear' && /2/.test(r.title) && r.next, JSON.stringify(r));

  // English text for the new stage
  await page.goto(URL + '?stage=2&lang=en');
  await page.waitForFunction(() => window.__game);
  r = await page.evaluate(() => document.getElementById('stageLabel').textContent);
  check('stage picker label in English', r === 'Stage', r);

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
