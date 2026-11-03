// Every permission, decoder and send belongs to one dialog and one account.
// Closing it invalidates late async results before releasing the resources.
let current;
const formats=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'];
export function dispose(){const task=current;current=null;task?.release()}
function begin(ctx){
 dispose();const account=ctx.S?.user?.id,cleanups=[],timers=new Set(),urls=[];
 const task={stream:null,recorder:null,reader:null,audio:null,
  valid:()=>current===task&&ctx.S?.user?.id===account,
  later(fn,ms){const id=setTimeout(()=>{timers.delete(id);if(task.valid())fn()},ms);timers.add(id);return id},
  listen(target,event,fn){target.addEventListener(event,fn);cleanups.push(()=>target.removeEventListener(event,fn))},
  url(blob){const url=URL.createObjectURL(blob);urls.push(url);return url},
  release(){for(const id of timers)clearTimeout(id);for(const clean of cleanups)clean();
   if(task.reader?.readyState===1)task.reader.abort();
   if(task.recorder){task.recorder.onstop=task.recorder.ondataavailable=task.recorder.onerror=null;if(task.recorder.state!=='inactive')task.recorder.stop()}
   task.stream?.getTracks().forEach(track=>track.stop());
   if(task.audio){task.audio.pause();task.audio.removeAttribute('src');task.audio.load()}
   for(const url of urls)URL.revokeObjectURL(url);
  }
 };current=task;return task;
}
const message=error=>error?.name==='NotAllowedError'?'Microphone access is blocked. Allow it in your browser’s site settings, then try again.':error?.name==='NotFoundError'?'No microphone was found. Connect one, then try again.':error?.message||'Something interrupted your voice note. Please try again.';
function cancelButton(ctx,task){const button=document.querySelector('#voice-cancel');if(button)button.onclick=()=>{if(button.isConnected){if(current===task)dispose();ctx.close?.()}}}
export async function record(ctx){
 const {modal,db,S,done}=ctx,task=begin(ctx),reply=S.reply?.id||null;
 modal('<div class="voice-heading" aria-hidden="true">♡</div><h2>A little voice, just for you.</h2><p>Up to one minute. Your note disappears after 48 hours.</p><p id="voice-status" class="voice-status" role="status">Waiting for microphone…</p><div id="voice-controls"></div><button class="text-btn" id="voice-cancel">Cancel</button>');
 cancelButton(ctx,task);const status=document.querySelector('#voice-status'),controls=document.querySelector('#voice-controls');
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Voice recording is not supported in this browser.');
  const mime=formats.find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('No supported recording format.');
  const acquired=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
  if(!task.valid()){acquired.getTracks().forEach(track=>track.stop());return}task.stream=acquired;
  if(document.hidden){acquired.getTracks().forEach(track=>track.stop());status.textContent='Return to this tab, then try recording again.';controls.innerHTML='<button class="secondary" id="voice-again">Try again</button>';document.querySelector('#voice-again').onclick=()=>record(ctx);return}
  const chunks=[];let bytes=0,stopped=false;const started=performance.now();
  const recorder=task.recorder=new MediaRecorder(acquired,{mimeType:mime,audioBitsPerSecond:24000});
  const stop=()=>{if(task.valid()&&recorder.state==='recording'){stopped=true;recorder.stop();acquired.getTracks().forEach(track=>track.stop())}};
  recorder.ondataavailable=event=>{if(!task.valid())return;if(event.data.size){chunks.push(event.data);bytes+=event.data.size;if(bytes>=175000)stop()}};
  recorder.onerror=()=>{if(!task.valid())return;stopped=true;recorder.onstop=null;stop();acquired.getTracks().forEach(track=>track.stop());status.textContent='Recording was interrupted. Please record your note again.';controls.innerHTML='<button class="secondary" id="voice-again">Try again</button>';document.querySelector('#voice-again').onclick=()=>record(ctx)};
  recorder.onstop=()=>{
   acquired.getTracks().forEach(track=>track.stop());if(!task.valid())return;
   stopped=true;const blob=new Blob(chunks,{type:mime}),seconds=Math.max(1,Math.round((performance.now()-started)/1000));
   if(!blob.size||blob.size>195000){status.textContent=blob.size?'This note is too large. Try a shorter recording.':'No audio was recorded. Please try again.';controls.innerHTML='<button class="secondary" id="voice-again">Record again</button>';document.querySelector('#voice-again').onclick=()=>record(ctx);return}
   status.textContent=`Ready to share · ${seconds}s · ${Math.ceil(blob.size/1024)} KB`;
   controls.innerHTML='<audio controls preload="metadata" aria-label="Preview your voice note"></audio><div class="voice-actions"><button class="secondary" id="voice-again">Record again</button><button class="primary" id="voice-send">Send voice note ♡</button></div><p role="status" id="voice-send-status"></p>';
   task.audio=controls.querySelector('audio');task.audio.src=task.url(blob);
   const send=document.querySelector('#voice-send'),again=document.querySelector('#voice-again'),sendStatus=document.querySelector('#voice-send-status'),id=crypto.randomUUID();
   again.onclick=()=>record(ctx);
   send.onclick=async()=>{
    if(!task.valid()||send.disabled)return;send.disabled=again.disabled=true;send.textContent='Sending…';sendStatus.textContent='Sending securely. Closing this window won’t recall a note already sent.';
    try{
     const encoded=await new Promise((resolve,reject)=>{const reader=task.reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.onabort=()=>reject(Error('Cancelled'));reader.readAsDataURL(blob)});
     if(!task.valid())return;
     const {data,error}=await db.rpc('universe_send_voice',{mid:id,mime_type:mime,encoded,reply});
     if(!task.valid())return;if(error)throw error;done(data);if(task.valid())dispose();
    }catch(error){if(!task.valid())return;sendStatus.textContent=message(error);send.disabled=again.disabled=false;send.textContent='Retry sending'}
   };
  };
  recorder.start(1000);status.innerHTML='Recording. Tap Stop when you’re ready.<span id="voice-timer" aria-hidden="true">0:00 <small>/ 1:00</small></span>';controls.innerHTML='<span class="voice-recording-dot" aria-hidden="true"></span><button class="secondary" id="voice-stop">Stop recording</button>';document.querySelector('#voice-stop').onclick=stop;
  const clock=document.querySelector('#voice-timer');
  const tick=()=>{if(stopped)return;const seconds=Math.min(60,Math.floor((performance.now()-started)/1000));clock.innerHTML=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} <small>/ 1:00</small>`;if(seconds>=60)stop();else task.later(tick,1000)};task.later(tick,1000);
  task.listen(document,'visibilitychange',()=>{if(document.hidden)stop()});
 }catch(error){if(!task.valid())return;task.stream?.getTracks().forEach(track=>track.stop());status.textContent=message(error);controls.innerHTML='<button class="secondary" id="voice-again">Try again</button>';document.querySelector('#voice-again').onclick=()=>record(ctx)}
}
export async function play(id,ctx){
 const {db,modal}=ctx,task=begin(ctx);
 modal('<div class="voice-heading" aria-hidden="true">♡</div><h2>A familiar voice.</h2><p id="voice-status" class="voice-status" role="status">Opening your private voice note…</p><div id="voice-controls"></div><button class="text-btn" id="voice-cancel">Close</button>');cancelButton(ctx,task);
 const status=document.querySelector('#voice-status');
 try{
  const {data,error}=await db.from('universe_voice').select('audio,mime,expires_at').eq('id',id).maybeSingle();
  if(!task.valid())return;if(error)throw error;
  const expiry=Date.parse(data?.expires_at);if(!data||!Number.isFinite(expiry)||expiry<=Date.now())throw Error('This recording has expired or is unavailable.');
  if(!formats.includes(data.mime)||typeof data.audio!=='string'||data.audio.length>260000)throw Error('This recording could not be opened.');
  const bytes=Uint8Array.from(atob(data.audio),char=>char.charCodeAt(0)),controls=document.querySelector('#voice-controls');
  controls.innerHTML='<audio id="voice-playback" controls preload="metadata" aria-label="Play voice note"></audio>';
  const audio=task.audio=controls.querySelector('audio');audio.src=task.url(new Blob([bytes],{type:data.mime}));status.textContent='A little piece of their voice. Available for 48 hours after sending.';
  const expire=()=>{if(task.valid()&&Date.now()>=expiry){dispose();status.textContent='This voice note has now expired.';controls.replaceChildren()}};
  task.listen(audio,'play',expire);task.listen(document,'visibilitychange',expire);task.later(expire,Math.max(0,expiry-Date.now()));
  await audio.play().catch(()=>{});
 }catch(error){if(!task.valid())return;status.textContent=message(error);document.querySelector('#voice-controls').innerHTML='<button class="secondary" id="voice-retry">Try again</button>';document.querySelector('#voice-retry').onclick=()=>play(id,ctx)}
}
