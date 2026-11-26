import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { createFixture, users } from './transport-fixture.mjs';

const release = Date.parse('2026-11-26T18:30:00Z');
const steps = [
  {kind:'dialogue', scene:1, text:'Can anybody hear me?', mood:'curious'},
  {kind:'dialogue', scene:1, text:'Is that you?', mood:'confused'},
  {kind:'dialogue', scene:1, text:'Let me get the light.', mood:'curious', fx:'light'},
  {kind:'dialogue', scene:2, text:'I have a secret.', mood:'suspicious'},
  {kind:'celebration', scene:2, text:'IT IS A VERY HAPPY DAY!', mood:'excited', date:'27 · 11 · 2026', subtitle:'Time to celebrate.'},
  {kind:'dialogue', scene:3, text:'I brought a letter.', mood:'happy'},
  {kind:'envelope', scene:4, label:'Open the envelope'},
  {kind:'letter', scene:4, label:'Back to the story'},
  {kind:'dialogue', scene:5, text:'This was my favorite part.', mood:'emotional', fx:'promise'},
  {kind:'dialogue', scene:6, text:'Let us look at the stars.', mood:'emotional', fx:'star'},
  {kind:'dialogue', scene:7, text:'I think it is bedtime.', mood:'asleep', fx:'settle', label:'Goodnight'},
  {kind:'dialogue', scene:8, text:'I FORGOT SOMETHING!', mood:'awake', fx:'wake'},
  {kind:'dialogue', scene:8, text:'Here is my last joke.', mood:'excited', fx:'tumble'},
  {kind:'dialogue', scene:8, text:'Goodnight for real!', mood:'asleep', fx:'wave'},
  {kind:'final', scene:9, mood:'asleep', label:'Return to chat'}
];
const demoStory = {
  title: 'Fixture chapter', date: '27 November 2026', signature: 'A ♡ B', steps,
  letter: Array.from({length:14}, (_, i) => `Dear reader. Paragraph ${i + 1} is a little note for the test. 💗`).join('\n\n'),
  letterHeading: ['A LETTER', 'A little note.', 'Just for you.', 'Dear reader,'],
  promise: 'THE PROMISE.',
  ending: ['From the start,','I knew.','Then and now,','I still know.','Goodnight. ♡','Two months together','A ♡ B','Chapter complete']
};
const story = process.env.CHAPTER_TWO_STORY ? JSON.parse(await readFile(process.env.CHAPTER_TWO_STORY, 'utf8')) : demoStory;

const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const dir = path.resolve('dist');
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(dir, pathname === '/' ? 'index.html' : '.' + pathname);
  if (!file.startsWith(dir + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(file);
    res.writeHead(200, {'content-type':types[path.extname(file)] || 'application/octet-stream'}).end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const engine = process.env.CHAPTER_TWO_ENGINE || 'chromium';
const browser = await (engine === 'webkit' ? webkit.launch() : chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args:['--no-sandbox']
}));
const fixture = createFixture(15);
let current = release, gate = true, failComplete = false, failStart = false, started = false;
const errors = [], events = [], attempts = new Map();
const progress = {};
const resetProgress = () => { attempts.clear(); for (const key of Object.keys(progress)) delete progress[key]; };

