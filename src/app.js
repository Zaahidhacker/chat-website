import { visibleMessages, receiptLabel, mergeMessages, boundMessages, isConfirmed } from "./logic.js";
import { createReceiptScheduler, debounce } from "./scheduling.js";
import { explainError, isConnectionError, resilientFetch } from './connection.js';
import { linkify } from './links.js';
import { attachSwipeReply } from './swipe.js';
const URL = "https://jczsnrzqocstbpsgwkdy.supabase.co";
const KEY = "sb_publishable_bC-d7dzejgvGCetYD-JjOg_WKEZKJco";
let db,clientReady,chatView;
function ensureClient(){
 if(!clientReady)clientReady=Promise.all([import('@supabase/supabase-js'),import('./conversation-view.js')]).then(([{createClient},views])=>{chatView=views;
  db=createClient(URL,KEY,{global:{fetch:resilientFetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:5}}});
  db.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'&&!S.demo){clearPrivateState();login();setNotificationAccount(null)}
   if(event==='TOKEN_REFRESHED'&&session){db.realtime.setAuth(session.access_token)}
  });
  return db;
 }).catch(error=>{clientReady=null;throw error});
 return clientReady;
}

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const paths = { photo:"M4 4h16v16H4V4Zm0 12 5-5 4 4 3-3 4 4M15 8h.01", heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z", chat: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 1.8-6A8.5 8.5 0 1 1 21 11.5Z", bookmark: "M6 3h12v19l-6-4-6 4V3Z", spark: "m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z", settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.5 4 1.5-1-2-3-1.7.5L17 7l-.2-2H7.2L7 7 5.7 8.5 4 8l-2 3 1.5 1L3 14l-1 1 2 3 2-.5L8 19l.2 2h7.6l.2-2 2-1.5 2 .5 2-3-1-1-.5-2Z", lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 5v2", moon: "M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z", sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5", arrow: "M5 12h14m-6-6 6 6-6 6", send: "m22 2-7 20-4-9L2 9l20-7ZM11 13 22 2", smile: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01", more: "M5 12h.01M12 12h.01M19 12h.01", search: "M20 20l-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z", close: "m6 6 12 12M6 18 18 6", logout: "M9 4H4v16h5m5-13 5 5-5 5M8 12h11", reply: "m9 5-7 7 7 7M2 12h12c4 0 6 2 6 7", trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7", check: "m4 12 5 5L20 6", menu: "M4 6h16M4 12h16M4 18h16", eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z", down: "m6 9 6 6 6-6", note: "M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h3" };
const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n] || paths.heart}"/></svg>`;
const ib = (n, title, action2, cl = "") => `<button type="button" class="icon-btn ${cl}" aria-label="${title}" title="${title}" data-action="${action2}">${icon(n)}</button>`;
const logo = () => `<div class="logo">${icon("heart")}</div>`;
let S = { user: null, me: null, partner: null, messages: [], favorites: /* @__PURE__ */ new Set(), reactions: [], cutoff: 0, page: "chat", demo: false, reply: null, edit: null, loading: false, hasMore: true, connected: false };
function savedTheme(){try{return localStorage.getItem("universe-theme")||"dark"}catch{return "dark"}}
let theme = savedTheme(), channel, pulse, presenceClock, typingTimer, lastTyped = 0, toastTimer, inviteMode = false, loadingOlder = false, refreshing = false, refreshQueued = false;
let draft = "";
let sessionEpoch=0,syncCursor=0,receiptScheduler=null,hiddenPause=null,stashTimer=null,renderFrame=null;
let messageLookup=new Map(),reactionLookup=new Map(),autoScrollPending=false;
let replyContext=new Map(), resumeSession=null;
let ritualGame,pageViews,photoAPI,garden,island,locationAPI,photoRecords=new Map();
function pageContext(){return {S,theme,esc,icon,date,time,photoHTML,mergeMessages,linkify}}
async function secondaryPages(){return pageViews??=await import('./pages.js')}
const secondaryPlaceholder=()=>'<section class="content-page"><div class="page-skeleton" role="status">Opening your little corner…</div></section>';
async function photos(){photoAPI=await import('./photos.js');photoAPI.configure(db,S.user?.id);return photoAPI}
async function loadPhotos(messages,epoch=sessionEpoch){
 messages=messages.filter(m=>photoRecords.has(m.id)||m.photoPending||m.body?.startsWith('📷 '));if(!messages.length||S.demo)return;
 const {data,error}=await db.from('universe_photos').select('*').in('id',messages.map(m=>m.id));
 if(epoch!==sessionEpoch||error)return;
 for(const p of data)photoRecords.set(p.id,p);
 if(data.length)await photos();
}
function observePhotos(){if(photoAPI&&S.page==='chat')photoAPI.observe($('#messages'),id=>photoRecords.get(id))}
function photoHTML(m){
 if(m.deleted||(!photoRecords.has(m.id)&&!m.photoPending))return '';
 const p=photoRecords.get(m.id),caption=m.body.startsWith('📷 ')?m.body.slice(3):m.body;
 return `<button class="photo-frame" data-action="photo-view-${esc(m.id)}" aria-label="Open photo" style="aspect-ratio:${p?.width||4}/${p?.height||3}"><img data-photo-id="${esc(m.id)}" alt="Shared photo" decoding="async"><span class="photo-loading">${m.pending?'Sharing a little moment…':'Tap to open photo'}</span></button>${m.pending?`<div class="photo-upload"><progress max="100" value="${m.photoProgress||0}" aria-label="Photo upload progress"></progress><span>${m.photoProgress>=90?'Finishing…':(m.photoProgress||0)+'% uploaded'}</span></div>`:''}${caption&&caption!=='Photo'?`<span class="photo-caption">${linkify(caption)}</span>`:''}`;
}
function setNotificationAccount(userId){navigator.serviceWorker?.ready.then(r=>r.active?.postMessage({type:'ACCOUNT',userId})).catch(()=>{})}
function connectionScreen(error){
 $('#app').innerHTML=`<main class="reconnect"><div class="brand">${logo()}<strong>Our Little Universe</strong></div><h1>A moment to reconnect.</h1><p role="status">${esc(explainError(error))}</p><button class="primary" data-action="retry-session">Try again ${icon('arrow')}</button><button class="text-btn" data-action="logout">Sign out of this device</button></main>`;
}
async function restoreSession(){
 try{await ensureClient();const {data,error}=await db.auth.getSession();if(error)throw error;if(data.session)await enter(data.session);else login()}
 catch(error){if(isConnectionError(error))connectionScreen(error);else{login();$('#login-error').textContent=explainError(error)}}
}
const renderSignatures=new WeakMap();
const clockFormat=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'});
const dayFormat=new Intl.DateTimeFormat(undefined,{month:'long',day:'numeric',year:'numeric'});
const PAGE_SIZE=50,WINDOW_SIZE=matchMedia("(max-width:700px)").matches?100:200;

