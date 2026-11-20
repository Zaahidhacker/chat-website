import {updateRelationship,startRelationshipClock} from './relationship.js';
startRelationshipClock();
import { visibleMessages, receiptLabel, mergeMessages, boundMessages, isConfirmed } from "./logic.js";
import { createReceiptScheduler, debounce } from "./scheduling.js";
import { explainError, isConnectionError, resilientFetch } from './connection.js';
import { linkify } from './links.js';
const URL = "https://jczsnrzqocstbpsgwkdy.supabase.co";
const KEY = "sb_publishable_bC-d7dzejgvGCetYD-JjOg_WKEZKJco";
const AUTH_STORAGE_KEY='sb-jczsnrzqocstbpsgwkdy-auth-token';
let db,clientReady,chatView,voiceAPI,livePresence,authStorage,signingOut=false;
let rememberWorld=true;try{rememberWorld=!sessionStorage.getItem(AUTH_STORAGE_KEY)}catch{}
function ensureClient(){
 if(!clientReady)clientReady=Promise.all([import('@supabase/supabase-js'),import('./conversation-view.js')]).then(async([{createClient},views])=>{await views.ready;chatView=views;
  authStorage=views.createSessionStorage({remember:()=>rememberWorld});
  db=createClient(URL,KEY,{global:{fetch:resilientFetch},auth:{storage:authStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:5}}});
  db.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'&&!S.demo&&!signingOut){clearPrivateState();login();setNotificationAccount(null)}
   if(event==='TOKEN_REFRESHED'&&session){db.realtime.setAuth(session.access_token)}
  });
  return db;
 }).catch(error=>{clientReady=null;throw error});
 return clientReady;
}

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const paths = {heart:"M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",arrow:"M5 12h14m-6-6 6 6-6 6"};
const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n] || chatView?.paths[n] || paths.heart}"/></svg>`;
const ib = (n, title, action2, cl = "") => `<button type="button" class="icon-btn ${cl}" aria-label="${title}" title="${title}" data-action="${action2}">${icon(n)}</button>`;
const logo = () => `<div class="logo">${icon("heart")}</div>`;
let S = { user: null, me: null, partner: null, messages: [], favorites: /* @__PURE__ */ new Set(), reactions: [], cutoff: 0, page: "chat", demo: false, reply: null, edit: null, loading: false, hasMore: true, connected: false };
function savedTheme(){try{return localStorage.getItem("universe-theme")||"dark"}catch{return "dark"}}
let theme = savedTheme(), channel, pulse, presenceClock, typingTimer, lastTyped = 0, toastTimer, inviteMode = false, loadingOlder = false, refreshing = false, refreshQueued = false;
let draft = "";
let sessionEpoch=0,syncCursor=0,historyRequest=0,receiptScheduler=null,hiddenPause=null,stashTimer=null,renderFrame=null,recoveryTimer=null,recoveryAttempts=0;
function recoverSoon(){if(recoveryTimer||recoveryAttempts>=3||!S.user||S.demo||document.hidden||!navigator.onLine)return;recoveryTimer=setTimeout(()=>{recoveryTimer=null;refresh()},[1000,3000,8000][recoveryAttempts++])}
let messageLookup=new Map(),reactionLookup=new Map(),autoScrollPending=false;
let replyContext=new Map(), resumeSession=null;
let ritualGame,pageViews,photoAPI,garden,island,locationAPI,photoRecords=new Map();
function pageContext(){return {S,theme,esc,icon,date,time,photoHTML,mergeMessages,linkify}}
async function secondaryPages(){return pageViews??=await import('./pages.js').then(async v=>{await v.ready;return v})}
const secondaryPlaceholder=()=>'<section class="content-page"><div class="page-skeleton" role="status"><div class="skeleton-line" style="width:55%"></div><div class="skeleton-line" style="width:85%"></div><div class="skeleton-line" style="width:70%"></div><span>Opening your little corner…</span></div></section>';
function hideBoot(){const boot=document.getElementById('boot');if(!boot)return;boot.classList.add('leaving');setTimeout(()=>boot.remove(),220)}
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
 hideBoot();
 $('#app').innerHTML=`<main class="reconnect"><div class="brand">${logo()}<strong>Our Little Universe</strong></div><h1>A moment to reconnect.</h1><p role="status">${esc(explainError(error))}</p><button class="primary" data-action="retry-session">Try again ${icon('arrow')}</button><button class="text-btn" data-action="logout">Sign out of this device</button></main>`;
 chatView?.enterPanel($('.reconnect'));
}
async function restoreSession(){
 try{await ensureClient();const {data,error}=await db.auth.getSession();if(error)throw error;if(data.session)await enter(data.session);else login()}
 catch(error){if(isConnectionError(error))connectionScreen(error);else{login();$('#login-error').textContent=explainError(error)}}
}
const renderSignatures=new WeakMap(),receiptTimes=new WeakMap();
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
try{
 const motion=localStorage.getItem('universe-motion');
 if(motion==='lite'||(!motion&&((navigator.deviceMemory||Infinity)<=4||(navigator.hardwareConcurrency||Infinity)<=4)))document.documentElement.dataset.motion='lite';
}catch{}
try{document.body.classList.toggle('quiet-sky',localStorage.getItem('universe-quiet-sky')==='true')}catch{}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4e3);
}
let swipeCleanup,dialogOpener,photoSelection=0,dialogRequest=0;
async function openDialog(load,view){const request=++dialogRequest,result=await load();if(request===dialogRequest)modal(view(result))}
function modal(html) {
  dialogRequest++;chatView?.watchClose('dialog',closeModal);
  if(!$("#modal-root").children.length)dialogOpener=document.activeElement;$("#app").inert=true;
  $("#modal-root").innerHTML = `<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="Conversation action">${ib("close", "Close", "close-modal", "modal-close")}${html}</section></div>`;
  chatView?.prepareDialog($('.modal'));$('.modal').classList.add('motion-managed');chatView?.enterPanel($('.modal'));
  const first = $("button,input,textarea", $(".modal"));
  first?.focus();
}
function closeModal(animate=true) {
 chatView?.unwatchClose('dialog');if(animate)chatView?.exitOverlay($('#modal-root').firstElementChild);
 dialogRequest++;
 voiceAPI?.dispose();
  photoSelection++;photoAPI?.cancelPreview();
  $("#modal-root").innerHTML = "";$("#app").inert=false;if(dialogOpener?.isConnected)dialogOpener.focus({preventScroll:true});dialogOpener=null;
}
function time(t){return clockFormat.format(new Date(t))}
function date(t){const d=new Date(t);return d.toDateString()===new Date().toDateString()?'Today':dayFormat.format(d)}
function login() {
  hideBoot();
  stop();
  S.user = null;
  $("#app").replaceChildren($("#login-template").content.cloneNode(true));
  document.querySelectorAll('[data-action=ambient-mode]').forEach(b=>b.setAttribute('aria-pressed',String(document.body.classList.contains('quiet-sky'))));
  updateRelationship();$("#remember-world").checked=rememberWorld;
  if(inviteMode){
   $('[data-purpose="auth-card-container"] h2').textContent='Make yourself at home.';
   $('[data-purpose="auth-card-container"] h2+p').textContent='Your invitation opens the door. Choose your password, then verify your email.';
   $('label[for="password"]').textContent='Create your password';$('#password').autocomplete='new-password';
   $('#password').placeholder='At least 12 characters';
   $('#invite-slot').innerHTML='<label for="invite">Your private invitation code</label><input id="invite" name="invite" autocomplete="off" required placeholder="Paste your invitation code">';
   $('#login-form button[type="submit"]').textContent='Create my account';
   $('[data-action="invite-mode"]').textContent='Already have a password? Sign in';
  }

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
 swipeCleanup?.();swipeCleanup=null;chatView?.observeComposer(null);chatView?.unbindViewport();chatView?.closeNavigation();chatView?.clearMotion();
 chatView?.stopProject28();chatView?.closeSecret();ritualGame?.unmount();locationAPI?.dispose();island?.dispose();garden?.dispose();photoAPI?.dispose(S.user?.id);photoRecords.clear();
 sessionEpoch++;refreshing=false;refreshQueued=false;clearTimeout(stashTimer);stop();
 if(S.user&&!S.demo){try{sessionStorage.removeItem('universe-draft-'+S.user.id);sessionStorage.removeItem('universe-outbox-'+S.user.id)}catch{}}
 draft='';S.messages=[];S.keepsakes=[];S.reactions=[];S.favorites=new Set();S.hidden=new Set();S.reply=S.edit=null;S.user=null;syncCursor=0;
 document.title='Our Little Universe — Just us.';messageLookup.clear();reactionLookup.clear();replyContext.clear();resumeSession=null;closeModal(false);
}
function restoreOutbox() {
  try {
    draft = sessionStorage.getItem("universe-draft-" + S.user.id) || "";
    const list = JSON.parse(sessionStorage.getItem("universe-outbox-" + S.user.id) || "[]");
    S.messages.push(...list.filter((m) => !S.messages.some((x) => x.id === m.id)).map((m) => ({ ...m, pending: false, failed: true })));
  } catch {
  }
}
function stop(preserveVoice=false){
 clearTimeout(recoveryTimer);recoveryTimer=null;recoveryAttempts=0;
 livePresence?.close();livePresence=null;
 if(!preserveVoice)voiceAPI?.dispose();
 if(channel&&db){db.removeChannel(channel);channel=null}
 clearInterval(pulse);clearInterval(presenceClock);clearTimeout(typingTimer);clearTimeout(hiddenPause);receiptScheduler?.close();receiptScheduler=null;
 if(renderFrame!==null){cancelAnimationFrame(renderFrame);renderFrame=null}
}
async function signIn(e) {
  e.preventDefault();
  let btn = $("button[type=submit]", e.target);
  btn.disabled = true;
  btn.setAttribute("aria-label", "Entering our universe");
  btn.innerHTML = '<span class="spinner"></span>';
  $("#login-error").textContent = "";
  try {
    rememberWorld=$('#remember-world')?.checked!==false;
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
    await enter(result.data.session,!inviteMode);
  } catch (err) {
    $("#login-error").textContent = explainError(err);
    btn.disabled = false;
    btn.removeAttribute("aria-label");
    btn.innerHTML = `${inviteMode ? "Create my account" : "Enter our universe"} ${icon("arrow")}`;
  }
}
async function sample() {
  chatView??=await import('./conversation-view.js');await chatView.ready;
  stop();
  S = { ...S, user: { id: "me" }, me: { user_id: "me", name: "Zaahid", slot: 1, share_presence: true }, partner: { user_id: "them", name: "Layaana", share_presence: true, last_seen: (/* @__PURE__ */ new Date()).toISOString(), last_delivered: 100, last_read: 100 }, demo: true, older:false, latestSeq:5, newMessages:false, hidden:new Set(), cutoff: 0, page: "chat", hasMore: false, connected: true, favorites: /* @__PURE__ */ new Set(["d3"]), reactions: [{ message_id: "d4", user_id: "me", emoji: "\u2764\uFE0F" }] };
  const now = Date.now();
  S.messages = [{ id: "d1", sender: "them", body: "Hey you. How\u2019s your little corner of the world today?", seq: 1 }, { id: "d2", sender: "me", body: "A little busy. A little better now that you\u2019re here.", seq: 2 }, { id: "d3", sender: "them", body: "Just a reminder: you\u2019re my favorite part of an ordinary day. \u2661", seq: 3 }, { id: "d4", sender: "me", body: "Can we pause the whole world and stay right here for a minute?", seq: 4 }, { id: "d5", sender: "them", body: "For you? Always. \u2728", seq: 5 }].map((m, i) => ({ ...m, created_at: new Date(now - (6 - i) * 6e4).toISOString() }));
  render();
  scrollBottom();
}
async function enter(session,welcome=false){
 if(!session){login();return}
 resumeSession={session,welcome};
 const epoch=++sessionEpoch;refreshing=false;refreshQueued=false;stop();
 S.demo=false;S.user=session.user;S.loading=true;
 S.messages=[];S.keepsakes=[];S.reactions=[];S.older=false;S.newMessages=false;S.latestSeq=0;S.hidden=new Set();S.reply=S.edit=null;
 try{
  const {data:state,error}=await db.rpc('universe_sync_state');
  if(epoch!==sessionEpoch)return;
  if(error)throw error;
  if(!state?.preferences)throw Error('This account has not joined yet. Use your private invitation to set up your account.');
  applyMetadata(state);S.unreadBoundary=S.me?.last_read||0;syncCursor=state.revision||0;setTheme(state.preferences.theme);S.page='chat';
  restoreOutbox();
  if(welcome)chatView.welcomeBack(S.me);
  render(); // First paint only once the partner and the restored draft are known, so the header never flashes "Your person" and the composer never flashes empty; the skeleton covers message loading below.
  await loadMessages();if(epoch!==sessionEpoch)return;
  let pendingPhotos=false;try{pendingPhotos=!!localStorage.getItem('universe-photo-pending-'+S.user.id)}catch{}
  if(pendingPhotos||S.messages.some(m=>m.photoPending)){
   const api=await photos(),rows=await api.loadDrafts(S.user.id);if(epoch!==sessionEpoch)return;
   for(const row of rows){if(!S.messages.some(m=>m.id===row.message.id))S.messages.push({...row.message,pending:false,failed:true,transmitting:false});photoRecords.set(row.message.id,{id:row.message.id,width:row.photo.width,height:row.photo.height});api.localThumb(row.message.id,row.photo.thumb)}
  }
  S.loading=false;S.dataOnline=true;render();scrollBottom();startRealtime();chatView.project28(db,S,receipt);setNotificationAccount(S.user.id);try{if(localStorage.getItem('universe-location-stop-'+S.user.id))import('./location.js').then(async module=>{if(epoch===sessionEpoch){locationAPI=module;await module.configure(db,{user:S.user,me:S.me,partner:S.partner,demo:false});module.controls($('#location-controls'))}}).catch(()=>{})}catch{}
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
 const epoch=sessionEpoch,request=++historyRequest;
 let q=db.from('universe_messages').select('*').gt('seq',S.cutoff).order('seq',{ascending:false}).limit(PAGE_SIZE);
 if(before)q=q.lt('seq',before);
 const {data,error}=await q;if(epoch!==sessionEpoch||request!==historyRequest)return;if(error)throw error;
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
   for(const m of data)if(!S.messages.some(x=>x.id===m.id))chatView.secretMessage(m,S.user.id);
   applyIncoming(data);
   S.dataOnline=true;updateMessages();updateStatus();
   await loadPhotos(data.filter(m=>m.body.startsWith('📷 ')||photoRecords.has(m.id)),epoch);
   syncCursor=data.length?Math.max(syncCursor,...data.map(m=>m.revision)):target;
   if(data.length<100)syncCursor=target;
  }
  const ids=visibleMessages(S.messages,S.cutoff).slice(-WINDOW_SIZE).map(m=>m.id);
  if(ids.length){const result=await db.from('universe_reactions').select('*').in('message_id',ids);if(epoch!==sessionEpoch)return;if(!result.error)S.reactions=result.data}
  clearTimeout(recoveryTimer);recoveryTimer=null;recoveryAttempts=0;
  S.dataOnline=true;updateMessages();updateStatus();receipt();
 }catch{
  if(epoch===sessionEpoch){S.dataOnline=false;updateStatus();recoverSoon()}
 }finally{if(epoch===sessionEpoch){refreshing=false;if(refreshQueued){refreshQueued=false;queueMicrotask(refresh)}}}
}
function startRealtime(){
 if(channel)return;
 const epoch=sessionEpoch;
 livePresence??=chatView.createPresence(db,{userId:S.user.id,member:()=>S.me,onChange:updateStatus});
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
  if(!S.connected||S.dataOnline===false){S.connected=true;S.dataOnline=true;updateStatus()}
  const near=nearBottom();applyIncoming([payload.new]);if(payload.eventType==='INSERT')chatView.secretMessage(payload.new,S.user.id);stash();updateMessages(near&&!S.older);receipt();
  if(payload.new.body?.startsWith('📷 '))loadPhotos([payload.new],epoch).then(()=>{if(epoch===sessionEpoch)updateMessages()});
  if(replyContext.has(payload.new.id))replyContext.set(payload.new.id,payload.new);
  if(payload.new.reply_to)loadReplyContext([payload.new],epoch).then(()=>{if(epoch===sessionEpoch)updateMessages()});
 })
 .on('postgres_changes',{event:'*',schema:'public',table:'universe_photos'},p=>{
  if(epoch!==sessionEpoch||!p.new?.id)return;photoRecords.set(p.new.id,p.new);photos().then(()=>{if(epoch===sessionEpoch)updateMessages()});
 })
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'universe_members'},p=>{
  if(epoch!==sessionEpoch)return;
  S.connected=true;S.dataOnline=true;
  if(p.new.user_id===S.user.id){S.me=p.new;livePresence?.reconcile();chatView.unread(S);return}
  const nameChanged=S.partner?.name!==p.new.name;const receiptsChanged=S.partner?.last_read!==p.new.last_read||S.partner?.last_delivered!==p.new.last_delivered;S.partner=p.new;
  if(nameChanged&&$('#partner-name'))$('#partner-name').textContent=S.partner.name;
  if(receiptsChanged)updateReceipts();updateStatus();
  const t=$('#typing');clearTimeout(typingTimer);
  if(t)t.innerHTML=!livePresence?.departedAt(p.new.user_id)&&p.new.share_presence&&p.new.typing_until&&new Date(p.new.typing_until)>new Date()?'<span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>'+esc(S.partner.name||'Your person')+' is typing…</span>':'';
  typingTimer=setTimeout(()=>{if($('#typing'))$('#typing').textContent='';updateStatus()},Math.min(10000,Math.max(0,Date.parse(p.new.typing_until)-Date.now())||0)+50);
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
 .on('system',{},p=>{if(p.extension==='postgres_changes'&&p.status==='error'){S.connected=false;updateStatus();recoverSoon()}})
 .subscribe(status=>{
  if(epoch!==sessionEpoch)return;S.connected=status==='SUBSCRIBED';updateStatus();
  if(S.connected)refresh();
  else recoverSoon();
 });
 clearInterval(pulse);clearInterval(presenceClock);presenceClock=setInterval(()=>{if(!document.hidden)updateStatus()},15000);
 pulse=setInterval(()=>{if(!document.hidden&&navigator.onLine){receipt();updateStatus();if(!S.connected||!S.dataOnline)refresh()}},30000);
 receipt();
}
function updateStatus(){
 chatView?.unread(S);const el=$('#partner-status');if(!el)return;
 if(livePresence?.departedAt(S.partner?.user_id)){clearTimeout(typingTimer);$('#typing')?.replaceChildren()}
 const activity=chatView.presenceLabel(S.partner,{connected:S.connected||S.demo,live:S.demo||livePresence?.online(S.partner?.user_id),departedAt:livePresence?.departedAt(S.partner?.user_id)});
 const text=!navigator.onLine?'Offline · your messages are safe to retry':S.dataOnline===false?'Connection interrupted · retrying…':!S.connected&&!S.demo?'Connecting · checking for messages':activity.text;
 el.innerHTML=(activity.online&&navigator.onLine&&S.dataOnline!==false?'<span class="dot"></span> ':'')+esc(text);el.title=activity.title||'';

}
function receipt(){
 if(S.demo||!S.user||document.hidden||!navigator.onLine||!receiptScheduler)return;
 const seen=S.page==='chat'&&!$('#app').inert&&nearBottom()&&!S.older?Math.max(0,...visibleMessages(S.messages,S.cutoff).filter(isConfirmed).map(m=>m.seq)):0;
 receiptScheduler.request(S.latestSeq||0,seen);
}
function updateReceipts(){
 if(S.page!=='chat')return;
 const messages=new Map(S.messages.map(m=>[m.id,m]));
 for(const el of document.querySelectorAll('[data-receipt]')){
  const m=messages.get(el.dataset.receipt);if(!m)continue;
  const stamp=el.closest('[data-message]')?.querySelector('.message-time'),key=m.created_at+'|'+(m.edited_at||'')+'|'+!!m.deleted;
  if(stamp&&receiptTimes.get(stamp)!==key){const label=time(m.created_at)+(m.edited_at&&!m.deleted?' · edited':'');if(stamp.textContent!==label)stamp.textContent=label;receiptTimes.set(stamp,key)}
  const status=receiptLabel(m,S.partner);if(el.dataset.status===status)continue;
  el.dataset.status=status;el.innerHTML=receiptHTML(m);
 }
}
function receiptHTML(m){return chatView.receiptHTML(m,receiptLabel(m,S.partner))}

