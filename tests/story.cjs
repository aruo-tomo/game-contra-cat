// English version and the opening comic. Usage: node tests/story.cjs
const { chromium } = require('playwright');
const BASE = process.env.GAME_URL || 'http://localhost:8765/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);
const visibleChinese = () => [...document.querySelectorAll('body *')]
  .filter((e) => e.children.length === 0 && e.offsetParent && /[一-鿿]/.test(e.textContent) && !e.closest('.logo-mark, [lang="zh-HK"]'))
  .map((e) => e.textContent.trim());

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // English: every visible label on the title screen is English
  await page.goto(BASE + '?lang=en&story=1');
  await page.waitForFunction(() => window.__game);
  let r = await page.evaluate(() => ({ lang: document.documentElement.lang, solo: document.querySelector('#btn1p span').textContent }));
  const zh = await page.evaluate(visibleChinese);
  check('English title screen: no Chinese left', r.lang === 'en' && r.solo === 'Solo Mission' && zh.length === 0, JSON.stringify({ ...r, zh: zh.slice(0, 5) }));

  // first start plays the comic: 6 panels with captions and bubbles, then the game begins
  await page.click('#btn1p');
  await sleep(400);
  r = await page.evaluate(() => ({ open: !document.getElementById('story').hidden, img: document.getElementById('storyImg').src, cap: document.querySelector('.story-cap').textContent }));
  check('first start opens the comic (panel 1, English caption)', r.open && /story_1\.jpg/.test(r.img) && /Meow City/.test(r.cap), JSON.stringify(r));
  const seen = [];
  for (let i = 0; i < 6; i++) {
    seen.push(await page.evaluate(() => ({ n: document.getElementById('storyImg').src.match(/story_(\d)/)[1], says: document.querySelectorAll('.story-say').length, loaded: document.getElementById('storyImg').complete && document.getElementById('storyImg').naturalWidth > 0 })));
    await page.keyboard.press('Space');
    await sleep(250);
  }
  check('six panels in order, all images load, bubbles on 2/4/5', seen.map((s) => s.n).join('') === '123456' && seen.every((s) => s.loaded) && seen[1].says === 1 && seen[3].says === 2 && seen[4].says === 2, JSON.stringify(seen));
  await sleep(300);
  r = await page.evaluate(() => ({ state: __game.state, hidden: document.getElementById('story').hidden, name: __game.players[0].char.name }));
  check('after the last panel the game starts', r.state === 'play' && r.hidden && r.name === 'Blaze', JSON.stringify(r));

  // second start skips the comic; the title button replays it; Skip closes it
  await page.keyboard.press('Escape');
  await page.click('#btnQuit');
  await sleep(200);
  await page.click('#btn1p');
  await sleep(300);
  r = await page.evaluate(() => ({ state: __game.state, story: !document.getElementById('story').hidden }));
  check('second start goes straight into the game', r.state === 'play' && !r.story, JSON.stringify(r));
  await page.keyboard.press('Escape');
  await page.click('#btnQuit');
  await sleep(200);
  await page.click('#btnStory');
  await sleep(300);
  const open = await page.evaluate(() => !document.getElementById('story').hidden);
  await page.click('#storySkip');
  await sleep(200);
  r = await page.evaluate(() => ({ story: !document.getElementById('story').hidden, title: !document.getElementById('title').hidden, state: __game.state }));
  check('Story button replays it, Skip returns to the title', open && !r.story && r.title && r.state === 'title', JSON.stringify(r));

  // in-game text is English too
  await page.click('[data-mode="classic"]');
  await page.click('#btn1p');
  await sleep(600);
  r = await page.evaluate(() => { const p = __game.players[0]; p.weapon = { type: 'N', lvl: 1 }; p.pickup('L'); return __game.effects.filter((f) => typeof f.text === 'string').map((f) => f.text); });
  check('in-game pickup text in English', r.some((s) => s === 'Laser Pointer'), JSON.stringify(r));

  // language toggle switches to Chinese and is remembered
  await page.keyboard.press('Escape');
  await page.click('#btnQuit');
  await page.click('[data-lang="zh"]');
  await page.waitForFunction(() => window.__game && document.documentElement.lang === 'zh-HK');
  r = await page.evaluate(() => ({ solo: document.querySelector('#btn1p span').textContent, url: location.search }));
  await page.goto(BASE);
  await page.waitForFunction(() => window.__game);
  const kept = await page.evaluate(() => document.querySelector('#btn1p span').textContent);
  check('language toggle to Chinese, remembered on reload', r.solo === '單人出擊' && kept === '單人出擊', JSON.stringify({ ...r, kept }));

  // brand footer on the title screen and the copyright page (Chinese here, English below)
  r = await page.evaluate(() => ({ logo: document.querySelector('.foot-logo').complete && document.querySelector('.foot-logo').naturalWidth > 0, line: document.querySelector('.cover-foot').textContent.replace(/\s+/g, ' ').trim() }));
  await page.click('#btnCopyright');
  const legal = await page.evaluate(() => ({ open: !document.getElementById('copyright').hidden, by: document.querySelector('.legal-by').textContent, logo: document.querySelector('.legal-logo').naturalWidth > 0 }));
  await page.click('#btnCopyrightDone');
  const back = await page.evaluate(() => !document.getElementById('title').hidden);
  check('footer: aruo entertainment logo and copyright; copyright page opens and closes', r.logo && /© 2026 Aruo Co\. Ltd/.test(r.line) && legal.open && legal.logo && legal.by === 'aruo entertainment by Aruo Co. Ltd' && back, JSON.stringify({ ...r, ...legal, back }));
  await page.goto(BASE + '?lang=en');
  await page.waitForFunction(() => window.__game);
  r = await page.evaluate(() => document.querySelector('.cover-foot').textContent.replace(/\s+/g, ' ').trim());
  check('English footer', /All rights reserved\./.test(r) && /Copyright/.test(r), r);
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
})().catch((e) => { console.log(results.join('\n')); console.error('TEST CRASH', e.message); process.exit(1); });