function setTheme(t) {
  theme = t;
  document.body.classList.toggle("light", t === "light");
  try{localStorage.setItem("universe-theme", t)}catch{}
  document.querySelector('meta[name="theme-color"]').content = t === "light" ? "#f8f5f3" : "#101011";
}
setTheme(theme);
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4e3);
}
let dialogOpener,photoSelection=0;
function modal(html) {
  if(!$("#modal-root").children.length)dialogOpener=document.activeElement;$("#app").inert=true;
  $("#modal-root").innerHTML = `<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="Conversation action">${ib("close", "Close", "close-modal", "modal-close")}${html}</section></div>`;
  const first = $("button,input,textarea", $(".modal"));
  first?.focus();
}
function closeModal() {
  photoSelection++;photoAPI?.cancelPreview();
  $("#modal-root").innerHTML = "";$("#app").inert=false;if(dialogOpener?.isConnected)dialogOpener.focus({preventScroll:true});dialogOpener=null;
}
function time(t){return clockFormat.format(new Date(t))}
function date(t){const d=new Date(t);return d.toDateString()===new Date().toDateString()?'Today':dayFormat.format(d)}
function login() {
  stop();
  S.user = null;
  $("#app").innerHTML = `<main class="login"><section class="login-story"><div class="brand">${logo()}<div><strong>Our Little Universe</strong><small>A LITTLE WORLD. JUST US.</small></div></div><div class="story-copy"><div class="eyebrow">Some things are just ours.</div><h1>One little space.<br>Two whole <em>worlds.</em></h1><p>For the everyday hellos, the late-night thoughts, and all the little things in between.</p><div class="orbit" aria-hidden="true"><div class="planet"></div><i></i></div></div><div class="story-footer">${icon("lock")} Invitation only. Made for two.</div></section><section class="login-form-area">${ib(theme === "dark" ? "sun" : "moon", "Change appearance", "toggle-theme", "corner-theme")}<form class="login-form" id="login-form"><div class="eyebrow">YOUR PERSON IS A MESSAGE AWAY</div><h2>${inviteMode ? "Make yourself at home." : "Back to our little world."}</h2><p>${inviteMode ? "Your invitation opens the door. Choose your password, then verify your email." : "A quiet place for your favorite conversations.<br>Come on in."}</p><label for="email">Your email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required><label for="password">${inviteMode ? "Create your password" : "Your password"}</label><div class="password-wrap"><input id="password" name="password" type="password" autocomplete="${inviteMode ? "new-password" : "current-password"}" minlength="12" placeholder="${inviteMode ? "At least 12 characters" : "Your little secret"}" required>${ib("eye", "Show password", "show-password")}</div>${inviteMode ? '<label for="invite">Your private invitation code</label><input id="invite" name="invite" autocomplete="off" placeholder="Paste your invitation code" required>' : ""}<div id="login-error" class="form-error" role="alert"></div><button type="submit" class="primary">${inviteMode ? "Create my account" : "Enter our universe"} ${icon("arrow")}</button><div class="login-bottom">${icon("lock")} Only the two invited accounts can enter.<br><button type="button" class="text-btn" data-action="invite-mode">${inviteMode ? "Already have a password? Sign in" : "First time here? Set your password"}</button></div><button type="button" class="text-btn sample-link" data-action="demo">Take a peek at a sample universe</button></form></section></main>`;
}
function stash(){
 if(S.demo||!S.user)return;
 clearTimeout(stashTimer);
 // Coalesce synchronous storage work while typing; force flush on pagehide/send.
 stashTimer=setTimeout(flushStash,150);
}
function flushStash(){
 clearTimeout(stashTimer);
 if(S.demo||!S.user)return;
 try{sessionStorage.setItem('universe-draft-'+S.user.id,draft);sessionStorage.setItem('universe-outbox-'+S.user.id,JSON.stringify(S.messages.filter(m=>m.pending||m.failed)))}catch{ /* Messaging remains available when storage is disabled or full. */ }
}
function clearPrivateState(){
 ritualGame?.unmount();locationAPI?.dispose();island?.dispose();garden?.dispose();photoAPI?.dispose(S.user?.id);photoRecords.clear();
 sessionEpoch++;refreshing=false;refreshQueued=false;clearTimeout(stashTimer);stop();
 if(S.user&&!S.demo){try{sessionStorage.removeItem('universe-draft-'+S.user.id);sessionStorage.removeItem('universe-outbox-'+S.user.id)}catch{}}
 draft='';S.messages=[];S.keepsakes=[];S.reactions=[];S.favorites=new Set();S.hidden=new Set();S.reply=S.edit=null;S.user=null;syncCursor=0;
 document.title='Our Little Universe — Just us.';messageLookup.clear();reactionLookup.clear();replyContext.clear();resumeSession=null;closeModal();
}
function restoreOutbox() {
  try {
    draft = sessionStorage.getItem("universe-draft-" + S.user.id) || "";
    const list = JSON.parse(sessionStorage.getItem("universe-outbox-" + S.user.id) || "[]");
    S.messages.push(...list.filter((m) => !S.messages.some((x) => x.id === m.id)).map((m) => ({ ...m, pending: false, failed: true })));
  } catch {
  }
}
function stop(){
 if(channel&&db){db.removeChannel(channel);channel=null}
 clearInterval(pulse);clearInterval(presenceClock);clearTimeout(typingTimer);clearTimeout(hiddenPause);receiptScheduler?.close();receiptScheduler=null;
 if(renderFrame!==null){cancelAnimationFrame(renderFrame);renderFrame=null}
}
async function signIn(e) {
  e.preventDefault();
  let btn = $("button[type=submit]", e.target);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  $("#login-error").textContent = "";
  try {
    await ensureClient();
    const email = $("#email").value.trim(), password = $("#password").value;
    let result;
    if (inviteMode) {
      result = await db.auth.signUp({ email, password, options: { data: { universe_invite: $("#invite").value.trim() }, emailRedirectTo: location.origin } });
      if (result.error) throw result.error;
      if (!result.data.session) {
        inviteMode = false;
        login();
        toast("Check your email to verify your account, then return here to sign in.");
        return;
      }
    } else result = await db.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    await enter(result.data.session);
  } catch (err) {
    $("#login-error").textContent = explainError(err);
    btn.disabled = false;
    btn.innerHTML = `${inviteMode ? "Create my account" : "Enter our universe"} ${icon("arrow")}`;
  }
}
async function sample() {
  chatView??=await import('./conversation-view.js');
  stop();
  S = { ...S, user: { id: "me" }, me: { user_id: "me", name: "Zaahid", slot: 1, share_presence: true }, partner: { user_id: "them", name: "Layaana", share_presence: true, last_seen: (/* @__PURE__ */ new Date()).toISOString(), last_delivered: 100, last_read: 100 }, demo: true, older:false, latestSeq:5, newMessages:false, hidden:new Set(), cutoff: 0, page: "chat", hasMore: false, connected: true, favorites: /* @__PURE__ */ new Set(["d3"]), reactions: [{ message_id: "d4", user_id: "me", emoji: "\u2764\uFE0F" }] };
  const now = Date.now();
  S.messages = [{ id: "d1", sender: "them", body: "Hey you. How\u2019s your little corner of the world today?", seq: 1 }, { id: "d2", sender: "me", body: "A little busy. A little better now that you\u2019re here.", seq: 2 }, { id: "d3", sender: "them", body: "Just a reminder: you\u2019re my favorite part of an ordinary day. \u2661", seq: 3 }, { id: "d4", sender: "me", body: "Can we pause the whole world and stay right here for a minute?", seq: 4 }, { id: "d5", sender: "them", body: "For you? Always. \u2728", seq: 5 }].map((m, i) => ({ ...m, created_at: new Date(now - (6 - i) * 6e4).toISOString() }));
  render();
  scrollBottom();
}
async function enter(session){
 if(!session){login();return}
 resumeSession=session;
 const epoch=++sessionEpoch;refreshing=false;refreshQueued=false;stop();
 S.demo=false;S.user=session.user;S.loading=true;
 S.messages=[];S.keepsakes=[];S.reactions=[];S.older=false;S.newMessages=false;S.latestSeq=0;S.hidden=new Set();S.reply=S.edit=null;
 try{
  const {data:state,error}=await db.rpc('universe_sync_state');
  if(epoch!==sessionEpoch)return;
  if(error)throw error;
  if(!state?.preferences)throw Error('This account has not joined yet. Use your private invitation to set up your account.');
  applyMetadata(state);S.unreadBoundary=S.me?.last_read||0;syncCursor=state.revision||0;setTheme(state.preferences.theme);S.page='chat';
  await loadMessages();if(epoch!==sessionEpoch)return;
  restoreOutbox();
  let pendingPhotos=false;try{pendingPhotos=!!localStorage.getItem('universe-photo-pending-'+S.user.id)}catch{}
  if(pendingPhotos||S.messages.some(m=>m.photoPending)){
   const api=await photos(),rows=await api.loadDrafts(S.user.id);if(epoch!==sessionEpoch)return;
   for(const row of rows){if(!S.messages.some(m=>m.id===row.message.id))S.messages.push({...row.message,pending:false,failed:true,transmitting:false});photoRecords.set(row.message.id,{id:row.message.id,width:row.photo.width,height:row.photo.height});api.localThumb(row.message.id,row.photo.thumb)}
  }
  S.loading=false;S.dataOnline=true;render();scrollBottom();startRealtime();setNotificationAccount(S.user.id);try{if(localStorage.getItem('universe-location-stop-'+S.user.id))import('./location.js').then(async module=>{if(epoch===sessionEpoch){locationAPI=module;await module.configure(db,{user:S.user,me:S.me,partner:S.partner,demo:false});module.controls($('#location-controls'))}}).catch(()=>{})}catch{}
 }catch(error){
  if(epoch!==sessionEpoch)return;
  S.loading=false;
  if(isConnectionError(error)){connectionScreen(error);return}
  S.user=null;login();$('#login-error').textContent=explainError(error);
 }
}
function applyMetadata(state){
 const oldName=S.partner?.name;
 S.me=state.members.find(m=>m.user_id===S.user.id);
 S.partner=state.members.find(m=>m.user_id!==S.user.id);
 S.cutoff=state.preferences.cleared_through;
 S.favorites=new Set(state.favorites||[]);S.hidden=new Set(state.hidden||[]);
 S.messages=S.messages.filter(m=>!S.hidden.has(m.id)&&(m.seq>S.cutoff||S.favorites.has(m.id)||!isConfirmed(m)));
 if(oldName!==S.partner?.name&&S.page==='chat'&&$('#partner-name'))$('#partner-name').textContent=S.partner?.name||'Your person';
}
async function loadMessages(before){
 const epoch=sessionEpoch;
 let q=db.from('universe_messages').select('*').gt('seq',S.cutoff).order('seq',{ascending:false}).limit(PAGE_SIZE);
 if(before)q=q.lt('seq',before);
 const {data,error}=await q;if(epoch!==sessionEpoch)return;if(error)throw error;
 S.hasMore=data.length===PAGE_SIZE;if(data.length)S.oldestSeq=Math.min(...data.map(m=>m.seq));
 S.older=!!before;
 S.messages=boundMessages(mergeMessages(S.messages,data),{limit:WINDOW_SIZE,older:S.older,favorites:new Set()});
 S.latestSeq=Math.max(S.latestSeq||0,...data.map(m=>m.seq));
 if(data.length){
  const ids=data.map(m=>m.id);
  const r=await db.from('universe_reactions').select('*').in('message_id',ids);
  if(epoch!==sessionEpoch)return;if(r.error)throw r.error;
  const set=new Set(ids);S.reactions=S.reactions.filter(r=>!set.has(r.message_id)).concat(r.data);
 }
 await loadReplyContext(data,epoch);
 await loadPhotos(data,epoch);
 receipt();
}
async function loadReplyContext(messages,epoch){
 const known=new Set([...S.messages.map(m=>m.id),...replyContext.keys()]);
 const ids=[...new Set(messages.map(m=>m.reply_to).filter(id=>id&&!known.has(id)))];
 if(!ids.length)return;
 const {data,error}=await db.from('universe_messages').select('*').in('id',ids);
 if(epoch!==sessionEpoch||error)return;
 for(const m of data)replyContext.set(m.id,m);
 await loadPhotos(data,epoch);
 while(replyContext.size>WINDOW_SIZE)replyContext.delete(replyContext.keys().next().value);
}
function applyIncoming(messages){
 for(const m of messages)if(replyContext.has(m.id))replyContext.set(m.id,m);
 const incoming=messages.filter(m=>!S.hidden?.has(m.id));
 S.latestSeq=Math.max(S.latestSeq||0,...incoming.map(m=>m.seq||0));
 let shown=incoming;
 if(S.older){
  const max=Math.max(0,...S.messages.filter(isConfirmed).map(m=>m.seq));
  shown=incoming.filter(m=>m.seq<=max||S.messages.some(old=>old.id===m.id));
  if(shown.length<incoming.length)S.newMessages=true;
 }
 S.messages=boundMessages(mergeMessages(S.messages,shown),{limit:WINDOW_SIZE,older:S.older,favorites:new Set()});chatView.unread(S);
}
async function showLatest(){
 S.older=false;S.newMessages=false;
 // Keep unsent messages and keepsakes while replacing the history window.
 S.messages=S.messages.filter(m=>!isConfirmed(m));
 if(!S.demo)await loadMessages();
 updateMessages(true);scrollBottom();
}
async function refresh(){
 if(S.demo||!S.user||document.hidden||!navigator.onLine)return;
 if(refreshing){refreshQueued=true;return}
 refreshing=true;const epoch=sessionEpoch;
 try{
  const {data:state,error}=await db.rpc('universe_sync_state');if(epoch!==sessionEpoch)return;if(error)throw error;
  if(!state?.preferences)throw Error('Account access unavailable');
  applyMetadata(state);
  // Keep the snapshot cursor separate from realtime events: receiving a later
  // event must never hide an earlier event missed during a disconnect.
  const target=state.revision||0;
  while(syncCursor<target){
   const {data,error:deltaError}=await db.from('universe_messages').select('*').gt('revision',syncCursor).lte('revision',target).order('revision',{ascending:true}).limit(100);
   if(epoch!==sessionEpoch)return;if(deltaError)throw deltaError;
   applyIncoming(data);
   await loadPhotos(data.filter(m=>m.body.startsWith('📷 ')||photoRecords.has(m.id)),epoch);
   syncCursor=data.length?Math.max(syncCursor,...data.map(m=>m.revision)):target;
   if(data.length<100)syncCursor=target;
  }
  const ids=visibleMessages(S.messages,S.cutoff).slice(-WINDOW_SIZE).map(m=>m.id);
  if(ids.length){const result=await db.from('universe_reactions').select('*').in('message_id',ids);if(epoch!==sessionEpoch)return;if(result.error)throw result.error;S.reactions=result.data}
  S.dataOnline=true;updateMessages();updateStatus();receipt();
 }catch{
  if(epoch===sessionEpoch){S.dataOnline=false;updateStatus()}
 }finally{if(epoch===sessionEpoch){refreshing=false;if(refreshQueued){refreshQueued=false;queueMicrotask(refresh)}}}
}
function startRealtime(){
 if(channel)return;
 const epoch=sessionEpoch;
 db.realtime.setAuth();
 receiptScheduler?.close();
 receiptScheduler=createReceiptScheduler(async values=>{const {error}=await db.rpc('universe_receipt',values);if(error)throw error});
 channel=db.channel('universe:two')
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'universe_preferences',filter:'user_id=eq.'+S.user.id},p=>{
  if(epoch!==sessionEpoch)return;
  if(p.new.cleared_through!==S.cutoff){S.cutoff=p.new.cleared_through;S.messages=S.messages.filter(m=>m.seq>S.cutoff||S.favorites.has(m.id)||!isConfirmed(m));S.older=false;S.hasMore=false;updateMessages()}
  if(p.new.theme!==theme){setTheme(p.new.theme);if(S.page==='settings')render()}
 })
 .on('postgres_changes',{event:'*',schema:'public',table:'universe_messages'},payload=>{
  if(epoch!==sessionEpoch||!payload.new?.id)return;
  const near=nearBottom();applyIncoming([payload.new]);stash();updateMessages(near&&!S.older);receipt();
  if(payload.new.body?.startsWith('📷 '))loadPhotos([payload.new],epoch).then(()=>{if(epoch===sessionEpoch)updateMessages()});
  if(replyContext.has(payload.new.id))replyContext.set(payload.new.id,payload.new);
  if(payload.new.reply_to)loadReplyContext([payload.new],epoch).then(()=>{if(epoch===sessionEpoch)updateMessages()});
 })
 .on('postgres_changes',{event:'*',schema:'public',table:'universe_photos'},p=>{
  if(epoch!==sessionEpoch||!p.new?.id)return;photoRecords.set(p.new.id,p.new);photos().then(()=>{if(epoch===sessionEpoch)updateMessages()});
 })
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'universe_members'},p=>{
  if(epoch!==sessionEpoch)return;
  if(p.new.user_id===S.user.id){S.me=p.new;chatView.unread(S);return}
  const nameChanged=S.partner?.name!==p.new.name;const receiptsChanged=S.partner?.last_read!==p.new.last_read||S.partner?.last_delivered!==p.new.last_delivered;S.partner=p.new;
  if(nameChanged&&$('#partner-name'))$('#partner-name').textContent=S.partner.name;
  if(receiptsChanged)updateReceipts();updateStatus();
  const t=$('#typing');clearTimeout(typingTimer);
  if(t)t.innerHTML=p.new.share_presence&&p.new.typing_until&&new Date(p.new.typing_until)>new Date()?'<span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>'+esc(S.partner.name||'Your person')+' is typing…</span>':'';
  typingTimer=setTimeout(()=>{if($('#typing'))$('#typing').textContent=''},4000);
 })
 .on('postgres_changes',{event:'*',schema:'public',table:'universe_reactions'},p=>{
  if(epoch!==sessionEpoch)return;
  const r=p.eventType==='DELETE'?p.old:p.new;if(!r?.message_id)return;
  S.reactions=S.reactions.filter(old=>old.message_id!==r.message_id||old.user_id!==r.user_id);
  if(p.eventType!=='DELETE')S.reactions.push(r);updateMessages();
 })
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'universe_hidden',filter:'user_id=eq.'+S.user.id},p=>{
  if(epoch!==sessionEpoch)return;S.hidden.add(p.new.message_id);S.messages=S.messages.filter(m=>m.id!==p.new.message_id);updateMessages();
 })
 .on('postgres_changes',{event:'*',schema:'public',table:'universe_favorites'},p=>{
  if(epoch!==sessionEpoch)return;const f=p.eventType==='DELETE'?p.old:p.new;
  if(f?.user_id!==S.user.id)return;
  p.eventType==='DELETE'?S.favorites.delete(f.message_id):S.favorites.add(f.message_id);
  if(S.page==='chat')updateMessages();else if(S.page==='keepsakes')action('page-keepsakes');
 })
 .on('system',{},p=>{if(p.extension==='postgres_changes'&&p.status==='error'){S.connected=false;updateStatus()}})
 .subscribe(status=>{
  if(epoch!==sessionEpoch)return;S.connected=status==='SUBSCRIBED';updateStatus();
  if(S.connected)refresh();
 });
 clearInterval(pulse);clearInterval(presenceClock);presenceClock=setInterval(()=>{if(!document.hidden)updateStatus()},15000);
 pulse=setInterval(()=>{if(!document.hidden&&navigator.onLine){receipt();updateStatus();if(!S.connected||!S.dataOnline)refresh()}},30000);
 receipt();
}
function updateStatus(){
 chatView?.unread(S);const el=$('#partner-status');if(!el)return;
 const activity=chatView.presenceLabel(S.partner,{connected:S.connected||S.demo});
 const text=!navigator.onLine?'Offline · your messages are safe to retry':S.dataOnline===false?'Connection interrupted · retrying…':!S.connected&&!S.demo?'Connecting · checking for messages':activity.text;
 el.innerHTML=(activity.online&&navigator.onLine&&S.dataOnline!==false?'<span class="dot"></span> ':'')+esc(text);el.title=activity.title||'';

}
function receipt(){
 if(S.demo||!S.user||document.hidden||!navigator.onLine||!receiptScheduler)return;
 const seen=S.page==='chat'&&nearBottom()&&!S.older?Math.max(0,...visibleMessages(S.messages,S.cutoff).filter(isConfirmed).map(m=>m.seq)):0;
 receiptScheduler.request(S.latestSeq||0,seen);
}
function updateReceipts(){
 if(S.page!=='chat')return;
 for(const el of document.querySelectorAll('[data-receipt]')){
  const m=S.messages.find(m=>m.id===el.dataset.receipt);if(!m)continue;
  const stamp=el.closest('[data-message]')?.querySelector('.message-time'),label=time(m.created_at)+(m.edited_at&&!m.deleted?' · edited':'');if(stamp&&stamp.textContent!==label)stamp.textContent=label;const status=receiptLabel(m,S.partner);if(el.dataset.status===status)continue;
  el.dataset.status=status;el.innerHTML=receiptHTML(m);
 }
}
function receiptHTML(m){return chatView.receiptHTML(m,receiptLabel(m,S.partner))}

