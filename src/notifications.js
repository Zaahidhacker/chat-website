function supported(){return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window}
function keyBytes(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
async function registration(){
 const reg=await navigator.serviceWorker.register('/sw.js');
 await reg.update();
 const pending=reg.installing||reg.waiting;
 if(pending){
  if(pending.state==='installed')pending.postMessage('SKIP_WAITING');
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Notification setup is taking a moment. Please try again.')),15000);
   const changed=()=>{if(pending.state==='installed')pending.postMessage('SKIP_WAITING');if(pending.state==='activated'){clearTimeout(timeout);resolve()}if(pending.state==='redundant'){clearTimeout(timeout);reject(Error('Please reload and try notification setup again.'))}};
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
export async function toggleNotifications(db,userId,permissionRequest){
 if(!supported())return 'This browser doesn’t support push. On iPhone, add this site to your Home Screen and open it there (iOS 16.4 or newer).';
 // Permission must be requested directly from this user gesture, before network awaits.
 const permission=await (permissionRequest||Notification.requestPermission());
 if(permission!=='granted')return permission==='denied'?'Notifications are blocked. Allow them in this site’s browser settings to enable them.':'Notifications stay off until you choose to allow them.';
 const reg=await registration();
 const current=await reg.pushManager.getSubscription();
 if(current){
  // Explicit choice; merely inspecting settings must not disable push.
  if(!window.confirm('Phone notifications are enabled on this browser. Turn them off?'))return 'Phone notifications are enabled.';
  await removeNotifications(db,userId);return 'Phone notifications are off on this device.';
 }
 const {data:key,error}=await db.rpc('universe_push_key');
 if(error)throw error;
 if(!key)throw Error('Phone notifications are not configured yet. Please try again later.');
 const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key)});
 const {error:saveError}=await db.rpc('universe_push_register',{sub:sub.toJSON()});
 if(saveError){await sub.unsubscribe();throw saveError}
 reg.active?.postMessage({type:'ACCOUNT',userId});
 return 'Phone notifications are on. Message text stays private.';
}
