import { oreo } from './anniversary-oreo.js';
import { chapterAudio } from './chapter-two-audio.js';

let stylesheet;
export function ready() {
  stylesheet ??= new Promise((resolve, reject) => {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = CHAPTER_TWO_STYLE_URL;
    style.onload = resolve;
    style.onerror = () => {
      style.remove();
      stylesheet = undefined;
      reject(new Error('The chapter could not load.'));
    };
    document.head.append(style);
  });
  return stylesheet;
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

function stageDialog(label, className) {
  const dialog = el('dialog', className);
  dialog.setAttribute('aria-label', label);
  dialog.tabIndex = -1;
  return dialog;
}

function button(text, kind = '') {
  const node = el('button', 'c2-button ' + kind, text);
  node.type = 'button';
  return node;
}

export function chapterMenu({ title, update, entries, close }) {
  const dialog = stageDialog(title, 'c2-menu');
  const heading = el('h2', '', title);
  const status = el('div', 'c2-menu-status');
  const actionError = el('p', 'c2-menu-error');
  status.setAttribute('aria-live', 'polite');
  actionError.setAttribute('role', 'status');
  const actions = el('div', 'c2-menu-actions');
  const dismiss = button('Close', 'c2-subtle');
  dismiss.addEventListener('click', () => dialog.close());
  for (const item of entries) {
    const action = button('', 'c2-menu-entry');
    action.append(el('strong', '', item.title));
    if (item.date) action.append(el('small', '', item.date));
    action.addEventListener('click', async () => {
      if (actions.inert) return;
      actions.inert = true;
      actionError.textContent = '';
      try { await item.open(); }
      catch { actionError.textContent = 'Couldn’t open this chapter. Try again.'; }
      finally {
        actions.inert = false;
        if (dialog.open) action.focus();
      }
    });
    actions.append(action);
  }
  dialog.append(heading, status, actions, actionError, dismiss);
  document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); close(); }, { once: true });
  dialog.showModal();
  if (update) update(status);
  return { close: () => { if (dialog.open) dialog.close(); }, status };
}

