// Phone controls: left stick moves, right stick aims and auto-fires, plus jump / dash / skill buttons.

const state = { lx: 0, ly: 0, rx: 0, ry: 0, rm: 0, rActive: false, jump: false, dash: false, skill: false };
export const getTouchState = () => state;

export function setupTouch(root) {
  root.innerHTML = `
    <div class="stick stick-l" id="stickL" aria-label="移動"><div class="knob"></div><span>移動</span></div>
    <div class="stick stick-r" id="stickR" aria-label="瞄準射擊"><div class="knob"></div><span>瞄準射擊</span></div>
    <div class="tbtns">
      <button type="button" class="tbtn" data-k="skill">技</button>
      <button type="button" class="tbtn" data-k="dash">衝</button>
      <button type="button" class="tbtn tbtn-big" data-k="jump">跳</button>
    </div>`;
  stick(root.querySelector('#stickL'), (x, y) => { state.lx = x; state.ly = y; });
  stick(root.querySelector('#stickR'), (x, y, active) => {
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

function stick(el, onMove) {
  const knob = el.querySelector('.knob');
  let id = null;
  const move = (e) => {
    const r = el.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    knob.style.transform = `translate(${dx * r.width * 0.3}px, ${dy * r.height * 0.3}px)`;
    onMove(dx, dy, true);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    id = e.pointerId;
    el.setPointerCapture(id);
    move(e);
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    onMove(0, 0, false);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
