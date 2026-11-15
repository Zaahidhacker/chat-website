export function notificationSupport(){
 if(window.isSecureContext===false)return 'Notifications need a secure HTTPS connection. Open the HTTPS address of this website.';
 if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))return /iPad|iPhone|iPod/.test(navigator.userAgent||'')?'On iPhone or iPad, use Safari → Share → Add to Home Screen, then open the installed app and enable notifications here (iOS 16.4 or newer).':'This browser doesn’t support push notifications. Try an updated Chrome, Edge, Firefox, or Safari. On iPhone, add this site to your Home Screen first.';
 return '';
}
function supported(){return !notificationSupport()}
function keyBytes(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
async function registration(){
 const reg=await navigator.serviceWorker.register('/sw.js');
 await reg.update();
 const pending=reg.installing||reg.waiting;
 if(pending){
  if(pending.state==='installed')pending.postMessage('SKIP_WAITING');
  await new Promise((resolve,reject)=>{
   const done=(error)=>{clearTimeout(timeout);pending.removeEventListener('statechange',changed);error?reject(error):resolve()};
   const timeout=setTimeout(()=>done(Error('Notification setup is taking a moment. Please try again.')),15000);
   const changed=()=>{if(pending.state==='installed')pending.postMessage('SKIP_WAITING');if(pending.state==='activated'){done()}if(pending.state==='redundant'){done(Error('Please reload and try notification setup again.'))}};
   pending.addEventListener('statechange',changed);changed();
  });
 }
 return navigator.serviceWorker.ready;
}
export async function removeNotifications(db,userId){
 if(!supported())return;
 const reg=await registration(),sub=await reg.pushManager.getSubscription();
 reg.active?.postMessage({type:'ACCOUNT',userId:null});
 if(sub){
  // Revoke this browser endpoint even if the database is temporarily unreachable.
  const endpoint=sub.endpoint;await sub.unsubscribe();
  if(db&&userId)await db.from('universe_push_subscriptions').delete().eq('user_id',userId).eq('endpoint',endpoint);
 }
}
export async function toggleNotifications(db,userId,permissionRequest,valid=()=>true){
 if(!supported())return notificationSupport();
 // Permission must be requested directly from this user gesture, before network awaits.
 const permission=await (permissionRequest??(['granted','denied'].includes(Notification.permission)?Notification.permission:Notification.requestPermission()));
 if(permission!=='granted')return permission==='denied'?'Notifications are blocked. Allow them in this site’s browser settings to enable them.':'Notifications stay off until you choose to allow them.';
 if(!valid())return '';
 const reg=await registration();
 const current=await reg.pushManager.getSubscription();
 const {data:key,error}=await db.rpc('universe_push_key');
 if(error)throw error;
 if(!key)throw Error('Phone notifications are not configured yet. Please try again later.');
 if(!valid())return '';
 const sub=current||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key)});
 if(!valid()){if(!current)await sub.unsubscribe();return ''}
 const {error:saveError}=await db.rpc('universe_push_register',{sub:sub.toJSON()});
 if(saveError){if(!current)await sub.unsubscribe();throw saveError}
 if(!valid()){await sub.unsubscribe();return ''}
 reg.active?.postMessage({type:'ACCOUNT',userId});
 return 'Phone notifications are on. Message text stays private.';
}

export async function manageNotifications({db,userId,permissionRequest,modal,valid=()=>true}){
 modal('<h2>Notifications on this device</h2><p id="notification-status" role="status">Checking browser permission…</p><p>Message previews stay private. Incoming calls can play a ringtone. Outgoing calls stay quiet.</p><div class="action-list"><button class="primary" id="notification-enable">Enable notifications</button><button class="secondary" id="notification-disable" hidden>Turn off on this device</button><button class="secondary" id="notification-test" hidden>Send a test notification</button></div><p>Already blocked? Open your browser’s site settings and allow notifications, then try again. On iPhone, open this site from your Home Screen.</p>');
 const status=document.querySelector('#notification-status'),enable=document.querySelector('#notification-enable'),disable=document.querySelector('#notification-disable'),test=document.querySelector('#notification-test');
 const alive=()=>valid()&&status.isConnected;
 const busy=value=>{enable.disabled=disable.disabled=test.disabled=value};
 const update=async(request)=>{
  if(!alive())return;busy(true);status.textContent='Setting up notifications…';
  try{const message=await toggleNotifications(db,userId,request,valid);if(!alive())return;status.textContent=message;const enabled=message.includes('are on');disable.hidden=test.hidden=!enabled;enable.hidden=enabled}
  catch(error){if(alive())status.textContent=error.message||'Could not enable notifications. Check your connection and try again.'}
  finally{if(alive())busy(false)}
 };
 // The permission request starts synchronously inside the button's click handler.
 enable.onclick=()=>{let request;try{request=supported()?Notification.requestPermission():null}catch(error){status.textContent=error.message;return}update(request)};
 disable.onclick=async()=>{busy(true);try{await removeNotifications(db,userId);if(alive()){status.textContent='Notifications are off on this device.';disable.hidden=test.hidden=true;enable.hidden=false}}catch{if(alive())status.textContent='Could not turn notifications off. Please try again.'}finally{if(alive())busy(false)}};
 test.onclick=async()=>{busy(true);try{const reg=await registration();if(!alive())return;await reg.showNotification('Our Little Universe',{body:'Notifications are working on this device.',icon:'/icon-192.png',silent:true,tag:'universe-test'});status.textContent='Test notification sent silently. If it is hidden, check your device’s notification settings.'}catch(error){if(alive())status.textContent=error.message}finally{if(alive())busy(false)}};
 await update(permissionRequest);
}