function render() {
  ritualGame?.unmount();locationAPI?.unmount();island?.unmount();garden?.unmount();
  const active = (p) => S.page === p ? "active" : "";
  $("#app").innerHTML = `<div class="app-layout"><aside class="sidebar" id="sidebar">${ib("close", "Close navigation", "mobile-menu", "sidebar-close")}<div class="brand">${logo()}<div><strong>Our Little Universe</strong><small>JUST THE TWO OF US.</small></div></div><div class="eyebrow">Our space</div><button class="nav ${active("chat")}" data-action="page-chat">${icon("chat")} Our conversation</button><button class="nav ${active("keepsakes")}" data-action="page-keepsakes">${icon("bookmark")} Keepsakes</button><button class="nav ${active("about")}" data-action="page-about">${icon("spark")} Our little world</button><button class="nav ${active("garden")}" data-action="page-garden">${icon("sun")} Our moon garden</button><button class="nav ${active("island")}" data-action="page-island">${icon("moon")} Our secret island</button><button class="nav ${active("location")}" data-action="page-location">${icon("eye")} Our places</button><div class="eyebrow" style="margin-top:30px">Make it yours</div><button class="nav ${active("settings")}" data-action="page-settings">${icon("settings")} Settings</button><div class="side-card">${icon("heart")}<p>\u201CThe best part of my day<br>is a little moment with you.\u201D</p><small>EVERYDAY MAGIC, JUST US.</small></div><div class="side-person"><div class="avatar">${esc(S.me?.name?.[0] || "Y")}</div><div><strong>${esc(S.me?.name || "You")}</strong><small>Your little corner of the world</small></div>${ib("logout", S.demo ? "Leave sample" : "Sign out", "logout")}</div></aside><main class="main"><header class="chat-header">${ib("menu", "Open navigation", "mobile-menu", "mobile-menu")}<div class="avatar pair">${S.page === "chat" ? esc(S.partner?.name?.[0] || "\u2661") : icon(S.page === "keepsakes" ? "bookmark" : S.page === "settings" ? "settings" : "spark")}</div><div><h1>${S.page === "chat" ? `<span id="partner-name">${esc(S.partner?.name || "Your person")}</span>` : S.page === "keepsakes" ? "Our keepsakes" : S.page === "settings" ? "Make yourself at home" : S.page === "garden" ? "Our moon garden" : S.page === "island" ? "Our secret island" : S.page === "location" ? "Our places" : "Our little world"} ${S.page === "chat" ? '<span style="color:var(--accent);font-weight:400">\u2661</span>' : ""}</h1><small id="partner-status">A little space, just for us</small></div><div class="header-actions"><span class="header-label">${icon("lock")} ONLY US</span>${ib("search", "Find a message", "search")}${ib(theme === "dark" ? "sun" : "moon", "Change appearance", "toggle-theme")}${ib("more", "Conversation options", "options")}</div></header>${S.demo ? '<div class="banner demo-banner">Sample universe \xB7 these are fictional messages.<button data-action="logout">Sign in to your own account</button></div>' : `<div class="banner">${icon("lock")} Our Little Universe <span>·</span> Just the two of us</div>`}<div id="location-controls"></div>${S.page === "chat" ? chatHTML() : S.page === "settings" ? (pageViews?.settingsHTML(pageContext())||secondaryPlaceholder()) : S.page === "keepsakes" ? (pageViews?.keepsakesHTML(pageContext())||secondaryPlaceholder()) : S.page === "garden" ? '<section class="content-page" id="garden-root"><p role="status">Opening our garden…</p></section>' : S.page === "island" ? '<section class="content-page" id="island-root"><p role="status">Finding our island…</p></section>' : S.page === "location" ? '<section class="content-page" id="location-root"><p>Opening our places…</p></section>' : (pageViews?.aboutHTML(pageContext())||secondaryPlaceholder())}</main></div>`;
  updateStatus();locationAPI?.controls($("#location-controls"));
  if(S.page==='about')import('./rituals.js').then(module=>{if(S.page==='about'&&$('#ritual-root')){ritualGame=module;module.mount($('#ritual-root'),{user:S.user,draft:prepareDraft})}}).catch(()=>{if($('#ritual-root'))$('#ritual-root').textContent='Couldn’t open these activities. Check your connection and reopen this page.'});
  if(S.page==='keepsakes'&&photoAPI)photoAPI.observe($('#keepsake-list'),id=>photoRecords.get(id));
  if(S.page==='location')import('./location.js').then(async module=>{if(S.page==='location'&&S.user){locationAPI=module;await module.configure(db,{user:S.user,me:S.me,partner:S.partner,demo:S.demo});if(S.page==='location'&&S.user){module.controls($('#location-controls'));module.mount($('#location-root'),{user:S.user,me:S.me,partner:S.partner,demo:S.demo})}}}).catch(()=>{if($('#location-root'))$('#location-root').textContent='Could not open locations. Return to chat and try again.'});
  if(S.page==='island')import('./island.js').then(module=>{if(S.page==='island'&&S.user){island=module;island.mount($('#island-root'),{db,user:S.user,me:S.me,partner:S.partner,demo:S.demo})}}).catch(()=>{if($('#island-root'))$('#island-root').innerHTML='<p>Could not find our island. Return to chat and try again.</p>'});
  if(S.page==='garden')import('./garden.js').then(module=>{if(S.page==='garden'&&S.user){garden=module;garden.mount($('#garden-root'),{db,user:S.user,me:S.me,partner:S.partner,demo:S.demo})}}).catch(()=>{if($('#garden-root'))$('#garden-root').innerHTML='<p>Could not open the garden. Return to chat and try again.</p>'});
  if (S.page === "chat") {
    primeLog();
    observePhotos();
    attachSwipeReply($('#messages'),id=>{const m=S.messages.find(m=>m.id===id);if(m&&!m.deleted)beginReply(m)});
    const ta = $("#message-input");
    ta.value = draft;
    ta.addEventListener("input", () => {
      draft = ta.value;
      stash();
      ta.style.height = "auto";
      ta.style.height = Math.min(150, ta.scrollHeight) + "px";
      if (Date.now() - lastTyped > 3000 && channel && S.me.share_presence) {
        db.rpc("universe_typing").then(()=>{});
        lastTyped = Date.now();
      }
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !matchMedia("(max-width:700px)").matches && !e.isComposing) {
        e.preventDefault();
        send();
      }
    });
    $("#messages").addEventListener("scroll", () => {
      if (nearBottom()) {
        receipt();
        $("#jump")?.remove();
      }
    });
  }
}
function chatHTML() {
  return `<div class="messages" id="messages" role="log" aria-label="Your conversation">${messagesHTML()}</div><div class="composer-area"><div id="typing" class="typing" aria-live="polite"></div><div id="reply-container">${replyHTML()}</div><form id="composer" class="composer">${ib("photo", "Share a photo", "attach-photo")}${ib("smile", "Choose an emoji", "emoji")}${ib("spark", "A little note", "little-notes", "ritual-compose")}<textarea id="message-input" rows="1" maxlength="8000" aria-label="Your message" placeholder="A little thought, just for you\u2026"></textarea><button type="submit" class="send" aria-label="Send message">${icon("send")}</button></form><div class="composer-footer"><span>${icon("heart")} A little world. Just us.</span><span class="desktop-hint">Enter to send \xB7 Shift + Enter for a new line</span><span>${icon("lock")} Invitation only</span></div></div>`;
}
function messageSignature(m){
 const reply=messageLookup.get(m.reply_to);
 return JSON.stringify([m.body,!!m.deleted,m.edited_at,(m.photoPending||photoRecords.has(m.id))?m.pending:null,m.reply_to,reply?.body,reply?.deleted,photoRecords.get(m.id),S.favorites.has(m.id),reactionLookup.get(m.id)||[]]);
}
function logItems(){
 const all=visibleMessages(S.messages,S.cutoff),ms=S.older?all.slice(0,WINDOW_SIZE):all.slice(-WINDOW_SIZE);
 messageLookup=new Map([...replyContext,...S.messages.map(m=>[m.id,m])].filter(([id,m])=>!S.hidden?.has(id)&&(m.seq>S.cutoff||S.favorites.has(id)||!isConfirmed(m))));reactionLookup=new Map();
 for(const r of S.reactions){const list=reactionLookup.get(r.message_id)||[];list.push(r);reactionLookup.set(r.message_id,list)}
 const items=[];
 const add=(key,html)=>items.push({key,signature:html,html:()=>html});
 if(!ms.length){add('empty-'+S.cutoff,`<div class="welcome-moment" style="margin-top:70px"><span class="mini-heart">${icon('heart')}</span><h2>${S.cutoff?'A fresh little page.':'Our story starts here.'}</h2><p>${S.cutoff?'Your view is clear. Your partner’s memories are still theirs.':'No grand words needed. A little hello is a lovely beginning.'}</p></div>`);return items}
 if(S.hasMore)add('older','<button class="more-btn" data-action="older">Earlier little moments ↑</button>');
 if(!S.hasMore&&!S.cutoff)add('welcome',`<div class="welcome-moment"><span class="mini-heart">${icon('heart')}</span><h2>A little world, with you in it.</h2><p>For the big feelings and the tiny details.<br>There’s a place for all of them here.</p></div>`);
 let last='',previous=null,unread=false;
 for(const m of ms){const day=date(m.created_at);if(day!==last){add('day-'+day,`<div class="day">${esc(day)} <span>♡</span></div>`);last=day}
  if(!unread&&m.sender!==S.user.id&&m.seq>S.unreadBoundary&&S.unreadBoundary>0&&!S.older){add('unread-'+S.unreadBoundary,'<div class="unread-divider" role="separator">New little moments</div>');unread=true}
  const grouped=!!previous&&previous.sender===m.sender&&date(previous.created_at)===day&&new Date(m.created_at)-new Date(previous.created_at)<300000;
  items.push({key:'message-'+m.id,signature:messageSignature(m)+'|'+grouped,html:()=>messageHTML(m,grouped)});previous=m;
 }
 if(S.older)add('newer','<button class="more-btn" data-action="bottom">Back to our latest moments ↓</button>');
 return items;
}
function messagesHTML(){return logItems().map(item=>item.html()).join('')}
function primeLog(){const el=$('#messages');if(!el)return;const items=logItems();for(let i=0;i<items.length;i++){const node=el.children[i];if(node){node.dataset.logKey=items[i].key;renderSignatures.set(node,items[i].signature)}}}
function messageHTML(m,grouped=false){return chatView.messageHTML(m,grouped,{S,photoRecords,messageLookup,reactionLookup,receiptLabel,icon,esc,time,photoHTML,receiptHTML,ib,linkify})}

