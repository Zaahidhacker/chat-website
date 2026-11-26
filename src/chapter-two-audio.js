// Original, four-bar score. One Web Audio graph shapes the same motif across scenes.
const bars = [
  [45, [69, 72, 76, 71, 72, 76]],
  [41, [67, 69, 72, 76, 72, 69]],
  [48, [64, 67, 74, 72, 67, 76]],
  [43, [67, 71, 74, 69, 71, 67]]
];
const levels = [0, .22, .32, .23, .12, .14, .18, .07, .17, .20];

export function chapterAudio(onChange) {
  let audio, bus, scheduler, index = 0, next = 0, level = 0, enabled = true, disposed = false;
  try { enabled = localStorage.getItem('chapter-two-muted') !== 'true'; } catch {}
  const playing = () => enabled && audio?.state === 'running';
  const report = () => onChange(enabled, playing());
  function mix() {
    if (!audio || disposed) return;
    bus.gain.setTargetAtTime(enabled ? level : 0, audio.currentTime, .28);
  }
  function note(midi, at, length, volume, type = 'sine') {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + .065);
    gain.gain.exponentialRampToValueAtTime(.0001, at + length);
    osc.connect(gain).connect(bus);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(at);
    osc.stop(at + length + .01);
  }
  function tick() {
    if (!playing() || document.hidden || disposed) return;
    const now = audio.currentTime;
    if (next < now) next = now + .09;
    while (next < now + .19) {
      const [bass, melody] = bars[Math.floor(index / 6) % bars.length];
      const beat = index % 6;
      if (beat === 0) {
        note(bass, next, 2.9, .12);
        note(bass + 7, next, 2.3, .055);
      }
      note(melody[beat], next, 1.8, beat % 3 === 0 ? .14 : .09, 'triangle');
      note(melody[beat] + 12, next + .29, 1.1, .021);
      index++;
      next += beat % 2 === 0 ? .59 : .48;
    }
  }
  async function unlock() {
    if (!enabled || disposed || document.hidden) return;
    try {
      if (!audio) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        audio = new Context();
        bus = audio.createGain();
        bus.gain.value = 0;
        bus.connect(audio.destination);
      }
      await audio.resume();
      if (disposed) return;
      if (document.hidden || !enabled) { pause(); return; }
      scheduler ??= setInterval(tick, 110);
      mix();
      tick();
    } catch {}
    if (!disposed) report();
  }
  function pause() {
    clearInterval(scheduler);
    scheduler = undefined;
    if (audio?.state === 'running') audio.suspend().catch(() => {});
  }
  report();
  return {
    unlock,
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('chapter-two-muted', String(!enabled)); } catch {}
      if (enabled) unlock();
      else { mix(); report(); }
    },
    cue(scene, fx) {
      level = fx === 'promise' ? .055 : fx === 'settle' ? .025 : fx === 'hush' ? 0 : levels[scene];
      if (scene === 1 && !['light', 'recognise', 'jump'].includes(fx) && !level) level = .10;
      if (fx === 'dark') level = 0;
      mix();
      if (!playing() || disposed) return;
      const at = audio.currentTime + .04;
      if (fx === 'wake' || fx === 'wax' || fx === 'light') {
        note(fx === 'wake' ? 81 : 74, at, .36, .17, 'triangle');
        note(fx === 'wake' ? 88 : 81, at + .095, .49, .08);
      }
    },
    fade() { level = 0; mix(); },
    visibility() { if (document.hidden) pause(); else if (audio) unlock(); },
    dispose() { disposed = true; clearInterval(scheduler); audio?.close().catch(() => {}); }
  };
}
