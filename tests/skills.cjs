// Skill checks: the "ready" cue, Blaze's screen-crossing beam, Gulp's piercing spit. Usage: node tests/skills.cjs
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);

// empty stage, both heroes safe on the ground; rats pinned level with player `idx` at the given distances
const setupRats = (args) => {
  const [idx, dists, hp] = args;
  const g = __game; const p = g.players[idx];
  g.enemies = []; g.ebullets = []; g.bullets = []; g.spawnIdx = 9999; g.runnerT = 999;
  for (const q of g.players) { q.inv = 999; q.skillT = 0; q.energy = 0; }
  window.__rats = dists.map((d) => {
    g.spawn({ t: 'rat', at: p.x + d, y: 300 });
    const rat = g.enemies[g.enemies.length - 1];
    rat.cool = 999; rat.hp = hp; rat.maxHp = hp;
    rat.update = function () { this.x = p.x + d; this.y = p.y + p.h * 0.45 - 18; this.vy = 0; };
    rat.update();
    return rat;
  });
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.click('[data-mode="classic"]');
  await page.click('#btn2p');
  await sleep(2600);
  const ids = await page.evaluate(() => __game.players.map((p) => p.char.id));
  const bi = ids.indexOf('blaze');
  const gi = ids.indexOf('gulp');
  const skillKey = (i) => (i === 0 ? 'KeyI' : 'Numpad5');

  // crossing the skill cost pops a cue over the hero, once
  await page.evaluate((i) => { const p = __game.players[i]; p.energy = 49; }, bi);
  await sleep(100);
  await page.evaluate((i) => { const p = __game.players[i]; p.energy = 50; }, bi);
  await sleep(100);
  let r = await page.evaluate((i) => ({
    ready: __game.players[i].skillReady,
    cues: __game.effects.filter((f) => typeof f.text === 'string' && f.text.startsWith('必殺OK')).map((f) => f.text),
  }), bi);
  check('skill ready: cue with the key to press', r.ready && r.cues.length === 1 && /I/.test(r.cues[0]), JSON.stringify(r));
  await sleep(200);
  r = await page.evaluate(() => __game.effects.filter((f) => typeof f.text === 'string' && f.text.startsWith('必殺OK')).length);
  check('skill ready cue is not repeated every frame', r <= 1, String(r));

  // Blaze: one beam reaches the far side of the screen and hits everything along it
  await page.evaluate(setupRats, [bi, [140, 300, 560], 6]);
  await page.evaluate((i) => { __game.players[i].energy = 100; }, bi);
  await sleep(60);
  await page.keyboard.down(skillKey(bi)); await sleep(60); await page.keyboard.up(skillKey(bi));
  await sleep(100);
  r = await page.evaluate(() => ({ dead: __rats.map((e) => e.dead), beam: __game.effects.some((f) => f.constructor.name === 'EyeBeam') }));
  check('Blaze beam crosses the screen and hits every enemy in line', r.dead.every(Boolean) && r.beam, JSON.stringify(r));

  // Gulp: an empty belly still spits a fan when the swallow ends
  await page.evaluate(setupRats, [gi, [], 1]);
  await page.evaluate((i) => { __game.players[i].energy = 100; }, gi);
  await sleep(60);
  await page.keyboard.down(skillKey(gi)); await sleep(60); await page.keyboard.up(skillKey(gi));
  await sleep(1800);
  r = await page.evaluate(() => {
    const s = __game.bullets.filter((b) => b.kind === 'spit');
    return { n: s.length, pierce: s.every((b) => b.pierce) };
  });
  check('Gulp spits even with an empty belly, and the spit pierces', r.n >= 8 && r.pierce, JSON.stringify(r));

  // Gulp: reaches further, and the spit goes through a line of enemies
  await page.evaluate(setupRats, [gi, [200, 420], 2]);
  await page.evaluate((i) => { __game.players[i].energy = 100; }, gi);
  await sleep(60);
  await page.keyboard.down(skillKey(gi)); await sleep(60); await page.keyboard.up(skillKey(gi));
  await sleep(60);
  await page.evaluate((i) => {
    const g = __game; const p = g.players[i];
    g.ebullets.push({ x: p.cx + 100, y: p.cy, vx: -10, vy: 0, t: 0, kind: 'enemy', r: 4 });
  }, gi);
  await sleep(150);
  const sw = await page.evaluate((i) => __game.players[i].swallowed, gi);
  check('Gulp swallows a bullet 100px away', sw >= 1, 'swallowed=' + sw);
  await sleep(2200);
  r = await page.evaluate(() => __rats.map((e) => e.dead));
  check('Gulp spit pierces a line of enemies', r.every(Boolean), JSON.stringify(r));

  // generated skill art is in the manifest (beam, its flare and splash, Gulp's vortex)
  r = await page.evaluate(() => fetch('assets/sprites/gen/manifest.json').then((x) => x.json()).then((m) => Object.keys(m.skill || {})));
  check('skill effect art loaded', ['beam', 'flare', 'splash', 'vortex'].every((k) => r.includes(k)), JSON.stringify(r));
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
