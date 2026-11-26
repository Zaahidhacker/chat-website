const WAIT_LIMIT = 2_147_000_000;
const localDate = new Intl.DateTimeFormat('en-LK', {
  timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'medium'
});
let sessionGate;

export function stopChapterTwo() {
  sessionGate?.dispose();
  sessionGate = undefined;
}

export function startChapterTwo(db, S, onReturn, openChapterOne, closeNavigation) {
  stopChapterTwo();
  if (S.demo || ![1, 2].includes(S.me?.slot)) return Promise.resolve();
  const uid = S.user.id;
  const app = document.querySelector('#app');
  let alive = true, timer, polling, status, checking, modulePromise;
  let cover, coverInert, film, menu, entry, attempt, opened = false, launching = false, returning = false;
  const current = () => alive && S.user?.id === uid;

  function rpc(action, id = null) {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), action === 'status' ? 6500 : 12000);
    return db.rpc('chapter_two_event', {p_action: action, p_attempt: id}).abortSignal(controller.signal)
      .then(({data, error, status: code}) => {
        if (action === 'status' && (code === 404 || error?.code === 'PGRST202')) return {access: 'none'};
        if (error || !data) throw error || new Error('The chapter is unavailable.');
        return data;
      }).finally(() => clearTimeout(deadline));
  }

  function loadFilm() {
    modulePromise ??= import('./chapter-two.js').then(async module => {
      await module.ready();
      return module;
    }).catch(error => {
      modulePromise = undefined;
      throw error;
    });
    return modulePromise;
  }

  function black() {
    if (cover) { cover.replaceChildren(); return; }
    cover = document.createElement('div');
    cover.dataset.chapterCover = '';
    cover.style.cssText = 'position:fixed;inset:0;z-index:1100;background:#000;color:#fff1f7;display:grid;place-content:center;text-align:center;padding:24px';
    coverInert = app.inert;
    app.inert = true;
    document.body.append(cover);
  }

  function clearCover() {
    if (!cover) return;
    cover.remove();
    cover = null;
    app.inert = coverInert;
  }

  function failedOpening(retry) {
    if (!cover || !current()) return;
    const message = document.createElement('p');
    message.textContent = 'A little moment couldn’t load.';
    message.setAttribute('role', 'status');
    const tryAgain = document.createElement('button');
    tryAgain.type = 'button';
    tryAgain.className = 'secondary';
    tryAgain.textContent = 'Try again';
    tryAgain.addEventListener('click', retry, {once: true});
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'text-btn';
    exit.textContent = 'Return to chat';
    exit.addEventListener('click', () => { opened = true; clearCover(); }, {once: true});
    cover.replaceChildren(message, tryAgain, exit);
    tryAgain.focus();
  }

  function statusDisplay(target) {
    const progress = status?.progress || {};
    const stamps = [
      ['First opened', progress.first_opened_at],
      ['Last opened', progress.attempts > 1 && progress.last_opened_at],
      ['Reached the letter', progress.letter_reached_at],
      ['Reached the last scene', progress.final_reached_at],
      ['Completed', progress.completed_at]
    ];
    const message = document.createElement('p');
    message.textContent = progress.completed_at ? "She's completed the surprise. 💗"
      : progress.final_reached_at ? "She's almost finished!"
      : progress.letter_reached_at ? "She's reached the letter."
      : progress.first_opened_at ? 'She opened the surprise!' : 'Waiting for her to open it ♡';
    const list = document.createElement('dl');
    function row(label, text) {
      const key = document.createElement('dt'), value = document.createElement('dd');
      key.textContent = label;
      value.textContent = text;
      list.append(key, value);
    }
    for (const [label, timestamp] of stamps) if (timestamp) row(label, localDate.format(new Date(timestamp)));
    if (progress.attempts) row('Attempts', String(progress.attempts));
    // Keep the live region quiet when a poll returned identical results.
    if (target.dataset.progress === JSON.stringify(progress)) return;
    target.dataset.progress = JSON.stringify(progress);
    target.replaceChildren(message, list);
  }

  function addEntry() {
    const owner = status?.access === 'sender';
    if (!current() || !(owner || status?.completed)) return;
    const sidebar = app.querySelector('.sidebar');
    if (!sidebar || entry?.isConnected) return;
    entry = document.createElement('button');
    entry.type = 'button';
    entry.className = 'nav';
    entry.dataset.chapterEntry = '';
    entry.textContent = owner ? "Oreo's Secret Mission ♡" : 'Our little memories ♡';
    entry.addEventListener('click', openMenu);
    sidebar.insertBefore(entry, sidebar.querySelector('.side-card'));
  }

  async function openMenu() {
    if (menu || film || launching) return;
    launching = true;
    entry?.setAttribute('aria-busy', 'true');
    try {
      const ui = await loadFilm();
      if (!current()) return;
      const owner = status.access === 'sender';
      const memory = owner ? null : await rpc('replay');
      if (!current()) return;
      if (!owner && !memory?.story) throw new Error('This chapter is unavailable.');
      closeNavigation(true);
      menu = ui.chapterMenu({
        title: owner ? "Oreo's Secret Mission ♡" : 'Our little memories ♡',
        update: owner ? statusDisplay : null,
        entries: owner
          ? (status.ready ? [{title: 'Open private preview ♡', open: () => preview(ui)}] : [])
          : [
            {title: 'Chapter I — Our First Month', date: '27 October 2026', open: async () => {
              if (!await openChapterOne(() => menu?.close())) throw new Error('Chapter I is unavailable.');
            }},
            {title: memory.story.title, date: memory.story.date, open: () => {
              menu.close();
              mount(ui, memory.story, 'replay', null);
            }}
          ],
        close() { clearInterval(polling); menu = null; }
      });
      if (owner) {
        check();
        polling = setInterval(() => { if (!document.hidden) check(); }, 20000);
      }
    } catch {
      if (entry?.isConnected) entry.textContent = 'Try opening again ♡';
    } finally {
      launching = false;
      entry?.removeAttribute('aria-busy');
    }
  }

  async function preview(ui) {
    const result = await rpc('preview');
    if (!current() || !menu) return;
    if (!result.story) throw new Error('This chapter is unavailable.');
    menu.close();
    mount(ui, result.story, 'preview', null);
  }

  function mount(ui, story, mode, id) {
    let reached = 0, saved = 0, syncing;
    const sync = async () => {
      if (mode !== 'automatic') return;
      if (syncing) return syncing;
      syncing = (async () => {
        while (current() && film && saved < reached) {
          const result = await rpc(saved === 0 ? 'letter' : 'final', id);
          if (!result.saved && !result.completed) throw new Error('Progress was not confirmed.');
          saved++;
        }
      })();
      try { await syncing; }
      finally { syncing = null; }
    };
    const retryProgress = () => sync().catch(() => {});
    if (mode === 'automatic') window.addEventListener('online', retryProgress);
    clearCover();
    S.chapterTwoActive = true;
    document.dispatchEvent(new Event('chapter-two-open'));
    const player = ui.playChapter({
      story, mode,
      milestone(stage) { reached = stage === 'letter' ? 1 : 2; retryProgress(); },
      async complete() {
        if (mode !== 'automatic') return;
        await sync();
        if (!current() || !film || saved !== 2) throw new Error('Progress was not confirmed.');
        const result = await rpc('complete', id);
        if (!result.completed || !result.completed_at) throw new Error('Completion was not confirmed.');
        status = {...status, completed: true};
      },
      close(done) {
        window.removeEventListener('online', retryProgress);
        film = null;
        S.chapterTwoActive = false;
        if (done && mode === 'automatic') addEntry();
        onReturn?.();
      }
    });
    film = {
      dispose() {
        window.removeEventListener('online', retryProgress);
        player.dispose();
        S.chapterTwoActive = false;
      }
    };
  }

  async function openAutomatic() {
    if (!current() || launching || opened || film || document.hidden) return;
    launching = true;
    black();
    try {
      const ui = await loadFilm();
      if (!current() || document.hidden) return;
      attempt ??= crypto.randomUUID();
      const result = await rpc('start', attempt);
      if (!current()) return;
      if (result.completed) {
        status = {...status, completed: true};
        addEntry();
        return;
      }
      if (!result.story) throw new Error('This chapter is unavailable.');
      opened = true;
      mount(ui, result.story, 'automatic', attempt);
    } catch {
      if (current()) {
        failedOpening(openAutomatic);
        return;
      }
    } finally {
      launching = false;
      if (!cover?.childElementCount) clearCover();
    }
  }

  function check() {
    if (!current() || checking || film || document.hidden) return checking;
    clearTimeout(timer);
    checking = (async () => {
      try {
        const result = await rpc('status');
        if (!current()) return;
        status = result;
        if (cover?.childElementCount) black();
        addEntry();
        if (status.access === 'sender' && menu) statusDisplay(menu.status);
        if (status.access !== 'recipient' || status.completed || opened) return;
        if (status.ready) { await openAutomatic(); return; }
        const until = Date.parse(status.release_at) - Date.parse(status.server_now);
        timer = setTimeout(check, until > 0 ? Math.min(WAIT_LIMIT, Math.max(30, until)) : 30000);
      } catch {
        if (current()) {
          failedOpening(check);
          timer = setTimeout(check, 15000);
        }
      } finally {
        if (cover && !cover.childElementCount) clearCover();
        checking = null;
      }
    })();
    return checking;
  }

  function wake() {
    if (document.hidden) return;
    if (returning) { returning = false; black(); }
    if (menu || (!film && !opened && !status?.completed && status?.access !== 'sender')) check();
  }

  function pageHide(event) {
    if (!event.persisted || !opened || status?.access !== 'recipient' || status?.completed) return;
    film?.dispose();
    film = null;
    opened = false;
    attempt = null;
    returning = true;
  }

  const observer = new MutationObserver(addEntry);
  observer.observe(app, {childList: true});
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  window.addEventListener('pageshow', wake);
  window.addEventListener('pagehide', pageHide);
  window.addEventListener('focus', wake);
  sessionGate = {
    dispose() {
      alive = false;
      clearTimeout(timer);
      clearInterval(polling);
      observer.disconnect();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('focus', wake);
      menu?.close();
      film?.dispose();
      clearCover();
      entry?.remove();
    }
  };
  if (S.me.slot === 2 && !document.hidden) {
    black();
    return check();
  }
  check();
  return Promise.resolve();
}
