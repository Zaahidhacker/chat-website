import {ANNIVERSARY_SONG} from './anniversary-content.js';
export function anniversaryAudio(report){
 const media=new Audio();media.src=ANNIVERSARY_SONG;media.preload='none';media.loop=true;
 let disposed=false,fadeTimer,muted=false;try{muted=localStorage.getItem('anniversary-muted')==='true'}catch{}
 media.muted=muted;
 const state=()=>report({playing:!media.paused&&!media.muted,muted,blocked:false,failed:!!media.error});
 function fade(to){clearInterval(fadeTimer);const from=media.volume,start=performance.now();fadeTimer=setInterval(()=>{if(disposed){clearInterval(fadeTimer);return}const p=Math.min(1,(performance.now()-start)/1000);media.volume=from+(to-from)*p;if(p===1)clearInterval(fadeTimer)},50)}
 media.onplaying=state;media.onpause=state;media.onerror=()=>{if(!disposed)report({playing:false,muted,blocked:false,failed:true})};
 async function play(){if(disposed)return;media.volume=0;try{await media.play();if(disposed){media.pause();return}fade(.3);state()}catch(e){if(!disposed)report({playing:false,muted,blocked:e.name==='NotAllowedError',failed:e.name!=='NotAllowedError'})}}
 return {play,toggle(){if(media.paused&&!muted){play();return}muted=!muted;media.muted=muted;try{localStorage.setItem('anniversary-muted',String(muted))}catch{}if(!muted)play();else state()},pause(){clearInterval(fadeTimer);media.pause()},dispose(){disposed=true;clearInterval(fadeTimer);media.onplaying=media.onpause=media.onerror=null;const from=media.volume,start=performance.now();const end=()=>{media.pause();media.removeAttribute('src');media.load()};if(media.paused){end();return}fadeTimer=setInterval(()=>{const p=Math.min(1,(performance.now()-start)/650);media.volume=from*(1-p);if(p===1){clearInterval(fadeTimer);end()}},50)}};
}