function render() {
 hideBoot();
 livePresence?.reconcile();
  swipeCleanup?.();swipeCleanup=null;chatView.observeComposer(null);ritualGame?.unmount();locationAPI?.unmount();island?.unmount();garden?.unmount();
  $("#app").innerHTML=chatView.shellHTML({S,theme,logo,ib,icon,esc,chatHTML,pageViews,pageContext,secondaryPlaceholder});
  updateRelationship();document.querySelectorAll('[data-action=ambient-mode]').forEach(b=>b.setAttribute('aria-pressed',String(document.body.classList.contains('quiet-sky'))));
  updateStatus();locationAPI?.controls($("#location-controls"));
  if(S.page==='about')import('./rituals.js').then(module=>{if(S.page==='about'&&$('#ritual-root')){ritualGame=module;module.mount($('#ritual-root'),{user:S.user,draft:prepareDraft})}}).catch(()=>{if($('#ritual-root'))$('#ritual-root').textContent='Couldn’t open these activities. Check your connection and reopen this page.'});
  if(S.page==='keepsakes'&&photoAPI)photoAPI.observe($('#keepsake-list'),id=>photoRecords.get(id));
  if(S.page==='location')import('./location.js').then(async module=>{if(S.page==='location'&&S.user){locationAPI=module;await module.configure(db,{user:S.user,me:S.me,partner:S.partner,demo:S.demo});if(S.page==='location'&&S.user){module.controls($('#location-controls'));module.mount($('#location-root'),{user:S.user,me:S.me,partner:S.partner,demo:S.demo})}}}).catch(()=>{if($('#location-root'))$('#location-root').textContent='Could not open locations. Return to chat and try again.'});
  if(S.page==='island')import('./island.js').then(module=>{if(S.page==='island'&&S.user){island=module;island.mount($('#island-root'),{db,user:S.user,me:S.me,partner:S.partner,demo:S.demo})}}).catch(()=>{if($('#island-root'))$('#island-root').innerHTML='<p>Could not find our island. Return to chat and try again.</p>'});
  if(S.page==='garden')import('./garden.js').then(module=>{if(S.page==='garden'&&S.user){garden=module;garden.mount($('#garden-root'),{db,user:S.user,me:S.me,partner:S.partner,demo:S.demo})}}).catch(()=>{if($('#garden-root'))$('#garden-root').innerHTML='<p>Could not open the garden. Return to chat and try again.</p>'});
  chatView.bindViewport();
  if (S.page === "chat") {
    primeLog();
    observePhotos();
    swipeCleanup=chatView.attachSwipeReply($('#messages'),id=>{const m=S.messages.find(m=>m.id===id);if(m&&!m.deleted)beginReply(m)},id=>{const button=$(`[data-message="${id}"] [data-action^=message-]`);if(button)action(button.dataset.action,button)});
    const ta = $("#message-input");
    ta.value = draft;chatView.observeComposer(ta);
    ta.addEventListener("input", () => {
      draft = ta.value;
      stash();
      chatView.fitComposer(ta);
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
  return `<div class="messages" id="messages" role="log" aria-label="Your conversation">${messagesHTML()}</div><div class="composer-area"><div id="typing" class="typing" aria-live="polite"></div><div id="reply-container">${replyHTML()}</div><form id="composer" class="composer">${ib("photo", "Share a photo", "attach-photo")}${ib("smile", "Choose an emoji", "emoji")}${ib("note", "A little note", "little-notes", "ritual-compose")}${ib("spark", "Send a wishing star", "wishing-star", "wish-compose")}<textarea id="message-input" rows="1" maxlength="8000" aria-label="Your message" placeholder="A little thought, just for you\u2026"></textarea>${ib("mic", "Record voice note", "voice-record")}<button type="submit" class="send" aria-label="Send message">${icon("send")}</button></form><div class="composer-footer"><span>${icon("heart")} A little world. Just us.</span><span class="desktop-hint">Enter to send \xB7 Shift + Enter for a new line</span><span>${icon("lock")} Invitation only</span></div></div>`;
}
function messageSignature(m){
 const reply=messageLookup.get(m.reply_to);
 return JSON.stringify([m.body,!!m.deleted,m.edited_at,(m.photoPending||photoRecords.has(m.id))?m.pending:null,!!m.pending,!!m.failed,m.reply_to,reply?.body,reply?.deleted,photoRecords.get(m.id),S.favorites.has(m.id),reactionLookup.get(m.id)||[]]);
}
function logItems(){
 const all=visibleMessages(S.messages,S.cutoff),ms=S.older?all.slice(0,WINDOW_SIZE):all.slice(-WINDOW_SIZE);
 messageLookup=new Map([...replyContext,...S.messages.map(m=>[m.id,m])].filter(([id,m])=>!S.hidden?.has(id)&&(m.seq>S.cutoff||S.favorites.has(id)||!isConfirmed(m))));reactionLookup=new Map();
 for(const r of S.reactions){const list=reactionLookup.get(r.message_id)||[];list.push(r);reactionLookup.set(r.message_id,list)}
 const items=[];
 const add=(key,html)=>items.push({key,signature:html,html:()=>html});
 if(S.loading){add('skeleton-1','<div class="chat-skeleton" aria-hidden="true"><div class="skeleton-line" style="width:72%"></div><div class="skeleton-line" style="width:48%"></div></div>');add('skeleton-2','<div class="chat-skeleton own" aria-hidden="true"><div class="skeleton-line" style="width:64%"></div><div class="skeleton-line" style="width:38%"></div></div>');add('skeleton-3','<div class="chat-skeleton" aria-hidden="true"><div class="skeleton-line" style="width:58%"></div></div>');add('skeleton-status','<div class="page-skeleton" role="status"><span>Opening your conversation…</span></div>');return items}
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
  chatView?.pinViewport();
  autoScrollPending=true;
  requestAnimationFrame(() => {
    const el = $("#messages");
    if (el) el.scrollTop = el.scrollHeight;
    autoScrollPending=false;
  });
}
function updateMessages(force){
 const kept=$('.keepsake-count');if(kept)kept.textContent=S.favorites.size;
 if(S.page!=='chat'||document.hidden)return;
 if(renderFrame!==null)cancelAnimationFrame(renderFrame);
 renderFrame=requestAnimationFrame(()=>{renderFrame=null;
  const el=$('#messages');if(!el)return;
  const near=force??nearBottom(),top=el.scrollTop;
  const existing=new Map([...el.children].map(node=>[node.dataset.logKey,node]));
  const latestIds=new Set(S.messages.slice(-3).map(m=>'message-'+m.id));
  let cursor=el.firstChild,cascade=0;
  for(const item of logItems()){
   let node=existing.get(item.key);
   if(!node||renderSignatures.get(node)!==item.signature){
    const t=document.createElement('template');t.innerHTML=item.html();node=t.content.firstElementChild;
    node.dataset.logKey=item.key;renderSignatures.set(node,item.signature);
    if(!existing.has(item.key)&&latestIds.has(item.key)&&!S.older&&near&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
     chatView.enterMessage(node.querySelector('.message-main'),node.classList.contains('own'),cascade++*30);
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
  return S.reply || S.edit ? `<div class="reply-bar">${icon(S.edit ? "note" : "reply")}<div><b>${S.edit ? "Editing your message" : "Replying to " + esc(S.reply.sender === S.user.id ? "yourself" : S.partner?.name || "your person")}</b><span class="reply-preview-text">${esc((S.edit || S.reply).body.slice(0,110))}</span></div>${ib("close", "Cancel", "cancel-reply")}</div>` : "";
}
function beginReply(m){
 if(S.edit)draft=S.editDraft||'';S.reply=m;S.edit=null;closeModal();
 if(S.page!=='chat'){S.page='chat';render()}
 $('#reply-container').innerHTML=replyHTML();$('#message-input').value=draft;chatView.fitComposer($('#message-input'));
 $('#message-input').focus({preventScroll:true});
}
async function send() {
  let input = $("#message-input");
  let body = input.value.trim();
  if (!body) return;
  chatView?.sendPulse?.(input.form?.querySelector(".send .icon"));
  const wasOlder=S.older||loadingOlder,epoch=sessionEpoch;
  if (S.edit) {
    const edit=S.edit,mid=edit.id,epoch=sessionEpoch;if(edit.saving)return;edit.saving=true;
    try {
      if (!S.demo) {
        const { error } = await db.rpc("universe_change", { mid, content: body });
        if (error) throw error;
      }
      if(epoch!==sessionEpoch)return;
      const m2 = S.messages.find((x) => x.id === mid);
      if(m2){m2.body=body;m2.edited_at=new Date().toISOString()}
      if(S.edit===edit&&input.value.trim()===body){S.edit=null;draft=S.editDraft||'';S.editDraft=null;input.value=draft;chatView.fitComposer(input);$('#reply-container').innerHTML='';stash()}
      updateMessages();
    } catch {
      if(epoch===sessionEpoch)toast("Couldn\u2019t save that edit. Please try again.");
    }finally{edit.saving=false}
    return;
  }
  S.older=false;S.newMessages=false;
  const m = { id: crypto.randomUUID(), seq: Math.max(S.latestSeq||0, ...S.messages.map((x) => x.seq || 0)) + 1, sender: S.user.id, body, created_at: (/* @__PURE__ */ new Date()).toISOString(), reply_to: S.reply?.id || null, pending: true };
  S.messages.push(m);
  draft = "";
  flushStash();
  input.value = "";
  chatView.fitComposer(input);
  S.reply = null;
  $("#reply-container").innerHTML = "";
  updateMessages(true);
  const sending=transmit(m);
  if(wasOlder)showLatest().catch(()=>{if(epoch===sessionEpoch)toast('Your message is sending. Earlier messages will reload when the connection recovers.')});
  await sending;
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
    applyIncoming([{...data,transmitting:false}]);chatView.secretMessage(data,S.user.id);
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
async function messageMenu(m){await openDialog(()=>import('./dialogs.js'),v=>v.messageDialog(m,pageContext()))}

async function changeSettings() {
  if (S.demo) return;
  const { error } = await db.rpc("universe_profile", { display_name: S.me.name, presence: S.me.share_presence, selected_theme: theme });
  if (error) throw error;
}
function prepareDraft(text){draft=(draft?draft+'\n\n'+String(text):String(text)).slice(0,8000);S.page='chat';S.reply=S.edit=null;closeModal();render();stash();$('#message-input')?.focus({preventScroll:true});scrollBottom()}
async function action(a, el) {
  if(a!=='mobile-menu'&&a!=='ambient-mode'&&el.closest('.sidebar'))chatView?.closeNavigation();
 if(a.startsWith('space-'))a='page-'+a.slice(6);
 if(a==='ambient-mode'){const quiet=document.body.classList.toggle('quiet-sky');document.querySelectorAll('[data-action=ambient-mode]').forEach(b=>b.setAttribute('aria-pressed',String(quiet)));try{localStorage.setItem('universe-quiet-sky',String(quiet))}catch{}return}
 if(a==='wishing-star'){prepareDraft('A little wishing star for you ✨ Make a wish, my love.');return}
 if(a.startsWith('find-message-')){const id=a.slice(13);closeModal();if(S.page!=='chat'){S.page='chat';render()}requestAnimationFrame(()=>{const node=[...document.querySelectorAll('[data-message]')].find(el=>el.dataset.message===id);if(!node){toast('This moment is no longer in the loaded conversation.');return}node.scrollIntoView({block:'center',behavior:'instant'});node.classList.add('message-found');setTimeout(()=>node.classList.remove('message-found'),2200)});return}

 if(a==='voice-record'||a.startsWith('voice-play-')){
 if(S.demo){toast('Sign in to use private audio.');return}
 const epoch=sessionEpoch,request=++dialogRequest;voiceAPI??=await import('./voice.js');if(epoch!==sessionEpoch||request!==dialogRequest||!S.user)return;
 const ctx={db,S,modal,toast,close:closeModal,done:m=>{S.reply=null;$('#reply-container').innerHTML=replyHTML();applyIncoming([m]);updateMessages(true);closeModal()}};
 if(a==='voice-record')await voiceAPI.record(ctx);else await voiceAPI.play(a.slice(11),ctx);return;
 }

 if(['options','privacy','clear','emoji','search'].includes(a)){await openDialog(()=>import('./dialogs.js'),v=>v.dialogHTML(a,pageContext()));if(a==='search')$('#search-input')?.focus();return}

  if(a==='ritual-next'){const views=await secondaryPages();views.nextDate();const card=$('.date-card');if(card){card.outerHTML=views.dateCardHTML(pageContext());$('.date-card [data-action="ritual-next"]')?.focus({preventScroll:true})}return}
  if(a==='ritual-invite'){prepareDraft((await secondaryPages()).todayDate().invite);return}
  if(a==='little-notes'){await openDialog(secondaryPages,v=>`<h2>A little “thinking of you.”</h2><p>Choose a note to make your own. Nothing sends automatically.</p><div class="action-list">${v.notes().map((n,i)=>`<button class="note-draft" data-action="note-draft-${i}">${esc(n)}</button>`).join('')}</div>`);return}
  if(a.startsWith('note-draft-')){prepareDraft((await secondaryPages()).notes()[Number(a.slice(11))]);return}

  if(a==='attach-photo'){
   if(S.demo){toast('Sign in to share a private photo.');return}
   await openDialog(photos,()=>`<h2>A little moment, shared.</h2><p>Photos are compressed on your device before they leave it.</p><div class="action-list"><button data-action="photo-gallery">Choose from gallery</button><button data-action="photo-camera">Take a photo</button></div><input type="file" id="photo-gallery" accept="image/*" hidden><input type="file" id="photo-camera" accept="image/*" capture="environment" hidden>`);return;
  }
  if(a==='photo-gallery'||a==='photo-camera'){$('#'+a)?.click();return}
  if(a==='send-photo'){
   el.disabled=true;
   const caption=$('#photo-caption').value.trim(),api=await photos(),photo=api.peekPreview();
   const m={id:crypto.randomUUID(),seq:Math.max(0,...S.messages.map(m=>m.seq||0))+1,sender:S.user.id,body:'📷 '+(caption||'Photo'),created_at:new Date().toISOString(),reply_to:S.reply?.id||null,photoPending:true,pending:true};
   try{await api.saveDraft(S.user.id,m,photo)}catch(error){el.disabled=false;throw error}api.takePreview();try{localStorage.setItem('universe-photo-pending-'+S.user.id,'1')}catch{}
   photoRecords.set(m.id,{id:m.id,width:photo.width,height:photo.height});api.localThumb(m.id,photo.thumb);S.messages.push(m);S.reply=null;$('#reply-container').innerHTML='';closeModal();flushStash();updateMessages(true);await transmit(m);return;
  }
  if(a.startsWith('photo-view-')){const id=a.slice(11);if(!photoRecords.has(id)){const m=S.messages.find(m=>m.id===id);if(m)await loadPhotos([m])}const p=photoRecords.get(id);if(p?.sent){const api=await photos();dialogOpener=document.activeElement;$('#app').inert=true;chatView.watchClose('dialog',closeModal);await api.show(p,$('#modal-root'))}else toast('Photo not ready yet. Check your connection and tap again.');return}
  if(a==='retry-session'){el.disabled=true;try{if(resumeSession)await enter(resumeSession.session,resumeSession.welcome);else await restoreSession()}finally{el.disabled=false}return}
  if(a==='notifications'){
   if(S.demo){toast('Sign in to enable private notifications.');return}
   el.disabled=true;
   const epoch=sessionEpoch,userId=S.user.id;
   const permission='Notification'in window&&Notification.permission==='default'?Notification.requestPermission():null;
   try{const {manageNotifications}=await import('./notifications.js');if(epoch===sessionEpoch)await manageNotifications({db,userId,permissionRequest:permission,modal,valid:()=>epoch===sessionEpoch&&S.user?.id===userId})}
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
   if(signingOut)return;
   const wasDemo=S.demo,oldUser=S.user?.id??resumeSession?.session.user.id;
   const finish=!wasDemo&&oldUser?chatView.farewell():null;
   signingOut=true;
   try{
    if(locationAPI&&!wasDemo)await locationAPI.endSharing().catch(()=>{});
    setNotificationAccount(null);
    clearPrivateState();S.demo=false;login();
    if(!wasDemo&&oldUser)import('./notifications.js').then(({removeNotifications})=>removeNotifications(db,oldUser)).catch(()=>{});
    if(!wasDemo&&db){
     try{await db.auth.signOut({scope:'local'})}finally{
      authStorage.removeItem(AUTH_STORAGE_KEY);
      if(oldUser)chatView.rememberSignOut(oldUser);
     }
    }
   }finally{
    await finish?.();
    signingOut=false;
   }
   return;
  }
  if (a === "toggle-theme" || a.startsWith("theme-")) {
    setTheme(a === "toggle-theme" ? theme === "dark" ? "light" : "dark" : a.slice(6));
    if (S.user) {
      const epoch=sessionEpoch;
      try {
        await changeSettings();
      } catch {
        toast("Appearance changed on this device; account sync failed.");
      }
      if(epoch!==sessionEpoch||!S.user)return;
      const log=$('#messages'),position=log&&{top:log.scrollTop,bottom:nearBottom()};
      render();
      const restored=$('#messages');if(position&&restored)restored.scrollTop=position.bottom?restored.scrollHeight:position.top;
    } else login();
    return;
  }
  if (a === "mobile-menu") {
    chatView.toggleNavigation();
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
    if(S.page!=="chat")chatView.enterPanel($(".content-page"));
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
    S.me.share_presence = !S.me.share_presence;livePresence?.reconcile();
    try {
      await changeSettings();
      render();
    } catch {
      S.me.share_presence = !S.me.share_presence;livePresence?.reconcile();
      toast("Couldn\u2019t update privacy settings.");
    }
    return;
  }
  if (a === "motion-lite") {
    const lite = document.documentElement.dataset.motion !== "lite";
    if (lite) document.documentElement.dataset.motion = "lite";
    else document.documentElement.removeAttribute("data-motion");
    try { localStorage.setItem("universe-motion", lite ? "lite" : "full"); } catch {}
    render();
    return;
  }
  if (a === "cancel-reply") {
    if(S.edit)draft=S.editDraft||'';S.reply = S.edit = null;
    $("#message-input").value = draft;chatView.fitComposer($("#message-input"));
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
      if(!S.older)return;
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
    $("#message-input").value = draft;chatView.fitComposer($("#message-input"));
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
    S.page = "chat";if(!S.edit)S.editDraft=draft;
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
  if (!e.target.closest(".sidebar") && !e.target.closest('[data-action="mobile-menu"]')) chatView?.closeNavigation();
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
    $('#search-results').innerHTML=chatView.searchHTML(visibleMessages(S.messages,S.cutoff),e.target.value,pageContext());
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {closeModal();chatView?.closeNavigation(true)}
  if (e.key === "Tab" && $("#modal-root .modal,#modal-root .photo-lightbox,.sidebar.open")) {
    const els = chatView.dialogFocusables($('#modal-root .modal,#modal-root .photo-lightbox')||$('.sidebar.open'));
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
 if(document.hidden){flushStash();hiddenPause=setTimeout(()=>{if(document.hidden)stop(true)},30000)}
 else{clearTimeout(hiddenPause);if(!channel)startRealtime();else refresh()}
});
window.addEventListener('online',()=>{if(S.user&&!S.demo){if(!channel)startRealtime();refresh()}updateStatus()});
window.addEventListener('offline',updateStatus);
window.addEventListener('pagehide',flushStash);
window.addEventListener('pageshow',event=>{if(event.persisted&&S.user&&!S.demo){stop(true);startRealtime();refresh()}});
login();
// The public login and sample don't download or initialize the messaging SDK.
let hasSavedSession=false;for(const name of ['localStorage','sessionStorage'])try{hasSavedSession||=!!window[name].getItem(AUTH_STORAGE_KEY)}catch{}
if(hasSavedSession||location.hash.includes('access_token')||new URLSearchParams(location.search).has('code'))restoreSession();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').then(reg=>{
 const activate=()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed')worker.postMessage('SKIP_WAITING')});reg.waiting?.postMessage('SKIP_WAITING')};activate();reg.addEventListener('updatefound',activate);
}).catch(()=>{});
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',event=>{
 if(event.data?.type==='OPEN_CHAT'&&S.user&&!S.demo){S.page='chat';render();refresh();scrollBottom()}
});
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>setNotificationAccount(S.user&&!S.demo?S.user.id:null));



document.addEventListener('change',async event=>{
 if(!['photo-gallery','photo-camera'].includes(event.target.id)||!event.target.files?.[0])return;
 const file=event.target.files[0],epoch=sessionEpoch,selection=++photoSelection;
 modal('<h2>A little less data.</h2><p role="status">Preparing your photo on this device…</p>');
 try{const api=await photos();if(epoch!==sessionEpoch||selection!==photoSelection)return;const photo=await api.prepare(file);if(epoch!==sessionEpoch||selection!==photoSelection){api.cancelPreview();return}
  modal(`<h2>A moment for your person.</h2><img class="photo-preview" src="${photo.url}" alt="Photo preview"><p class="photo-detail">${Math.round(photo.originalBytes/1024)} KB → ${Math.round((photo.full.size+photo.thumb.size)/1024)} KB · ${photo.width} × ${photo.height}<br>Private. Compressed here. Original camera metadata removed.</p><label for="photo-caption">A little caption (optional)</label><input id="photo-caption" maxlength="1000" placeholder="Tell the story behind it…"><div class="modal-actions"><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="send-photo">Send photo ${icon('send')}</button></div>`);
 }catch(error){if(epoch===sessionEpoch&&selection===photoSelection&&$('#modal-root').children.length){closeModal();toast(error.message)}}
});
