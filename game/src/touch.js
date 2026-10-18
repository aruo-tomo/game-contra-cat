// Phone controls. The left part of the screen moves, the right part aims and auto-fires:
// a stick appears wherever the thumb lands, so there is no fixed spot to hit.
// Jump / dash / skill are fixed buttons at the bottom centre.
import { t } from './i18n.js';

const state = { lx: 0, ly: 0, rx: 0, ry: 0, rm: 0, rActive: false, jump: false, dash: false, skill: false };
export const getTouchState = () => state;

export function setupTouch(root) {
  root.innerHTML = `
    <div class="tzone tzone-l" id="zoneL" aria-label="${t('touch.moveZone')}">
      <div class="stick" id="stickL"><div class="knob"></div><span>${t('touch.move')}</span></div>
    </div>
    <div class="tzone tzone-r" id="zoneR" aria-label="${t('touch.aimZone')}">
      <div class="stick stick-aim" id="stickR"><div class="knob"></div><span>${t('touch.aim')}</span></div>
    </div>
    <div class="tbtns">
      <button type="button" class="tbtn" data-k="skill">${t('touch.skill')}</button>
      <button type="button" class="tbtn" data-k="dash">${t('touch.dash')}</button>
      <button type="button" class="tbtn tbtn-big" data-k="jump">${t('touch.jump')}</button>
    </div>`;
  floatingStick(root.querySelector('#zoneL'), root.querySelector('#stickL'), (x, y) => { state.lx = x; state.ly = y; });
  floatingStick(root.querySelector('#zoneR'), root.querySelector('#stickR'), (x, y, active) => {
    state.rx = x; state.ry = y; state.rm = Math.hypot(x, y); state.rActive = active;
  });
  for (const b of root.querySelectorAll('.tbtn')) {
    const k = b.dataset.k;
    const on = (e) => { e.preventDefault(); state[k] = true; b.classList.add('on'); };
    const off = () => { state[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  }
}

function floatingStick(zone, stick, onMove) {
  const knob = stick.querySelector('.knob');
  let id = null;
  let cx = 0;
  let cy = 0;
  const radius = () => stick.offsetWidth / 2;
  const place = (e) => {
    const z = zone.getBoundingClientRect();
    cx = e.clientX;
    cy = e.clientY;
    stick.style.left = `${cx - z.left - radius()}px`;
    stick.style.top = `${cy - z.top - radius()}px`;
  };
  const move = (e) => {
    const r = radius();
    let dx = (e.clientX - cx) / r;
    let dy = (e.clientY - cy) / r;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    knob.style.transform = `translate(${dx * r * 0.6}px, ${dy * r * 0.6}px)`;
    onMove(dx, dy, true);
  };
  zone.addEventListener('pointerdown', (e) => {
    if (id !== null) return;
    e.preventDefault();
    id = e.pointerId;
    zone.setPointerCapture(id);
    place(e);
    stick.classList.add('live');
    move(e);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    stick.classList.remove('live');
    stick.style.left = '';
    stick.style.top = '';
    onMove(0, 0, false);
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}