function nearBottom() {
  const el = $("#messages");
  return autoScrollPending||!el || el.scrollHeight - el.scrollTop - el.clientHeight < 100;
}
function scrollBottom() {
  autoScrollPending=true;
  requestAnimationFrame(() => {
    const el = $("#messages");
    if (el) el.scrollTop = el.scrollHeight;
    autoScrollPending=false;
  });
}
function updateMessages(force){
 if(S.page!=='chat'||document.hidden)return;
 if(renderFrame!==null)cancelAnimationFrame(renderFrame);
 renderFrame=requestAnimationFrame(()=>{renderFrame=null;
  const el=$('#messages');if(!el)return;
  const near=force??nearBottom(),top=el.scrollTop;
  const existing=new Map([...el.children].map(node=>[node.dataset.logKey,node]));
  let cursor=el.firstChild;
  for(const item of logItems()){
   let node=existing.get(item.key);
   if(!node||renderSignatures.get(node)!==item.signature){
    const t=document.createElement('template');t.innerHTML=item.html();node=t.content.firstElementChild;
    node.dataset.logKey=item.key;renderSignatures.set(node,item.signature);
    if(!existing.has(item.key)&&item.key==='message-'+S.messages.at(-1)?.id&&!S.older&&near&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
     node.querySelector('.message-main')?.animate([{opacity:.6,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:140,easing:'ease-out'});
    }
   }
   if(node===cursor)cursor=cursor.nextSibling;
   else el.insertBefore(node,cursor);
  }
  while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next}
  if(near&&!S.older)scrollBottom();else el.scrollTop=top;
  if((S.newMessages||(!near&&!S.older))&&!$('#jump'))$('.main').insertAdjacentHTML('beforeend','<button class="jump" id="jump" data-action="bottom">Latest little moments ↓</button>');
  if(near&&!S.older)requestAnimationFrame(receipt);
  updateReceipts();observePhotos();
 });
}
function replyHTML() {
  return S.reply || S.edit ? `<div class="reply-bar">${icon(S.edit ? "note" : "reply")}<div><b>${S.edit ? "Editing your message" : "Replying to " + esc(S.reply.sender === S.user.id ? "yourself" : S.partner?.name || "your person")}</b><br>${esc((S.edit || S.reply).body.slice(0, 110))}</div>${ib("close", "Cancel", "cancel-reply")}</div>` : "";
}
function beginReply(m){
 if(S.edit)draft=S.editDraft||'';S.reply=m;S.edit=null;closeModal();
 if(S.page!=='chat'){S.page='chat';render()}
 $('#reply-container').innerHTML=replyHTML();$('#message-input').value=draft;
 $('#message-input').focus({preventScroll:true});
}
async function send() {
  let input = $("#message-input");
  let body = input.value.trim();
  if (!body) return;
  if(S.older&&!S.edit){await showLatest();input=$('#message-input')}
  if (S.edit) {
    const mid = S.edit.id;
    try {
      if (!S.demo) {
        const { error } = await db.rpc("universe_change", { mid, content: body });
        if (error) throw error;
      }
      const m2 = S.messages.find((x) => x.id === mid);
      m2.body = body;
      m2.edited_at = (/* @__PURE__ */ new Date()).toISOString();
      S.edit = null;
      draft = "";stash();
      input.value = "";
      $("#reply-container").innerHTML = "";
      updateMessages();
    } catch {
      toast("Couldn\u2019t save that edit. Please try again.");
    }
    return;
  }
  const m = { id: crypto.randomUUID(), seq: Math.max(0, ...S.messages.map((x) => x.seq || 0)) + 1, sender: S.user.id, body, created_at: (/* @__PURE__ */ new Date()).toISOString(), reply_to: S.reply?.id || null, pending: true };
  S.messages.push(m);
  draft = "";
  flushStash();
  input.value = "";
  input.style.height = "auto";
  S.reply = null;
  $("#reply-container").innerHTML = "";
  updateMessages(true);
  await transmit(m);
}
async function transmit(m) {
  if(m.pending&&m.transmitting)return;
  m.transmitting=true;
  m.failed = false;
  m.pending = true;
  updateMessages();
  if (S.demo) {
    m.pending = false;m.transmitting=false;S.latestSeq=Math.max(S.latestSeq||0,m.seq);
    updateMessages(true);
    toast("Sample message sent. Nothing is shared or saved.");
    return;
  }
  const epoch=sessionEpoch;
  try {
    if(!navigator.onLine)throw Error("Offline");
    if(m.photoPending){
     const api=await photos(),row=(await api.loadDrafts(S.user.id)).find(r=>r.message.id===m.id);
     if(!row)throw Error('This unsent photo is no longer on this device. Please select it again.');
     const result=await api.send(m,row.photo,value=>{m.photoProgress=value;const el=document.querySelector(`[data-message="${m.id}"] .photo-upload`);if(el){el.querySelector('progress').value=value;el.querySelector('span').textContent=value>=90?'Finishing…':value+'% uploaded'}});
     if(epoch!==sessionEpoch)return;
     photoRecords.set(m.id,result.photo);applyIncoming([{...result.message,photoPending:false,transmitting:false}]);await api.removeDraft(S.user.id,m.id);if(!(await api.loadDrafts(S.user.id)).length){try{localStorage.removeItem('universe-photo-pending-'+S.user.id)}catch{}}stash();updateMessages(true);return;
    }
    const { data, error } = await db.rpc("universe_send", { mid: m.id, content: m.body, reply: m.reply_to });
    if(epoch!==sessionEpoch)return;
    if (error) throw error;
    applyIncoming([{...data,transmitting:false}]);
    stash();
    updateMessages(true);
  } catch (error) {
    if(epoch!==sessionEpoch)return;
    const acknowledged=S.messages.find(x=>x.id===m.id&&isConfirmed(x)&&x.revision);
    if(acknowledged&&!m.photoPending){stash();updateMessages();return}
    if(m.photoPending&&acknowledged&&photoRecords.get(m.id)?.sent){acknowledged.photoPending=false;acknowledged.transmitting=false;photoAPI?.removeDraft(S.user.id,m.id).catch(()=>{});stash();updateMessages();return}
    m.transmitting=false;
    m.pending = false;
    m.failed = true;
    stash();
    updateMessages();
    toast(m.photoPending?(error.message||'Photo upload failed. Tap retry.') : "Message wasn\u2019t sent. Tap retry when you\u2019re connected.");
  }
}



