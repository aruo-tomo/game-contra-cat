// Opening story: six American-comic panels (generated art, no text in the images) with translated
// caption boxes and speech bubbles laid over them. Click / tap / key / gamepad A turns the page.

import { t } from './i18n.js?v=bad6619';

// positions are % of the panel: caption 'top' or 'bottom'; bubble box (x, y, w) and the point its tail aims at (tx, ty)
const PANELS = [
  { cap: 'top' },
  { cap: 'bottom', say: [{ k: 'story.2.say', x: 44, y: 4, w: 38, tx: 33, ty: 14 }] },
  { cap: 'top' },
  { cap: 'bottom', say: [{ k: 'story.4.say1', x: 3, y: 4, w: 34, tx: 30, ty: 30 }, { k: 'story.4.say2', x: 59, y: 4, w: 37, tx: 72, ty: 32 }] },
  { cap: 'bottom', say: [{ k: 'story.5.say1', x: 46, y: 3, w: 32, tx: 37, ty: 20 }, { k: 'story.5.say2', x: 60, y: 30, w: 36, tx: 72, ty: 52 }] },
  { cap: 'top' },
];

let el = null;
let idx = 0;
let done = null;
let padHeld = true;

function build() {
  el = document.createElement('section');
  el.id = 'story';
  el.className = 'story';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', t('story.aria'));
  el.innerHTML = `
    <div class="story-page">
      <figure class="story-panel" id="storyPanel">
        <img id="storyImg" alt="">
        <svg class="story-tails" id="storyTails" viewBox="0 0 150 100" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div id="storyText"></div>
      </figure>
    </div>
    <div class="story-dots" id="storyDots" aria-hidden="true">${PANELS.map(() => '<i></i>').join('')}</div>
    <button type="button" class="story-skip" id="storySkip">${t('story.skip')}</button>
    <button type="button" class="story-next" id="storyNext">${t('story.next')}</button>`;
  document.getElementById('stage').appendChild(el);
  el.addEventListener('click', (e) => {
    if (e.target.closest('#storySkip')) return finish();
    next();
  });
  // preload every panel so page turns are instant
  PANELS.forEach((_, i) => { new Image().src = `assets/story/story_${i + 1}.jpg`; });
}

function render() {
  const p = PANELS[idx];
  const n = idx + 1;
  const img = el.querySelector('#storyImg');
  const panel = el.querySelector('#storyPanel');
  img.src = `assets/story/story_${n}.jpg`;
  panel.classList.remove('in');
  void panel.offsetWidth; // restart the slide-in animation
  panel.classList.add('in');
  panel.style.setProperty('--tilt', `${idx % 2 ? 0.8 : -0.8}deg`);
  const bubbles = (p.say || []).map((b, i) => `<p class="story-say" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;animation-delay:${0.35 + i * 0.5}s">${t(b.k)}</p>`).join('');
  el.querySelector('#storyText').innerHTML = `<p class="story-cap story-cap-${p.cap}">${t(`story.${n}.cap`)}</p>${bubbles}`;
  // tails: a white wedge from the bubble's lower edge to the speaker, outlined in ink (drawn under the bubble)
  el.querySelector('#storyTails').innerHTML = (p.say || []).map((b, i) => {
    const bx = (b.x + b.w / 2) * 1.5;
    const by = b.y + 6;
    const tx = b.tx * 1.5;
    return `<path class="tail" style="animation-delay:${0.35 + i * 0.5}s" d="M ${bx - 3} ${by} L ${tx} ${b.ty} L ${bx + 3} ${by} Z"/>`;
  }).join('');
  el.querySelectorAll('#storyDots i').forEach((d, i) => d.classList.toggle('on', i === idx));
  el.querySelector('#storyNext').textContent = idx === PANELS.length - 1 ? t('story.start') : t('story.next');
}

function next() {
  if (idx >= PANELS.length - 1) return finish();
  idx++;
  render();
}

function finish() {
  if (!el || el.hidden) return;
  el.hidden = true;
  window.removeEventListener('keydown', onKey, true);
  const cb = done;
  done = null;
  if (cb) cb();
}

function onKey(e) {
  if (el.hidden) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.code === 'Escape') finish();
  else next();
}

// gamepad A turns the page, B / Start skips (polled while the story is open)
function pollPad() {
  if (!el || el.hidden) return;
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const a = pads.some((g) => g.buttons[0] && g.buttons[0].pressed);
  const skip = pads.some((g) => (g.buttons[1] && g.buttons[1].pressed) || (g.buttons[9] && g.buttons[9].pressed));
  if (!padHeld && skip) finish();
  else if (!padHeld && a) next();
  padHeld = a || skip;
  requestAnimationFrame(pollPad);
}

export const storyOpen = () => !!el && !el.hidden;

// Show the story from the first panel; onDone runs when it ends or is skipped.
export function playStory(onDone) {
  if (!el) build();
  idx = 0;
  done = onDone;
  padHeld = true; // the press that opened the story must not also turn the first page
  el.hidden = false;
  render();
  window.addEventListener('keydown', onKey, true);
  requestAnimationFrame(pollPad);
  el.querySelector('#storyNext').focus({ preventScroll: true });
}
