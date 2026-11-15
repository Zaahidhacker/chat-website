const active=row=>row&&['calling','accepted'].includes(row.state)&&Date.parse(row.expires_at)>Date.now();
export function callLabel(row,userId,now=Date.now()){
 if(!row)return '';
 if(!['calling','accepted'].includes(row.state))return {ended:'Call ended',declined:'Call declined',missed:'No answer'}[row.state]||'Call ended';
 if(Date.parse(row.expires_at)<=now)return row.state==='accepted'?'Call disconnected':'No answer';
 if(row.state==='accepted')return 'Connecting…';
 if(row.recipient===userId)return 'Incoming voice call';
 return Date.parse(row.ring_until)>now?'Ringing':'Calling';
}
const errorText=error=>error?.name==='NotAllowedError'?'Microphone access is blocked. Allow it in this site’s browser settings and try again.':error?.name==='NotFoundError'?'No microphone found. Connect one and try again.':error?.message||'The call could not connect. Please try again.';

// Only the recipient's unanswered invitation can run this oscillator. Outgoing
// calls never start a tone. Push notifications cover suspended browser pages.
export function createIncomingRingtone(){
 let context,timer,wanted=false,closed=false;const gains=new Set();
 function tone(){
  if(!wanted||closed||context?.state!=='running')return;
  const start=context.currentTime,gain=context.createGain();gains.add(gain);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.075,start+.04);gain.gain.setValueAtTime(.075,start+.65);gain.gain.linearRampToValueAtTime(0,start+.75);gain.connect(context.destination);
  for(const frequency of [440,480]){const oscillator=context.createOscillator();oscillator.frequency.value=frequency;oscillator.connect(gain);oscillator.start(start);oscillator.stop(start+.8);oscillator.onended=()=>oscillator.disconnect()}
  setTimeout(()=>{gain.disconnect();gains.delete(gain)},900);
 }
 async function unlock(){
  if(closed)return false;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;context??=new Audio();await context.resume();if(wanted)tone();return context.state==='running'}catch{return false}
 }
 const gesture=()=>{if(!context||context.state!=='running')unlock()};
 document.addEventListener('pointerdown',gesture);document.addEventListener('keydown',gesture);
 return {unlock,set(incoming){if(wanted===incoming)return;wanted=incoming;clearInterval(timer);if(incoming){if(context&&context.state!=='running')context.resume().then(tone).catch(()=>{});else tone();timer=setInterval(tone,3000)}else{for(const gain of gains)gain.disconnect();gains.clear()}},available:()=>context?.state==='running',close(){closed=true;wanted=false;clearInterval(timer);document.removeEventListener('pointerdown',gesture);document.removeEventListener('keydown',gesture);context?.close().catch(()=>{})}};
}