async function makeClient(options = {}) {
  const context = await browser.newContext({
    viewport: {width:390,height:844}, reducedMotion:'reduce', hasTouch:true, serviceWorkers:'block', ...options
  });
  await fixture.install(context);
  await context.route('**/rest/v1/**', async route => {
    const req = route.request(), endpoint = new URL(req.url()).pathname.split('/').at(-1);
    if (req.method() !== 'POST') { await route.fallback(); return; }
    const uid = JSON.parse(Buffer.from(req.headers().authorization.split('.')[1], 'base64url')).sub;
    const owner = uid === users[0].id;
    const stamp = new Date(current).toISOString();
    if (endpoint === 'anniversary_2026_status') {
      await route.fulfill({json:{slot:owner ? 1 : 2, available:true, server_now:stamp,
        release_at:'2026-10-26T18:30:00Z', letter:'Chapter I fixture letter.',
        progress:owner ? {} : {completed:true}}});
      return;
    }
    if (endpoint !== 'chapter_two_event') { await route.fallback(); return; }
    const {p_action:action,p_attempt:id} = req.postDataJSON();
    events.push({owner, action, id});
    const available = gate && current >= release;
    let data;
    if (action === 'status') {
      data = owner ? {access:'sender',ready:gate,progress} : {access:'recipient',ready:available,
        release_at:new Date(release).toISOString(), server_now:stamp, completed:!!progress.completed_at};
    } else if (action === 'preview' && owner || action === 'replay' && !owner && progress.completed_at) {
      data = {story};
    } else if (owner || !available || action === 'complete' && failComplete || action === 'start' && failStart) {
      await route.fulfill({status:503,json:{message:'Fixture unavailable'}});
      return;
    } else if (action === 'start') {
      started = true;
      if (!attempts.has(id)) {
        attempts.set(id, 0);
        progress.first_opened_at ??= stamp;
        progress.last_opened_at = stamp;
        progress.attempts = attempts.size;
      }
      data = {story};
    } else {
      assert(attempts.has(id));
      if (action === 'letter') {
        attempts.set(id, 1);
        progress.letter_reached_at ??= stamp;
      } else if (action === 'final') {
        assert.equal(attempts.get(id), 1);
        attempts.set(id, 2);
        progress.final_reached_at ??= stamp;
      } else if (action === 'complete') {
        assert.equal(attempts.get(id), 2);
        progress.completed_at ??= stamp;
      }
      data = {saved:true,completed:!!progress.completed_at,completed_at:progress.completed_at};
    }
    await route.fulfill({json:data});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(9000);
  page.on('pageerror', error => errors.push(error.message));
  return page;
}

const film = p => p.locator('.c2-film[open]');
const line = p => film(p).locator('.c2-spoken');
const next = p => film(p).locator('.c2-controls .c2-primary');
async function login(page, user, location = '/') {
  await page.goto(origin + location);
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill('test-password-only');
  await page.getByRole('button', {name:'Enter our universe',exact:true}).click();
}
async function menu(page) {
  const entry = page.locator('[data-chapter-entry]');
  await entry.waitFor({state:'attached'});
  const phone = page.getByRole('button', {name:'Open navigation',exact:true});
  if (await phone.isVisible() && await phone.getAttribute('aria-expanded') !== 'true') await phone.click();
  await entry.click();
}
async function shown(page, step) {
  await page.locator(`.c2-film[data-kind="${step.kind}"][data-scene="${step.scene}"]`).waitFor();
  if (step.kind === 'dialogue') {
    await page.waitForFunction(text => document.querySelector('.c2-spoken')?.textContent === text, step.text);
  }
}
async function clickNext(page, step, fast = true) {
  const button = step.kind === 'letter' ? film(page).locator('.c2-letter .c2-primary') : next(page);
  if (fast) {
    await page.clock.fastForward(280);
    await button.evaluate(e => e.click());
  } else await button.click();
}
async function walk(page, last, capture = false) {
  for (let i = 0; i <= last; i++) {
    const step = story.steps[i];
    await shown(page, step);
    assert(await film(page).evaluate(e => e.scrollWidth <= e.clientWidth));
    if (step.kind === 'letter') {
      const paragraphs = await page.locator('.c2-paragraph').allTextContents();
      assert.equal(paragraphs.join('\n\n'), story.letter);
      await page.locator('.c2-letter button').scrollIntoViewIfNeeded();
    }
    if (capture && (i === 2 || ['letter','celebration','final'].includes(step.kind))) {
      if (step.kind === 'letter') await film(page).evaluate(e => e.scrollTop = 0);
      await page.screenshot({path:`work/chapter-two-${engine}-${step.kind}.png`, animations:'disabled'});
    }
    if (i < last) await clickNext(page, step);
  }
}

try {
  await mkdir('work', {recursive:true});
  const owner = await makeClient();
  current = release - 900000;
  await login(owner, users[0]);
  await owner.clock.install();
  await menu(owner);
  await owner.getByText('Waiting for her to open it ♡', {exact:true}).waitFor();
  await owner.getByRole('button', {name:'Open private preview ♡'}).click();
  await walk(owner, story.steps.length - 1, !!process.env.CHAPTER_TWO_STORY);
  assert.deepEqual(await owner.locator('.c2-ending .c2-reveal').allTextContents(), story.ending);
  await owner.clock.fastForward(100);
  await clickNext(owner, story.steps.at(-1));
  await film(owner).waitFor({state:'detached'});
  assert.equal(attempts.size, 0);
  assert(events.filter(e => e.owner).every(e => ['status','preview'].includes(e.action)));
  console.log('PASS private pre-release sender preview went through every scene without recording activity');

  const recipient = await makeClient();
  await recipient.clock.install();
  await recipient.clock.setSystemTime(new Date('2099-01-01T00:00:00Z'));
  current = release - 750;
  await login(recipient, users[1], '/?from=shortcut#conversation');
  await recipient.locator('#message-input').waitFor();
  assert.equal(await film(recipient).count(), 0);
  assert.equal(await recipient.locator('[data-chapter-entry]').count(), 0);
  current = release;
  await recipient.clock.fastForward(850);
  await shown(recipient, story.steps[0]);
  assert.equal(attempts.size, 1);
  assert.equal(progress.first_opened_at, new Date(release).toISOString());
  console.log('PASS server midnight boundary on an already-open app with a wrong device clock');

  // Refresh a running attempt at the entrance to every scene and at the final screen.
  const sceneFirst = [...new Set(story.steps.map(step => step.scene))].map(scene => story.steps.findIndex(step => step.scene === scene));
  for (const [iteration, stopAt] of sceneFirst.entries()) {
    await walk(recipient, stopAt);
    assert(!progress.completed_at);
    await recipient.reload();
    await shown(recipient, story.steps[0]);
    assert.equal(attempts.size, iteration + 2);
  }
  console.log('PASS unfinished attempts restart at the opening after refreshing all nine scenes');

  await walk(recipient, story.steps.length - 1);
  assert.equal(progress.completed_at, undefined);
  failComplete = true;
  await clickNext(recipient, story.steps.at(-1));
  await recipient.getByText('Couldn’t save yet.', {exact:false}).waitFor();
  assert.equal(progress.completed_at, undefined);
  assert.equal(await film(recipient).count(), 1);
  failComplete = false;
  await clickNext(recipient, story.steps.at(-1));
  await film(recipient).waitFor({state:'detached'});
  const completion = progress.completed_at;
  const count = attempts.size;
  assert(completion);
  await recipient.reload();
  await recipient.locator('#message-input').waitFor();
  assert.equal(await film(recipient).count(), 0);
  await menu(recipient);
  await recipient.getByText('Chapter I — Our First Month', {exact:true}).click();
  await recipient.locator('.anniversary').waitFor();
  await recipient.getByRole('button', {name:'Back to chat',exact:true}).click();
  await recipient.locator('.anniversary').waitFor({state:'detached'});
  await menu(recipient);
  await recipient.getByText(story.title, {exact:true}).click();
  await shown(recipient, story.steps[0]);
  await recipient.keyboard.press('Escape');
  await film(recipient).waitFor({state:'detached'});
  assert.equal(progress.completed_at, completion);
  assert.equal(attempts.size, count);
  const other = await makeClient({viewport:{width:320,height:568}});
  await login(other, users[1]);
  await other.locator('#message-input').waitFor();
  assert.equal(await film(other).count(), 0);
  assert.equal(await other.getByText("Oreo's Secret Mission ♡", {exact:true}).count(), 0);
  await menu(owner);
  await owner.getByText("She's completed the surprise. 💗", {exact:true}).waitFor();
  console.log('PASS explicit completion, failed request recovery, account persistence, replay and sender status');

  resetProgress();
  started = false;
  current = release + 7 * 86400000;
  const late = await makeClient({reducedMotion:'no-preference', viewport:{width:360,height:740}});
  await late.addInitScript(() => {
    window.sawChatBeforeFilm = false;
    new MutationObserver(() => {
      if (document.querySelector('#message-input') && !document.querySelector('.c2-film[open], [data-chapter-cover]')) {
        window.sawChatBeforeFilm = true;
      }
    }).observe(document, {childList:true,subtree:true});
  });
  failStart = true;
  await login(late, users[1]);
  await late.getByRole('button', {name:'Try again',exact:true}).waitFor();
  assert.equal(await late.evaluate(() => window.sawChatBeforeFilm), false);
  failStart = false;
  await late.getByRole('button', {name:'Try again',exact:true}).click();
  await film(late).waitFor();
  assert(!await film(late).getByRole('button', {name:'Sound'}).isVisible());
  assert(started);
  assert.equal(attempts.size, 1);
  await shown(late, story.steps[0]);
  await next(late).dblclick();
  await shown(late, story.steps[1]);
  assert.equal(await line(late).textContent(), story.steps[1].text);
  assert.equal(await late.evaluate(() => window.sawChatBeforeFilm), false);
  await late.setViewportSize({width:740,height:360});
  await next(late).click();
  await shown(late, story.steps[2]);
  assert(await next(late).isInViewport?.() ?? await next(late).isVisible());
  assert.equal(await film(late).evaluate(e => e.scrollWidth > e.clientWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS later visit, initial blackout, retry, normal-motion typing, double-press guard and landscape');
} finally {
  await browser.close();
  server.close();
}
