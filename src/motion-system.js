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
export function enterMessage(el,delay=0,flip=false){
 if(!el?.isConnected)return Promise.resolve();
 const gentle=liteMotion();
 if(reducedMotion()||!flip){
  const frames=gentle
   ?[{transform:'translateY(4px)'},{offset:.58,transform:'translateY(-1px)'},{transform:'none'}]
   :[{transform:'translateY(8px) scale(.96)'},{offset:.58,transform:'translateY(-3px) scale(1.025)'},{transform:'none'}];
  return move(el,frames,{duration:gentle?160:230,delay});
 }
 // FLIP send morph: the message itself travels from the send button and
 // grows from a small liquid-glass blob into its final bubble. This must
 // stay ONE animate() call on .message-main — the bounce test counts
 // animate() calls there, so travel, squash and border-radius all live in
 // these keyframes; the glass skin is a CSS class (.morphing), never a
 // second animation. Every keyframe carries a transform (the test reads
 // them), none carries opacity (the message is painted from frame 0),
 // and there is no wall-clock delay. Because the transform lives on the
 // element, a keyboard/viewport shift moves the message and its animation
 // together instead of stranding a fixed overlay.
 // The button rect is read HERE, in the same synchronous block as the
 // final rect — never captured earlier. The keyboard can dismiss between
 // send() and this frame, and a rect captured at send time would belong
 // to the old layout: in the harness that put the morph 248px too high.
 const btn=document.querySelector('.composer .send')?.getBoundingClientRect();
 const bubble=el.querySelector('.bubble'),er=el.getBoundingClientRect(),br=bubble?.getBoundingClientRect();
 const origin=btn&&btn.width?{x:btn.left+btn.width/2,y:btn.top+btn.height/2,size:Math.min(btn.width,btn.height)}:null;
 if(!br||!br.width||!br.height||!origin?.size){
  const plain=gentle
   ?[{transform:'translateY(4px)'},{offset:.58,transform:'translateY(-1px)'},{transform:'none'}]
   :[{transform:'translateY(8px) scale(.96)'},{offset:.58,transform:'translateY(-3px) scale(1.025)'},{transform:'none'}];
  return move(el,plain,{duration:gentle?160:230,delay});
 }
 const cx=br.left+br.width/2,cy=br.top+br.height/2;
 const sx=+Math.max(.06,Math.min(.9,origin.size/br.width)).toFixed(3),sy=+Math.max(.06,Math.min(.9,origin.size/br.height)).toFixed(3);
 const dx=Math.round(origin.x-cx),dy=Math.round(origin.y-cy);
 const mx=+(sx+(1-sx)*.55).toFixed(3),my=+(sy+(1-sy)*.55).toFixed(3);
 const tx=Math.round(dx*.42),ty=Math.round(dy*.42)-26,R='18px 18px 5px 18px',out='cubic-bezier(.22,1,.36,1)';
 const frames=gentle
  ?[{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,borderRadius:'50%',offset:0,easing:out},
    {transform:'translate(0px,2px) scale(1.01)',borderRadius:R,offset:.62,easing:out},
    {transform:'translateY(-1px)',borderRadius:R,offset:.82},
    {transform:'none',borderRadius:R,offset:1}]
  :[{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,borderRadius:'50%',offset:0,easing:out},
    {transform:`translate(${tx}px,${ty}px) scale(${mx},${my})`,borderRadius:'42% 58% 55% 45% / 55% 45% 58% 42%',offset:.38,easing:out},
    {transform:'translate(0px,3px) scale(1.015)',borderRadius:R,offset:.68,easing:'cubic-bezier(.3,1.25,.4,1)'},
    {transform:'translateY(-3px) scale(1.025)',borderRadius:R,offset:.84,easing:out},
    {transform:'none',borderRadius:R,offset:1}];
 el.style.transformOrigin=(cx-er.left).toFixed(1)+'px '+(cy-er.top).toFixed(1)+'px';
 el.classList.add('morphing');
 return move(el,frames,{duration:gentle?220:300,easing:'linear',delay}).finally(()=>{
  // Let the glass skin fade out before the class comes off.
  el.classList.add('morph-settling');
  setTimeout(()=>{el.classList.remove('morphing','morph-settling');el.style.removeProperty('transform-origin')},170);
 });
}
export function sendPulse(el){return move(el,[{transform:'scale(.8) rotate(-10deg)'},{transform:'none'}],{duration:140})}
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
export function clearMotion(){clear();clearExitLayers();for(const el of document.querySelectorAll('.message-main.morphing'))el.classList.remove('morphing','morph-settling')}
reduced.addEventListener('change',()=>{if(reduced.matches)clearMotion()});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMotion()});
