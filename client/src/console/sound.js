// Short UI tones (Web Audio), only played when the console is unmuted.
let ctx = null;

const TONES = {
  block: [[520, 0], [330, 0.09]],
  approval: [[660, 0], [880, 0.1]],
  soft: [[600, 0]],
};

export function beep(kind = 'soft') {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    for (const [freq, at] of TONES[kind] || TONES.soft) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = ctx.currentTime + at;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    }
  } catch { /* audio unavailable */ }
}