export function playChapter({story, mode, milestone, complete, close}) {
  const {steps} = story;
  const dialog = stageDialog(story.title, 'c2-film');
  const theme = document.querySelector('meta[name=theme-color]');
  const previousTheme = theme?.content;
  const underlying = ['app', 'modal-root', 'toast'].map(id => document.getElementById(id)).filter(Boolean);
  const previousInert = underlying.map(node => node.inert);
  const opener = document.activeElement;
  const atmosphere = el('div', 'c2-atmosphere');
  const stars = el('div', 'c2-stars');
  const hearts = el('div', 'c2-hearts');
  const glow = el('div', 'c2-glow');
  const eyeLight = el('div', 'c2-occluded-eyes');
  eyeLight.append(el('i'), el('i'));
  atmosphere.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 43; i++) {
    const star = el('i');
    star.style.cssText = `--x:${(i*43.73+9)%100}%;--y:${(i*37.91+7)%100}%;--a:${.18+(i*11%42)/100};--s:${i%9 ? 1 : 2}px`;
    stars.append(star);
  }
  for (let i = 0; i < 16; i++) {
    const heart = el('i', '', i % 3 ? '✧' : '♡');
    heart.style.cssText = `--i:${i};--x:${5+(i*29)%91}%;--y:${33+(i*17)%61}%;--s:${9+i%5*4}px`;
    hearts.append(heart);
  }
  atmosphere.append(stars, hearts, glow);
  const chrome = el('div', 'c2-chrome');
  const sound = button('Sound on', 'c2-subtle');
  sound.setAttribute('aria-label', 'Sound');
  chrome.append(sound);
  if (mode !== 'automatic') {
    const exit = button('Close', 'c2-subtle');
    exit.addEventListener('click', () => depart());
    chrome.append(exit);
  }
  const stage = el('main', 'c2-stage');
  const portrait = el('div', 'c2-portrait');
  portrait.innerHTML = oreo();
  const zzz = el('div', 'c2-zzz');
  zzz.setAttribute('aria-hidden', 'true');
  for (const letter of ['z', 'Z', 'Z']) zzz.append(el('i', '', letter));
  portrait.append(zzz, eyeLight);
  const page = el('section', 'c2-page');
  const transcript = el('p', 'c2-sr');
  transcript.setAttribute('aria-live', 'polite');
  const controls = el('footer', 'c2-controls');
  const typeTarget = el('button', 'c2-line');
  typeTarget.type = 'button';
  typeTarget.setAttribute('aria-label', 'Reveal the current dialogue instantly');
  const line = el('span', 'c2-spoken');
  line.setAttribute('aria-hidden', 'true');
  typeTarget.append(line);
  const next = button('Continue', 'c2-primary');
  const track = el('div', 'c2-progress');
  track.append(el('i'));
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Story progress');
  const issue = el('p', 'c2-issue');
  issue.setAttribute('role', 'status');
  controls.append(typeTarget, next, track, issue);
  stage.append(portrait, page, controls);
  dialog.append(atmosphere, chrome, stage, transcript);

  const audio = chapterAudio((enabled, playing) => {
    sound.setAttribute('aria-pressed', String(!!playing));
    sound.textContent = enabled ? (playing ? 'Sound on' : 'Play sound') : 'Sound off';
  });
  sound.addEventListener('click', () => {
    if (sound.textContent === 'Play sound') audio.unlock();
    else audio.toggle();
  });

  let index = 0, timer, task, deadline = 0, remaining = 0;
  let typing, isDone = false, leaving = false, blocked = false, attemptEnd = false;
  let lastPress = -Infinity;
  const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

  function cancelTimer() {
    clearTimeout(timer);
    task = null;
  }

  function resumeTimer() {
    if (!task || document.hidden) return;
    deadline = performance.now() + remaining;
    timer = setTimeout(() => {
      const run = task;
      task = null;
      run?.();
    }, remaining);
  }

  function wait(run, duration) {
    cancelTimer();
    task = run;
    remaining = reduced() ? Math.min(duration, 55) : duration;
    resumeTimer();
  }

  function visibility() {
    dialog.classList.toggle('c2-paused', document.hidden);
    if (document.hidden) {
      clearTimeout(timer);
      if (task) remaining = Math.max(0, deadline - performance.now());
    } else {
      clearTimeout(timer);
      resumeTimer();
    }
    audio.visibility();
  }
  function keyboardFocus(node) {
    node.focus({preventScroll: true});
  }

  function startTyping(step) {
    const chars = seg ? Array.from(seg.segment(step.text), part => part.segment) : Array.from(step.text);
    let position = 0;
    typing = true;
    if (!reduced()) line.animate([{opacity:.2},{opacity:1}], {duration:170, easing:'ease-out'});
    typeTarget.disabled = false;
    function finish() {
      cancelTimer();
      typing = false;
      line.textContent = step.text;
      transcript.textContent = step.text;
      next.disabled = false;
      dialog.classList.add('c2-can-continue');
      if (document.activeElement === typeTarget) keyboardFocus(next);
      typeTarget.disabled = true;
    }
    function tick() {
      if (reduced() || position >= chars.length) { finish(); return; }
      line.textContent = chars.slice(0, ++position).join('');
      wait(tick, 22 + (/[.!?]/.test(chars[position - 1]) ? 44 : 0));
    }
    typeTarget.onclick = () => { if (typing) { audio.unlock(); finish(); } };
    tick();
  }

  function showLetter(step) {
    const note = el('article', 'c2-letter');
    const [overline, heading, subhead, salutation] = story.letterHeading;
    const h = el('h1', '', heading);
    h.append(el('em', '', subhead));
    note.append(el('p', 'c2-letter-overline', overline), h,
      el('p', 'c2-letter-date', story.date), el('h2', '', salutation));
    for (const paragraph of story.letter.split('\n\n')) note.append(el('p', 'c2-paragraph', paragraph));
    const turn = button(step.label, 'c2-primary');
    turn.addEventListener('click', advance);
    note.append(el('div', 'c2-signature', story.signature), turn);
    page.append(note);
    h.tabIndex = -1;
    keyboardFocus(h);
    milestone('letter');
  }

  function showFinal() {
    const finish = el('article', 'c2-ending');
    const title = el('h1');
    story.ending.slice(0, 4).forEach((text, i) => {
      const node = el(i === 3 ? 'em' : 'span', 'c2-reveal', text);
      node.style.setProperty('--beat', i);
      title.append(node);
    });
    title.tabIndex = -1;
    finish.append(title);
    story.ending.slice(4).forEach((text, i) => {
      const node = el('p', 'c2-reveal', text);
      node.style.setProperty('--beat', i + 5);
      finish.append(node);
    });
    page.append(finish);
    keyboardFocus(title);
    milestone('final');
    wait(() => {
      next.disabled = false;
      dialog.classList.add('c2-can-continue');
    }, 4250);
  }

  function render(focusNext = false) {
    cancelTimer();
    const step = steps[index];
    const {kind, scene, mood, label, fx} = step;
    const dark = index < 2;
    dialog.dataset.kind = kind;
    dialog.dataset.scene = scene;
    dialog.dataset.fx = fx || '';
    dialog.dataset.mood = mood || '';
    dialog.classList.toggle('c2-dark', dark);
    dialog.classList.remove('c2-can-continue', 'c2-hush', 'c2-unsealing');
    portrait.hidden = kind === 'letter';
    chrome.hidden = false;
    controls.hidden = kind === 'letter';
    typeTarget.hidden = kind !== 'dialogue';
    page.hidden = kind === 'dialogue' && fx !== 'promise';
    next.textContent = label || 'Continue';
    next.disabled = true;
    issue.textContent = '';
    page.replaceChildren();
    dialog.scrollTop = 0;
    track.firstElementChild.style.transform = `scaleX(${(index + 1) / steps.length})`;
    track.setAttribute('aria-valuenow', Math.round((index + 1) / steps.length * 100));
    audio.cue(scene, dark ? 'dark' : fx);
    if (focusNext && kind === 'dialogue') keyboardFocus(typeTarget);

    if (kind === 'dialogue') {
      if (fx === 'promise') page.append(el('p', 'c2-promise', story.promise));
      if (fx === 'light') dialog.classList.add('c2-lit');
      startTyping(step);
      return;
    }
    if (kind === 'letter') { showLetter(step); return; }
    if (kind === 'final') { showFinal(); return; }

    if (kind === 'celebration') {
      const title = el('h1', '', step.text);
      const note = el('div', 'c2-celebration');
      note.append(el('p', 'c2-date', step.date), title, el('p', 'c2-subtitle', step.subtitle));
      page.append(note);
      title.tabIndex = -1;
      keyboardFocus(title);
    } else if (kind === 'envelope') {
      const envelope = el('div', 'c2-envelope');
      envelope.setAttribute('aria-hidden', 'true');
      envelope.append(el('div', 'c2-envelope-paper'), el('div', 'c2-envelope-fold'),
        el('div', 'c2-envelope-flap'), el('div', 'c2-seal', story.signature));
      page.append(envelope);
    }
    next.disabled = false;
    dialog.classList.add('c2-can-continue');
    if (kind === 'envelope') keyboardFocus(next);
  }

  async function advance(event) {
    if (leaving || blocked || typing || event?.detail > 1 || performance.now() - lastPress < 240) return;
    lastPress = performance.now();
    audio.unlock();
    const step = steps[index];
    if (step.kind === 'final') {
      if (next.disabled || attemptEnd) return;
      attemptEnd = true;
      next.disabled = true;
      issue.textContent = mode === 'automatic' ? 'Saving…' : '';
      try {
        await complete();
        isDone = true;
        depart();
      } catch {
        if (!leaving) {
          issue.textContent = 'Couldn’t save yet. Check your connection and try again.';
          next.disabled = false;
          next.focus({preventScroll: true});
        }
      } finally { attemptEnd = false; }
      return;
    }
    const focusNext = event?.detail === 0;
    const go = () => { blocked = false; index++; render(focusNext); };
    if (step.kind === 'envelope' || step.fx === 'settle' || step.fx === 'wave') {
      blocked = true;
      next.disabled = true;
      if (step.kind === 'envelope') { dialog.classList.add('c2-unsealing'); audio.cue(4, 'wax'); }
      if (step.fx === 'settle') { dialog.classList.add('c2-hush'); audio.cue(7, 'hush'); }
      wait(go, step.kind === 'envelope' ? 940 : step.fx === 'settle' ? 870 : 1050);
    } else go();
  }

  function shutdown(report = false) {
    cancelTimer();
    leaving = true;
    document.removeEventListener('visibilitychange', visibility);
    if (theme) theme.content = previousTheme;
    underlying.forEach((node, i) => { node.inert = previousInert[i]; });
    audio.dispose();
    dialog.remove();
    if (report) {
      if (opener?.isConnected && !opener.closest('[inert]') && opener.getClientRects().length) opener.focus({preventScroll: true});
      else document.querySelector('[data-action=mobile-menu]')?.focus({preventScroll: true});
      close(isDone);
    }
  }

  async function depart() {
    if (leaving) return;
    leaving = true;
    cancelTimer();
    dialog.classList.add('c2-depart');
    audio.fade();
    if (!reduced()) await new Promise(resolve => setTimeout(resolve, 550));
    // A sign-out may have disposed the dialog during the fade.
    if (dialog.isConnected) shutdown(true);
  }

  next.addEventListener('click', advance);
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!attemptEnd) depart(); });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    portrait.addEventListener('pointermove', event => {
      if (reduced()) return;
      const bounds = portrait.getBoundingClientRect();
      portrait.style.setProperty('--look-x', `${(event.clientX - bounds.left - bounds.width / 2) / bounds.width * 5}px`);
      portrait.style.setProperty('--look-y', `${(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 3}px`);
    });
    portrait.addEventListener('pointerleave', () => {
      portrait.style.removeProperty('--look-x');
      portrait.style.removeProperty('--look-y');
    });
  }
  document.body.append(dialog);
  dialog.classList.add('c2-blackout');
  chrome.hidden = controls.hidden = page.hidden = true;
  document.addEventListener('visibilitychange', visibility);
  dialog.showModal();
  dialog.focus();
  underlying.forEach(node => { node.inert = true; });
  if (theme) theme.content = '#000000';
  wait(() => {
    dialog.classList.add('c2-glimmer');
    wait(() => {
      dialog.classList.add('c2-eyes');
      wait(() => { dialog.classList.remove('c2-blackout'); render(); }, 1000);
    }, 1000);
  }, 1500);
  return { dispose: () => { if (dialog.isConnected) shutdown(); } };
}
