// Player options and best results, remembered per browser. Storage may be unavailable
// (private window, blocked site data); the game then just uses the defaults.

const OPT_KEY = 'contracat.options.v1';
const BEST_KEY = 'contracat.best.v1';

export const DEFAULT_OPTIONS = { music: 0.7, sfx: 0.9, shake: true, assist: 'normal', mode: null, char: 0, autoAim: true, autoAimTipSeen: false, unlocked: 1 };
export const ASSIST_MULT = { off: 0, normal: 1, strong: 1.6 };

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* not persisted */ }
}

export const options = { ...DEFAULT_OPTIONS, ...(read(OPT_KEY) || {}) };
export function saveOptions() { write(OPT_KEY, options); }

// best result per stage (stage 1 keeps the original key so old records survive)
const bestKey = (stage = 1) => (stage === 1 ? BEST_KEY : `contracat.best.s${stage}.v1`);
export function loadBest(stage = 1) { return read(bestKey(stage)); }

// Keeps the higher score; returns true when this run is a new best.
export function saveBest(run, stage = 1) {
  const best = loadBest(stage);
  if (best && best.score >= run.score) return false;
  write(bestKey(stage), run);
  return true;
}

// Stage rank from four goals: speed, no deaths, rescue rate, score.
export function rankFor({ time, deaths, freedRate, score }) {
  const pts = (time <= 240 ? 1 : 0) + (deaths === 0 ? 1 : 0) + (freedRate >= 0.7 ? 1 : 0) + (score >= 30000 ? 1 : 0);
  return ['C', 'C', 'B', 'A', 'S'][pts];
}