export function createCalls(db,{userId,partnerName,toast}){
 const device=crypto.randomUUID(),ringtone=createIncomingRingtone();
 let closed=false,row=null,task=null,note='',busy=false,syncing=false,resync=false,room,pollAt=0,touchAt=0,ackHidden=null,collapsed=false,connectedAt=0,renderKey='';
 const root=document.createElement('section');root.className='call-panel';root.setAttribute('aria-label','Voice call');root.hidden=true;document.body.append(root);
 const audio=document.createElement('audio');audio.setAttribute('playsinline','');audio.hidden=true;document.body.append(audio);
 const owned=c=>c&&(c.caller===userId?c.caller_device===device:c.recipient_device===device);
 const valid=t=>!closed&&task===t&&!t.cancelled;
 const rpc=async(name,params)=>{const {data,error}=await db.rpc(name,params);if(error)throw error;return data};
 const update=(action,sdp=null,id=row?.id)=>rpc('universe_call_update',{mid:id,device,action,sdp});
 function release(){
  const old=task;task=null;if(old){old.cancelled=true;clearTimeout(old.disconnected);clearTimeout(old.connectTimer);old.pc?.close();old.stream?.getTracks().forEach(t=>t.stop())}
  audio.pause();audio.srcObject=null;connectedAt=0;busy=false;ringtone.set(false);
 }
 function render(){
  if(closed)return;
  const incoming=active(row)&&row.state==='calling'&&row.recipient===userId&&!task;
  ringtone.set(incoming);
  root.hidden=!row&&!note&&!task;
  root.classList.toggle('is-collapsed',collapsed);
  const label=note||(busy&&task?'Preparing voice call…':!row?'Opening microphone…':task?.pc?.connectionState==='connected'?'Connected':callLabel(row,userId));
  const seconds=connectedAt?Math.floor((Date.now()-connectedAt)/1000):0;
  const muted=!!task?.stream?.getAudioTracks().every(t=>!t.enabled);
  const key=JSON.stringify([!!row,!!task,incoming,collapsed,busy,row?.state,owned(row),task?.pc?.connectionState,muted,!!task?.needsAudio,ringtone.available()]);
  if(key===renderKey){root.querySelector('.call-state').textContent=label+(connectedAt?` · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'');return}renderKey=key;
  root.innerHTML=`<div class="call-panel-heading"><strong>${incoming?'Incoming call':row?.caller===userId?'Voice call':'Your call'}</strong><button type="button" class="text-btn" data-call="collapse" aria-label="${collapsed?'Expand call controls':'Minimize call controls'}">${collapsed?'Open':'−'}</button></div><p class="call-person"></p><p class="call-state" role="status"></p><div class="call-controls" ${collapsed?'hidden':''}></div>`;
  root.querySelector('.call-person').textContent=partnerName()||'Your person';
  root.querySelector('.call-state').textContent=label+(connectedAt?` · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'');
  const controls=root.querySelector('.call-controls');
  const button=(text,action,primary=false,disabled=false)=>{const b=document.createElement('button');b.type='button';b.className=primary?'primary':'secondary';b.dataset.call=action;b.textContent=text;b.disabled=disabled;controls.append(b);return b};
  if(incoming){button('Accept','accept',true,busy);button('Decline','decline',false,busy);if(!ringtone.available())button('Enable incoming ringtone','sound')}
  else if(task||active(row)&&owned(row)){if(task?.pc?.connectionState==='connected'){const muted=task.stream?.getAudioTracks().every(t=>!t.enabled);const b=button(muted?'Unmute microphone':'Mute microphone','mute');b.setAttribute('aria-pressed',String(!!muted));if(task.needsAudio)button('Hear call','audio',true)}button(row?.state==='calling'?'Cancel call':'End call','end')}
  else if(active(row)){const p=document.createElement('p');p.textContent='This call is open on another tab or device.';controls.append(p)}
  else button('Dismiss','dismiss');
 }
 function finish(message){const id=row?.id||task?.id;release();row=null;note=message;collapsed=false;render();closeNotification(id)}
 function closeNotification(id){navigator.serviceWorker?.ready.then(reg=>reg.active?.postMessage({type:'CLOSE_CALL',callId:id||row?.id,userId})).catch(()=>{})}
 async function playAudio(t){if(!valid(t))return;try{await audio.play();if(valid(t))t.needsAudio=false}catch{if(valid(t))t.needsAudio=true}if(valid(t))render()}
 async function microphone(t){
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw Error('Voice calls need an updated browser with microphone access over HTTPS.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false});
  if(!valid(t)){stream.getTracks().forEach(track=>track.stop());return false}t.stream=stream;return true;
 }
 async function peer(t){
  const config=await rpc('universe_call_ice',{});if(!valid(t))return false;t.relay=!!config?.relayConfigured;
  const pc=t.pc=new RTCPeerConnection({iceServers:config.iceServers,iceCandidatePoolSize:0});
  for(const track of t.stream.getTracks())pc.addTrack(track,t.stream);
  pc.onicecandidate=event=>{if(!valid(t)||!event.candidate)return;t.out.push(event.candidate.toJSON());flushCandidates(t)};
  pc.ontrack=event=>{if(!valid(t))return;audio.srcObject=event.streams[0]||new MediaStream([event.track]);playAudio(t)};
  pc.onconnectionstatechange=()=>{
   if(!valid(t))return;clearTimeout(t.disconnected);
   if(pc.connectionState==='connected'){clearTimeout(t.connectTimer);connectedAt||=Date.now();note='';render()}
   else if(pc.connectionState==='failed'){sync();t.disconnected=setTimeout(()=>fail(t,Error(t.relay?'The audio connection failed. Check both connections and try again.':'The audio connection failed. This network may need a TURN relay. Try another network.')),1000)}
   else if(pc.connectionState==='disconnected'){note='Reconnecting…';render();t.disconnected=setTimeout(()=>{if(valid(t))fail(t,Error('The call lost its connection. Please call again.'))},15000)}
  };
  return true;
 }
 function newTask(id){release();note='';collapsed=false;const t={id,out:[],seen:new Set(),remote:[],cancelled:false,sending:false,ready:false};task=t;busy=true;render();return t}
 async function flushCandidates(t){
  if(!valid(t)||!t.ready||t.sending)return;t.sending=true;
  try{while(valid(t)&&t.out.length){await rpc('universe_call_signal',{mid:t.id,device,candidate:t.out[0]});t.out.shift()}}
  catch{if(valid(t))t.retryCandidates=true}finally{t.sending=false}
 }
 async function addCandidates(t,list){
  for(const signal of list){if(!valid(t))return;if(signal.call_id!==t.id||signal.sender===userId||t.seen.has(signal.id)||!signal.payload?.candidate)continue;t.seen.add(signal.id);t.remote.push(signal.payload.candidate)}
  if(!t.pc?.remoteDescription)return;
  while(valid(t)&&t.remote.length){const candidate=t.remote.shift();try{await t.pc.addIceCandidate(candidate)}catch{if(valid(t))throw Error('The audio connection information could not be read. Please call again.')}}
 }
 async function replay(t){
  const {data,error}=await db.from('universe_call_signals').select('*').eq('call_id',t.id).order('id',{ascending:true});if(error)throw error;if(valid(t))await addCandidates(t,data||[]);
 }
 async function fail(t,error){if(!valid(t))return;const id=t.id;finish(errorText(error));update('end',null,id).catch(()=>{})}
 async function apply(next){
  if(closed||!next)return;
  if(row?.id===next.id&&Date.parse(next.updated_at)<Date.parse(row.updated_at))return;
  if(!active(next)){
   if(row?.id===next.id||task?.id===next.id)finish(callLabel(next,userId));return;
  }
  if(row&&row.id!==next.id&&active(row))return;
  const previous=row;row=next;if(!previous||previous.id!==row.id||previous.state!==row.state){note='';touchAt=0;ackHidden=null}
  if(task&&task.id===row.id&&row.state==='accepted'){
   if(!owned(row)){finish('This call was answered on another device.');return}
   const t=task;
   if(!t.connectTimer&&t.pc?.connectionState!=='connected')t.connectTimer=setTimeout(()=>{if(valid(t)&&t.pc.connectionState!=='connected')fail(t,Error(t.relay?'The audio connection timed out. Check your connection and call again.':'The audio connection timed out. This network may need a TURN relay. Try another network.'))},25000);
   if(row.caller===userId&&row.answer&&!t.pc.remoteDescription&&!t.settingAnswer){t.settingAnswer=true;try{await t.pc.setRemoteDescription(row.answer);if(valid(t))await replay(t)}catch(error){fail(t,error)}finally{t.settingAnswer=false}}
   closeNotification(row.id);
  }
  if(row.state==='accepted'&&row.recipient===userId&&!owned(row))ringtone.set(false);
  render();
 }
 async function sync(){
  if(closed||!navigator.onLine)return;if(syncing){resync=true;return}syncing=true;pollAt=Date.now();
  try{
   let q=db.from('universe_calls').select('*');
   q=row?q.eq('id',row.id):q.in('state',['calling','accepted']).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1);
   const {data,error}=await q.maybeSingle();if(error)throw error;if(closed)return;
   if(data)await apply(data);
   if(task?.ready){const t=task;flushCandidates(t);await replay(t)}
  }catch{if(task&&!closed&&Date.now()-pollAt>30000){note='Reconnecting…';render()}}
  finally{syncing=false;if(resync&&!closed){resync=false;queueMicrotask(sync)}}
 }
 async function start(){
  if(closed||task||active(row)){collapsed=false;render();return}
  const t=newTask(crypto.randomUUID());
  try{
   if(!await microphone(t)||!await peer(t))return;
   await t.pc.setLocalDescription(await t.pc.createOffer());if(!valid(t))return;
   const created=await rpc('universe_call_start',{mid:t.id,device,sdp:t.pc.localDescription.toJSON()});
   if(!valid(t)){update('end',null,t.id).catch(()=>{});return}
   t.ready=true;busy=false;await apply(created);flushCandidates(t);pollAt=0;
  }catch(error){if(valid(t))fail(t,error)}
 }
 async function accept(){
  if(!active(row)||row.recipient!==userId||row.state!=='calling'||busy)return;
  const invitation=row,t=newTask(row.id);ringtone.set(false);
  try{
   if(!await microphone(t)||!await peer(t))return;
   await t.pc.setRemoteDescription(invitation.offer);if(!valid(t))return;
   await t.pc.setLocalDescription(await t.pc.createAnswer());if(!valid(t))return;
   const accepted=await update('accept',t.pc.localDescription.toJSON(),t.id);
   if(!valid(t)){if(accepted.recipient_device===device)update('end',null,t.id).catch(()=>{});return}
   if(!active(accepted)||accepted.state!=='accepted'||accepted.recipient_device!==device){finish('This call is no longer available or was answered elsewhere.');return}
   t.ready=true;busy=false;await apply(accepted);flushCandidates(t);await replay(t);
  }catch(error){if(valid(t)){release();note=errorText(error);render();sync()}}
 }
 async function end(){const id=task?.id||row?.id,persisted=!!row||task?.ready;finish('Call ended');if(!id||!persisted)return;try{await update('end',null,id)}catch{toast('Connection interrupted. The call will expire automatically.')}}
 async function decline(){if(!row||busy)return;busy=true;render();try{const result=await update('decline');await apply(result)}catch(error){note=errorText(error);busy=false;render()}}
 async function sound(){const enabled=await ringtone.unlock();toast(enabled?'Incoming ringtone enabled on this page. Outgoing calls stay quiet.':'Your browser could not enable the ringtone. Check sound settings.');render()}
 root.onclick=event=>{const action=event.target.closest('[data-call]')?.dataset.call;if(!action)return;
  if(action==='accept')accept();if(action==='decline')decline();if(action==='end')end();if(action==='sound')sound();
  if(action==='mute'&&task){const tracks=task.stream.getAudioTracks(),enabled=tracks.every(t=>!t.enabled);tracks.forEach(t=>t.enabled=enabled);render()}
  if(action==='audio'&&task)playAudio(task);
  if(action==='dismiss'){note='';row=null;render()}
  if(action==='collapse'){collapsed=!collapsed;render()}
 };
 async function touch(){
  if(closed||!active(row))return;
  const hidden=document.hidden,now=Date.now();
  const action=row.state==='calling'&&row.recipient===userId?(hidden?'away':'ring'):row.state==='accepted'&&task&&owned(row)?'heartbeat':null;
  if(!action||now-touchAt<15000&&ackHidden===hidden)return;touchAt=now;ackHidden=hidden;
  try{await apply(await update(action))}catch{/* Reconnect/poll recovers state. */}
 }
 const wake=()=>{if(!document.hidden)sync();touch()};
 const pagehide=()=>{if(task)end();else if(row?.recipient===userId&&row.state==='calling')update('away').catch(()=>{})};
 document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);window.addEventListener('pagehide',pagehide);
 room=db.channel('universe-calls:'+device).on('postgres_changes',{event:'*',schema:'public',table:'universe_calls'},()=>sync()).on('postgres_changes',{event:'INSERT',schema:'public',table:'universe_call_signals',filter:'recipient=eq.'+userId},event=>{const t=task;if(t)addCandidates(t,[event.new]).catch(error=>fail(t,error))}).subscribe(status=>{if(status==='SUBSCRIBED')sync()});
 const clock=setInterval(()=>{
  if(closed)return;
  if(row&&!active(row)){const id=row.id;finish(callLabel(row,userId));closeNotification(id);return}
  touch();if(task||row)render();
  const interval=task||row?4000:30000;if(Date.now()-pollAt>interval&&(!document.hidden||row||task))sync();
 },1000);
 sync();
 return {start,sound,sync,open(){collapsed=false;sync();render()},close(){if(closed)return Promise.resolve();const id=task?.id,recipient=row?.recipient===userId;closed=true;release();clearInterval(clock);document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('pagehide',pagehide);db.removeChannel(room);ringtone.close();root.remove();audio.remove();closeNotification(row?.id);return (id?update('end',null,id):recipient&&row.state==='calling'?update('away'):Promise.resolve()).catch(()=>{})}};
}
