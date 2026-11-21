export const timing=Object.freeze({press:110,micro:140,panel:220,navigation:260,romantic:380});
export const ease='cubic-bezier(.22,1,.36,1)';
import {springSamples,springs} from './motion-physics.js';
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),active=new Map();
export const reducedMotion=()=>reduced.matches||document.hidden;
export const liteMotion=()=>document.documentElement.dataset.motion==='lite';
// Weak hardware can ask for calm motion itself: a long animation frame means
// the device is struggling, so background sparkle and blur switch off for the
// rest of the visit. A manual "full motion" choice is always respected.
(function watchJank(){if(liteMotion()||reduced.matches)return;try{if(localStorage.getItem('universe-motion')==='full')return}catch{} try{const o=new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.blockingDuration>150){document.documentElement.dataset.motion='lite';o.disconnect();break}});o.observe({type:'long-animation-frame',buffered:true});setTimeout(()=>o.disconnect(),15000)}catch{}})();
export function stopMotion(el,commit=false){const a=active.get(el);if(!a)return;if(commit)try{a.commitStyles()}catch{}a.cancel();active.delete(el)}
export function move(el,frames,options={}){
 if(!el?.isConnected)return Promise.resolve();stopMotion(el);
 if(reducedMotion()||!el.animate)return Promise.resolve();
 let a;
 try{a=el.animate(frames,{duration:timing.micro,easing:ease,...options})}catch{return Promise.resolve()}
 active.set(el,a);
 return a.finished.catch(()=>{}).finally(()=>{if(active.get(el)===a){active.delete(el);a.cancel()}});
}
export function release(el,from,velocity=0){
 stopMotion(el);el.style.removeProperty('transform');if(reducedMotion())return;
 const path=springSamples(from,velocity);return move(el,path.map(x=>({transform:`translateX(${x}px)`})),{duration:(path.length-1)/120*1000,easing:'linear'});
}
export function enterMessage(el,delay=0){
 const gentle=liteMotion();
 const frames=gentle
  ?[{transform:'translateY(4px)'},{offset:.58,transform:'translateY(-1px)'},{transform:'none'}]
  :[{transform:'translateY(8px) scale(.96)'},{offset:.58,transform:'translateY(-3px) scale(1.025)'},{transform:'none'}];
 return move(el,frames,{duration:gentle?160:230,delay});
}
export function sendPulse(el){return move(el,[{transform:'scale(.8) rotate(-10deg)'},{transform:'none'}],{duration:140})}
// Send droplet: one liquid-glass bubble that leaves the send button and
// dissolves into the new message as it pops in. The travelling shell animates
// transform/opacity only; the glass morph (squash-and-stretch + border-radius
// wobble) lives on the inner element so the two never fight. The droplet is
// removed on finish, on cancel, on hide and on sign-out, so it never outlives
// its flight — a failed send can never leave one behind.
// Smoothness: the flight is one quadratic Bezier arc sampled at 15 points
// with ease-out time, so it launches fast and settles soft with no kink,
// no direction reversal and no sudden speed change. Opacity fades in/out
// with smoothsteps instead of snapping, and the shell uses translate3d
// (compositor only) with will-change in CSS.
const droplets=new Set();
let bubbleArrival=0;
export function bubbleEntranceDelay(){return Math.max(0,bubbleArrival-performance.now())}
export function sendBubble(from){
 if(reducedMotion()||!from?.animate)return;
 const list=document.querySelector('#messages'),btn=from.getBoundingClientRect();
 if(!btn.width||!list||droplets.size>=3)return;
 const lite=liteMotion(),r=list.getBoundingClientRect(),size=40;
 const sx=btn.left+btn.width/2,sy=btn.top+btn.height/2;
 const dx=r.right-52-sx,dy=r.bottom-40-sy;
 const el=document.createElement('div');
 el.className='send-droplet'+(lite?' send-droplet--lite':'');
 el.setAttribute('aria-hidden','true');
 el.style.setProperty('--drop-x',(sx-size/2)+'px');
 el.style.setProperty('--drop-y',(sy-size/2)+'px');
 const glass=document.createElement('i');el.append(glass);
 document.body.append(el);droplets.add(el);
 const flight=lite?460:580;
 bubbleArrival=performance.now()+flight-140;
 const cx=dx*.32,cy=dy*.55-72,ss=u=>u*u*(3-2*u),frames=[];
 for(let i=0;i<=14;i++){const u=i/14,p=1-Math.pow(1-u,3),q=1-p;
  const o=u<.1?ss(u/.1):u>.84?1-ss((u-.84)/.16):1;
  frames.push({transform:`translate3d(${(2*q*p*cx+p*p*dx).toFixed(1)}px,${(2*q*p*cy+p*p*dy).toFixed(1)}px,0)`,opacity:+o.toFixed(3),offset:u})}
 const travel=el.animate(frames,{duration:flight,easing:'linear',fill:'forwards'});
 let morph=null;
 if(!lite)morph=glass.animate([
  {transform:'scale(.68)',borderRadius:'50%',offset:0,easing:'cubic-bezier(.22,1,.36,1)'},
  {transform:'scale(.95,1.22)',borderRadius:'47% 53% 57% 43% / 53% 45% 55% 47%',offset:.22,easing:'cubic-bezier(.22,1,.36,1)'},
  {transform:'scale(1.24,1.02)',borderRadius:'54% 46% 44% 56% / 46% 56% 48% 54%',offset:.45,easing:'cubic-bezier(.22,1,.36,1)'},
  {transform:'scale(1.08,.96)',borderRadius:'48% 52% 55% 45% / 52% 48% 54% 46%',offset:.68,easing:'cubic-bezier(.22,1,.36,1)'},
  {transform:'scale(.92,.78)',borderRadius:'50%',offset:.86,easing:'cubic-bezier(.22,1,.36,1)'},
  {transform:'scale(.48)',borderRadius:'50%',offset:1},
 ],{duration:flight,easing:'linear',fill:'forwards'});
 const done=()=>{travel.cancel();morph?.cancel();el.remove();droplets.delete(el)};
 travel.finished.catch(()=>{}).finally(done);
}
function clearDroplets(){for(const el of droplets){el.getAnimations().forEach(a=>a.cancel());el.remove()}droplets.clear();bubbleArrival=0}
export function enterPanel(el){clearExitLayers();return move(el,[{opacity:.6,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:timing.panel})}
export function exitPanel(el){return move(el,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(6px)'}],{duration:130,fill:'forwards'})}
function clear(){for(const [el]of active)stopMotion(el)}
reduced.addEventListener('change',()=>{if(reduced.matches)clear()});document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
const ghosts=new Set();
export function exitOverlay(overlay){
 if(!overlay||reducedMotion())return;
 const ghost=overlay.cloneNode(true);ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.classList.add('motion-ghost');
 for(const el of ghost.querySelectorAll('[id],[data-action]')){el.removeAttribute('id');el.removeAttribute('data-action')}
 for(const media of ghost.querySelectorAll('audio,video')){media.removeAttribute('src');media.pause()}
 document.body.append(ghost);ghosts.add(ghost);
 const panel=ghost.matches('.photo-lightbox')?ghost:ghost.querySelector('.modal');
 move(ghost,[{opacity:1},{opacity:0}],{duration:130});
 exitPanel(panel).finally(()=>{ghost.remove();ghosts.delete(ghost)});
}
export function clearExitLayers(){for(const ghost of ghosts){stopMotion(ghost);const panel=ghost.querySelector('.modal');if(panel)stopMotion(panel);ghost.remove()}ghosts.clear()}
export function clearMotion(){clear();clearExitLayers();clearDroplets()}
reduced.addEventListener('change',()=>{if(reduced.matches)clearMotion()});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMotion()});