async function save(m) {
  const exists = S.favorites.has(m.id);
  try {
    if (!S.demo) {
      const r = exists ? await db.from("universe_favorites").delete().eq("user_id", S.user.id).eq("message_id", m.id) : await db.from("universe_favorites").insert({ user_id: S.user.id, message_id: m.id });
      if (r.error) throw r.error;
    }
    exists ? S.favorites.delete(m.id) : S.favorites.add(m.id);
    toast(exists ? "Removed from keepsakes" : "A little memory, kept. \u2661");
    if (S.page === "keepsakes") render();
    else updateMessages(false);
  } catch {
    toast("Couldn\u2019t update your keepsakes. Please try again.");
  }
}
async function messageMenu(m){modal((await import('./dialogs.js')).messageDialog(m,pageContext()))}

async function changeSettings() {
  if (S.demo) return;
  const { error } = await db.rpc("universe_profile", { display_name: S.me.name, presence: S.me.share_presence, selected_theme: theme });
  if (error) throw error;
}
function prepareDraft(text){draft=(draft?draft+'\n\n'+String(text):String(text)).slice(0,8000);S.page='chat';S.reply=S.edit=null;closeModal();render();stash();$('#message-input')?.focus({preventScroll:true});scrollBottom()}
async function action(a, el) {
 if(['options','privacy','clear','emoji','search'].includes(a)){modal((await import('./dialogs.js')).dialogHTML(a,pageContext()));if(a==='search')$('#search-input').focus();return}

  if(a==='ritual-next'){const views=await secondaryPages();views.nextDate();const card=$('.date-card');if(card){card.outerHTML=views.dateCardHTML(pageContext());$('.date-card [data-action="ritual-next"]')?.focus({preventScroll:true})}return}
  if(a==='ritual-invite'){prepareDraft((await secondaryPages()).todayDate().invite);return}
  if(a==='little-notes'){const notes=(await secondaryPages()).notes();modal(`<h2>A little “thinking of you.”</h2><p>Choose a note to make your own. Nothing sends automatically.</p><div class="action-list">${notes.map((n,i)=>`<button class="note-draft" data-action="note-draft-${i}">${esc(n)}</button>`).join('')}</div>`);return}
  if(a.startsWith('note-draft-')){prepareDraft((await secondaryPages()).notes()[Number(a.slice(11))]);return}

  if(a==='attach-photo'){
   if(S.demo){toast('Sign in to share a private photo.');return}
   await photos();modal(`<h2>A little moment, shared.</h2><p>Photos are compressed on your device before they leave it.</p><div class="action-list"><button data-action="photo-gallery">Choose from gallery</button><button data-action="photo-camera">Take a photo</button></div><input type="file" id="photo-gallery" accept="image/*" hidden><input type="file" id="photo-camera" accept="image/*" capture="environment" hidden>`);return;
  }
  if(a==='photo-gallery'||a==='photo-camera'){$('#'+a)?.click();return}
  if(a==='send-photo'){
   el.disabled=true;
   const caption=$('#photo-caption').value.trim(),api=await photos(),photo=api.peekPreview();
   const m={id:crypto.randomUUID(),seq:Math.max(0,...S.messages.map(m=>m.seq||0))+1,sender:S.user.id,body:'📷 '+(caption||'Photo'),created_at:new Date().toISOString(),reply_to:S.reply?.id||null,photoPending:true,pending:true};
   try{await api.saveDraft(S.user.id,m,photo)}catch(error){el.disabled=false;throw error}api.takePreview();try{localStorage.setItem('universe-photo-pending-'+S.user.id,'1')}catch{}
   photoRecords.set(m.id,{id:m.id,width:photo.width,height:photo.height});api.localThumb(m.id,photo.thumb);S.messages.push(m);S.reply=null;$('#reply-container').innerHTML='';closeModal();flushStash();updateMessages(true);await transmit(m);return;
  }
  if(a.startsWith('photo-view-')){const id=a.slice(11);if(!photoRecords.has(id)){const m=S.messages.find(m=>m.id===id);if(m)await loadPhotos([m])}const p=photoRecords.get(id);if(p?.sent){const api=await photos();dialogOpener=document.activeElement;$('#app').inert=true;await api.show(p,$('#modal-root'))}else toast('Photo not ready yet. Check your connection and tap again.');return}
  if(a==='retry-session'){el.disabled=true;try{if(resumeSession)await enter(resumeSession);else await restoreSession()}finally{el.disabled=false}return}
  if(a==='notifications'){
   if(S.demo){toast('Sign in to enable private notifications.');return}
   el.disabled=true;
   const permission='Notification'in window&&'PushManager'in window?Notification.requestPermission():null;
   try{const {toggleNotifications}=await import('./notifications.js');toast(await toggleNotifications(db,S.user.id,permission));render()}
   catch(error){toast(explainError(error))}finally{el.disabled=false}return;
  }
  if (a === "close-modal") {
    closeModal();
    return;
  }
  if (a === "demo") {
    await sample();
    return;
  }
  if (a === "invite-mode") {
    inviteMode = !inviteMode;
    login();
    return;
  }
  if (a === "show-password") {
    const p = $("#password");
    p.type = p.type === "password" ? "text" : "password";
    el.setAttribute("aria-label", p.type === "password" ? "Show password" : "Hide password");
    return;
  }
  if(a==='logout'){
   if(locationAPI&&!S.demo)await locationAPI.endSharing();
   setNotificationAccount(null);
   const wasDemo=S.demo,oldUser=S.user?.id;clearPrivateState();S.demo=false;login();
   if(!wasDemo&&oldUser)import('./notifications.js').then(({removeNotifications})=>removeNotifications(db,oldUser)).catch(()=>{});
   if(!wasDemo&&db){try{await db.auth.signOut({scope:'local'})}finally{try{localStorage.removeItem('sb-jczsnrzqocstbpsgwkdy-auth-token')}catch{}}}
   return;
  }
  if (a === "toggle-theme" || a.startsWith("theme-")) {
    setTheme(a === "toggle-theme" ? theme === "dark" ? "light" : "dark" : a.slice(6));
    if (S.user) {
      try {
        await changeSettings();
      } catch {
        toast("Appearance changed on this device; account sync failed.");
      }
      render();
    } else login();
    return;
  }
  if (a === "mobile-menu") {
    $("#sidebar").classList.toggle("open");
    el.setAttribute('aria-expanded',String($('#sidebar').classList.contains('open')));
    return;
  }
  if (a.startsWith("page-")) {
    S.page = a.slice(5);const at=sessionEpoch;if(['settings','keepsakes','about'].includes(S.page))await secondaryPages();if(at!==sessionEpoch)return;
    if (S.page === "keepsakes" && !S.demo && S.favorites.size) {
      const { data, error } = await db.from("universe_messages").select("*").in("id", [...S.favorites]);
      if (error) {
        toast("Couldn\u2019t load keepsakes.");
        return;
      }
      S.keepsakes = data;await loadPhotos(data);
    }
    render();
    if (S.page === "chat") {
      scrollBottom();
      receipt();
    }
    return;
  }
  if (a === "confirm-clear") {
    try {
      if (S.demo) S.cutoff = Math.max(0, ...S.messages.map((m2) => m2.seq));
      else {
        const { data, error } = await db.rpc("universe_clear");
        if (error) throw error;
        S.cutoff = data;
      }
      closeModal();
      S.older=false;S.hasMore=false;
      S.page = "chat";
      render();
      toast("Your view is clear. A fresh little page.");
    } catch {
      toast("Couldn\u2019t clear your view. Nothing has changed.");
    }
    return;
  }
  if (a === "save-name") {
    const name = $("#display-name").value.trim();
    if (!name) {
      toast("Choose a name, even a tiny one.");
      return;
    }
    const old = S.me.name;
    S.me.name = name;
    try {
      await changeSettings();
      toast("A familiar name, saved.");
      render();
    } catch {
      S.me.name = old;
      toast("Couldn\u2019t save your name. Try again.");
    }
    return;
  }
  if (a === "presence") {
    S.me.share_presence = !S.me.share_presence;
    try {
      await changeSettings();
      render();
    } catch {
      S.me.share_presence = !S.me.share_presence;
      toast("Couldn\u2019t update privacy settings.");
    }
    return;
  }
  if (a === "cancel-reply") {
    if(S.edit)draft=S.editDraft||'';S.reply = S.edit = null;
    $("#message-input").value = draft;
    $("#reply-container").innerHTML = "";stash();
    return;
  }
  if (a === "bottom") {
    if(S.older||S.newMessages)await showLatest();
    scrollBottom();
    $("#jump")?.remove();
    receipt();
    return;
  }
  if (a === "older") {
    if (loadingOlder) return;
    loadingOlder = true;
    const view = $("#messages"), height = view.scrollHeight, top = view.scrollTop;const anchor=[...view.querySelectorAll("[data-message]")].find(e=>e.getBoundingClientRect().bottom>view.getBoundingClientRect().top),anchorId=anchor?.dataset.message,anchorTop=anchor?.getBoundingClientRect().top;
    try {
      await loadMessages(Math.min(...S.messages.filter((m2) => !m2.pending && !m2.failed).map((m2) => m2.seq)));
      updateMessages(false);
      requestAnimationFrame(()=>{const kept=[...view.querySelectorAll("[data-message]")].find(e=>e.dataset.message===anchorId);view.scrollTop=kept&&anchorTop!==undefined?view.scrollTop+kept.getBoundingClientRect().top-anchorTop:top+view.scrollHeight-height});
    } catch {
      toast("Couldn\u2019t load earlier messages. Try again.");
    } finally {
      loadingOlder = false;
    }
    return;
  }
  if (a === "insert-emoji") {
    const ta=$('#message-input'),pos=ta?.selectionStart??draft.length,end=ta?.selectionEnd??pos;draft=draft.slice(0,pos)+el.dataset.emoji+draft.slice(end);stash();
    closeModal();
    $("#message-input").value = draft;
    $("#message-input").focus();$("#message-input").setSelectionRange(pos+el.dataset.emoji.length,pos+el.dataset.emoji.length);
    return;
  }
  const prefix = a.slice(0, a.indexOf("-")), id = a.slice(a.indexOf("-") + 1), m = S.messages.find((m2) => m2.id === id);
  if (!m) return;
  if (prefix === "message" || prefix === "react") {
    await messageMenu(m);
    return;
  }
  if (prefix === "retry") {
    await transmit(m);
    return;
  }
  if (prefix === "save") {
    await save(m);
    closeModal();
    return;
  }
  if (prefix === "copy") {
    try {
      await navigator.clipboard.writeText(m.body);
      toast("Copied.");
    } catch {
      toast("Copy unavailable. Select the message text to copy.");
    }
    closeModal();
    return;
  }
  if (prefix === "reply" || prefix === "edit") {
    if(prefix==='reply'){beginReply(m);return}
    S.page = "chat";S.editDraft=draft;
    S.reply = prefix === "reply" ? m : null;
    S.edit = prefix === "edit" ? m : null;
    if (S.edit) draft = m.body;
    closeModal();
    render();
    scrollBottom();
    $("#message-input").focus();
    return;
  }
  if (prefix === "reaction") {
    const emoji = el.dataset.emoji;
    try {
      if (!S.demo) {
        const { error } = await db.from("universe_reactions").upsert({ user_id: S.user.id, message_id: m.id, emoji });
        if (error) throw error;
      }
      S.reactions = S.reactions.filter((r) => r.message_id !== m.id || r.user_id !== S.user.id);
      S.reactions.push({ message_id: m.id, user_id: S.user.id, emoji });
      closeModal();
      updateMessages(false);
    } catch {
      toast("Couldn\u2019t add your reaction. Try again.");
    }
    return;
  }
  if (prefix === "hide" || prefix === "delete") {
    modal(`<h2>${prefix === "hide" ? "Delete only for you?" : "Remove for both of you?"}</h2><p>${prefix === "hide" ? "This message will disappear from your view only. Your partner keeps their copy." : "Your message will be replaced with \u201CThis message was removed\u201D for both people. Your partner may already have read it."}</p><div class="modal-actions"><button class="secondary" data-action="close-modal">Keep it</button><button class="primary" data-action="${prefix === "hide" ? "dohide" : "dodelete"}-${m.id}">Confirm removal</button></div>`);
    return;
  }
  if (prefix === "dohide" || prefix === "dodelete") {
    try {
      if (!S.demo) {
        const r = prefix === "dohide" ? await db.from("universe_hidden").insert({ user_id: S.user.id, message_id: m.id }) : await db.rpc("universe_change", { mid: m.id, content: null });
        if (r.error) throw r.error;
      }
      if (prefix === "dohide") {
        S.hidden.add(m.id);S.messages = S.messages.filter((x) => x.id !== m.id);
        S.favorites.delete(m.id);
      } else {
        m.deleted = true;
        m.body = "";
      }
      closeModal();
      updateMessages(false);
      toast("Message removed.");
    } catch {
      toast("Couldn\u2019t remove the message. Try again.");
    }
    return;
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b) {
    const a = b.dataset.action;
    if (a.startsWith("page-")) closeModal();
    action(a, b).catch(() => toast("Something didn\u2019t go through. Please try again."));
  }
  if (e.target.classList.contains("modal-overlay")) closeModal();
  if ($("#sidebar")?.classList.contains("open") && !e.target.closest(".sidebar") && !e.target.closest('[data-action="mobile-menu"]')) $("#sidebar").classList.remove("open");
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "login-form") signIn(e);
  if (e.target.id === "composer") {
    e.preventDefault();
    send();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search-input") {
    const q = e.target.value.trim().toLowerCase();
    $("#search-results").innerHTML = q ? visibleMessages(S.messages, S.cutoff).filter((m) => !m.deleted && m.body.toLowerCase().includes(q)).slice(-20).map((m) => `<article class="note"><small>${date(m.created_at)} \xB7 ${time(m.created_at)}</small><p style="font:13px/1.8 'DM Sans',sans-serif">${linkify(m.body)}</p></article>`).join("") || "<p>No little moments found.</p>" : "";
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {closeModal();$("#sidebar")?.classList.remove("open")}
  if (e.key === "Tab" && $(".modal,.photo-lightbox")) {
    const els = [...$(".modal,.photo-lightbox").querySelectorAll("button,input,textarea,a")].filter((x) => !x.disabled);
    if (e.shiftKey && document.activeElement === els[0]) {
      e.preventDefault();
      els.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
      e.preventDefault();
      els[0].focus();
    }
  }
});
document.addEventListener('visibilitychange',()=>{
 document.body.classList.toggle('app-hidden',document.hidden);if(!S.user||S.demo)return;
 if(document.hidden){flushStash();hiddenPause=setTimeout(()=>{if(document.hidden)stop()},30000)}
 else{clearTimeout(hiddenPause);if(!channel)startRealtime();else refresh()}
});
window.addEventListener('online',()=>{if(S.user&&!S.demo){if(!channel)startRealtime();refresh()}updateStatus()});
window.addEventListener('offline',updateStatus);
window.addEventListener('pagehide',flushStash);
login();
// The public login and sample don't download or initialize the messaging SDK.
let hasSavedSession=false;try{hasSavedSession=!!localStorage.getItem('sb-jczsnrzqocstbpsgwkdy-auth-token')}catch{}
if(hasSavedSession||location.hash.includes('access_token')||new URLSearchParams(location.search).has('code'))restoreSession();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',event=>{
 if(event.data?.type==='OPEN_CHAT'&&S.user&&!S.demo){S.page='chat';render();refresh();scrollBottom()}
});
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>setNotificationAccount(S.user&&!S.demo?S.user.id:null));

