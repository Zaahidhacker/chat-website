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
// The send bounce, refined: one animate() call on .message-main, no
// opacity in the keyframes (the message is painted from frame 0), no
// wall-clock delay, and the transform lives on the element — so a
// keyboard/viewport shift moves the message and its animation together
// instead of stranding anything. The -3px overshoot is pinned by
// Zaahid's bounce test in tests/browser.mjs; the extra 1px settle
// keyframe is what makes the landing soft instead of snapping straight
// from the overshoot to rest. No glass skin, no FLIP travel — the
// liquid-glass morph was removed at Zaahid's request (too much), and
// this plain bounce is the whole send animation.
export function enterMessage(el,delay=0){
 if(!el?.isConnected)return Promise.resolve();
 const gentle=liteMotion();
 const frames=gentle
  ?[{transform:'translateY(4px)'},{offset:.58,transform:'translateY(-1px)'},{transform:'none'}]
  :[{transform:'translateY(8px) scale(.96)',offset:0,easing:'cubic-bezier(.22,1,.36,1)'},
    {transform:'translateY(-3px) scale(1.025)',offset:.55,easing:'cubic-bezier(.3,1.25,.4,1)'},
    {transform:'translateY(1px) scale(1.004)',offset:.8,easing:'cubic-bezier(.22,1,.36,1)'},
    {transform:'none',offset:1}];
 return move(el,frames,{duration:gentle?160:250,delay});
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
export function clearMotion(){clear();clearExitLayers()}
reduced.addEventListener('change',()=>{if(reduced.matches)clearMotion()});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMotion()});
