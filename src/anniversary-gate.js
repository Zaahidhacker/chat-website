let stop;
export function stopAnniversary(){stop?.();stop=null}
export async function anniversaryGate(db,S,onReturn){
 stopAnniversary();if(!S.user||S.demo)return;const uid=S.user.id;
 let alive=true,timer,story,checking=false,shown=false;
 function dispose(){alive=false;clearTimeout(timer);story?.dispose();delete S.anniversaryPending;document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('focus',wake)}
 stop=dispose;
 async function check(){if(!alive||checking||document.hidden)return;checking=true;try{const r=await db.rpc('anniversary_2026_status');if(r.error||!r.data)throw Error('Unavailable');if(!alive||S.user?.id!==uid)return;const status=r.data;const wait=Math.max(0,Date.parse(status.release_at)-Date.parse(status.server_now));clearTimeout(timer);
 if(status.slot===1||status.available){if(!story){const m=await import('./anniversary.js');if(!alive)return;story=m.anniversary(db,S,onReturn,status,()=>{shown=true;S.anniversaryPending=false})}else story.update(status);S.anniversaryPending=status.slot===2&&!status.progress?.completed;if(S.anniversaryPending&&!shown){shown=true;timer=setTimeout(()=>{if(alive&&!document.hidden)story.open(false);else shown=false},3000)}}
 if(!status.available)timer=setTimeout(check,Math.min(2147483000,Math.max(250,wait+150)));
 }catch{if(alive)timer=setTimeout(check,30000)}finally{checking=false}}
 function wake(){if(!document.hidden){check()}}
 document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);window.addEventListener('focus',wake);await check();
}