if(window.visualViewport){const resize=()=>{if(visualViewport.scale===1)document.documentElement.style.setProperty('--app-height',visualViewport.height+'px')};visualViewport.addEventListener('resize',resize,{passive:true});resize()}

document.addEventListener('change',async event=>{
 if(!['photo-gallery','photo-camera'].includes(event.target.id)||!event.target.files?.[0])return;
 const file=event.target.files[0],epoch=sessionEpoch,selection=++photoSelection;
 modal('<h2>A little less data.</h2><p role="status">Preparing your photo on this device…</p>');
 try{const api=await photos();if(epoch!==sessionEpoch||selection!==photoSelection)return;const photo=await api.prepare(file);if(epoch!==sessionEpoch||selection!==photoSelection){api.cancelPreview();return}
  modal(`<h2>A moment for your person.</h2><img class="photo-preview" src="${photo.url}" alt="Photo preview"><p class="photo-detail">${Math.round(photo.originalBytes/1024)} KB → ${Math.round((photo.full.size+photo.thumb.size)/1024)} KB · ${photo.width} × ${photo.height}<br>Private. Compressed here. Original camera metadata removed.</p><label for="photo-caption">A little caption (optional)</label><input id="photo-caption" maxlength="1000" placeholder="Tell the story behind it…"><div class="modal-actions"><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="send-photo">Send photo ${icon('send')}</button></div>`);
 }catch(error){if(epoch===sessionEpoch&&selection===photoSelection&&$('#modal-root').children.length){closeModal();toast(error.message)}}
});
