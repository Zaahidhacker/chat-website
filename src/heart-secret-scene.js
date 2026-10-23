import {SECRET_DURATION} from './heart-secret-policy.js';
let styleReady;
function ready(){
 if(!styleReady)styleReady=new Promise((resolve,reject)=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href=HEARTS_STYLE_URL;
  const timer=setTimeout(()=>{link.remove();styleReady=null;reject(Error('Scene styles unavailable'))},5000);
  link.onload=()=>{clearTimeout(timer);resolve()};link.onerror=()=>{clearTimeout(timer);link.remove();styleReady=null;reject(Error('Scene styles unavailable'))};document.head.append(link);
 });return styleReady;
}
const heartPath='M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z';
function heart(index){return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="secret-heart-${index}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffc2d3"/><stop offset=".4" stop-color="#ed668e"/><stop offset="1" stop-color="#a12250"/></linearGradient></defs><path fill="url(#secret-heart-${index})" d="${heartPath}"/><path fill="none" stroke="#ffe6ee" stroke-opacity=".3" stroke-width=".35" d="${heartPath}"/></svg>`}
function randomFor(id){let seed=2166136261;for(const char of id)seed=Math.imul(seed^char.charCodeAt(0),16777619);return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
export async function showSecret({id,startAt,current=()=>true,onFinish=()=>{}}){
 const preference=matchMedia('(prefers-reduced-motion: reduce)'),reduced=preference.matches;
 const [motion]=await Promise.all([reduced?null:import('./heart-secret-motion.js').catch(()=>null),ready()]);
 let fontTimer;await Promise.race([document.fonts?.load('40px Secret Allura').catch(()=>[]),new Promise(r=>{fontTimer=setTimeout(r,600)})]);clearTimeout(fontTimer);
 if(!current())return;
 const lead=startAt-Date.now();if(lead>0)await new Promise(resolve=>setTimeout(resolve,lead));
 if(!current()||Date.now()>=startAt+SECRET_DURATION)return;
 const root=document.createElement('section');root.className='hearts-secret'+(preference.matches||!motion?' secret-still':'');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','The three hearts secret');root.setAttribute('aria-describedby','three-hearts-declaration');root.dataset.secretId=id;root.dataset.start=String(startAt);
 const rand=randomFor(id),count=innerWidth<600?28:44;
 root.innerHTML=`<div class="secret-vignette" aria-hidden="true"></div><div class="secret-halo" aria-hidden="true"></div><div class="secret-orbit" aria-hidden="true"></div><div class="secret-seed" aria-hidden="true">${heart('seed')}</div><div class="secret-three" aria-hidden="true">${[0,1,2].map(i=>`<div class="secret-heart">${heart(i)}</div>`).join('')}</div><div class="secret-reveal"><p class="secret-whisper">A LITTLE SECRET. ONLY OURS.</p><h2 class="secret-words" id="three-hearts-declaration"><span>I love you,</span> <em>more than words could ever say.</em></h2><div class="secret-signature" aria-hidden="true"><i></i><span>♡ &nbsp; ♡ &nbsp; ♡</span><i></i></div></div><div class="secret-particles" aria-hidden="true">${Array.from({length:count},(_,i)=>{const x=rand()*100,y=rand()*100,size=3+rand()*5;return `<i class="secret-particle ${i%7===0?'little-heart':i%3===0?'little-star':'petal'}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${size.toFixed(1)}px;height:${(i%3===0?size:size*1.7).toFixed(1)}px;background:${['#f8a7c9','#dfb79f','#fff4ed'][i%3]}">${i%7===0?'♡':i%3===0?'✦':''}</i>`}).join('')}</div><button class="secret-skip" type="button" aria-label="Skip romantic animation">Skip this moment <span aria-hidden="true">×</span></button><p class="secret-footer">THE WORLD CAN WAIT A LITTLE.</p>`;
 const opener=document.activeElement,app=document.querySelector('#app'),modal=document.querySelector('#modal-root'),appInert=app?.inert,modalInert=modal?.inert;let finished=false,timer,controls;
 function finish(){
  if(finished)return;finished=true;clearTimeout(timer);controls?.stop();document.removeEventListener('keydown',keys,true);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',finish);preference.removeEventListener?.('change',finish);root.remove();
  if(app)app.inert=appInert;if(modal)modal.inert=modalInert;if(opener?.isConnected)opener.focus({preventScroll:true});onFinish();
 }
 function keys(e){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish()}else if(e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();root.querySelector('button').focus({preventScroll:true})}}
 function hidden(){if(document.hidden)finish()}
 document.body.append(root);if(app)app.inert=true;if(modal)modal.inert=true;root.querySelector('button').focus({preventScroll:true});
 root.querySelector('button').addEventListener('click',finish);document.addEventListener('keydown',keys,true);document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',finish);preference.addEventListener?.('change',finish);
 const elapsed=(Date.now()-startAt)/1000;
 if(!preference.matches&&motion){
  const q=s=>root.querySelector(s),ease=[.16,1,.3,1];
  const sequence=[
   [root,{opacity:[0,1,1,0]},{at:0,duration:8,times:[0,.15,.75,1],ease:'easeInOut'}],
   [q('.secret-seed'),{opacity:[0,1,1,0],scale:[.35,1,.88,.2]},{at:.12,duration:1.5,times:[0,.35,.7,1],ease:'easeInOut'}],
   [q('.secret-halo'),{opacity:[0,.7,.45,0],scale:[.2,1,1.15,1.3]},{at:2.1,duration:4.7,times:[0,.22,.65,1],ease:'easeInOut'}],
   [q('.secret-orbit'),{opacity:[0,.5,0],rotate:[-15,10],scale:[.8,1.1]},{at:1.6,duration:4.8,ease:'easeInOut'}],
   [q('.secret-reveal'),{opacity:[0,1],y:[16,0]},{at:3,duration:1.2,ease}],
   [q('.secret-reveal'),{opacity:[1,0],y:[0,-6]},{at:6.15,duration:1.2,ease:'easeInOut'}],
   [q('.secret-footer'),{opacity:[0,.55,0]},{at:3.5,duration:3.4,times:[0,.3,1],ease:'easeInOut'}]
  ];
  root.querySelectorAll('.secret-heart').forEach((el,i)=>{
   sequence.push([el,{opacity:[0,1]},{at:1.2+i*.1,duration:.5,ease:'easeOut'}],[el,{x:[(i-1)*92,0],y:[i===1?-26:16,0],rotate:[(i-1)*-12,0],scale:[.6,1]},{at:1.3+i*.08,type:'spring',visualDuration:1.15,bounce:.14}],[el.querySelector('svg'),{scale:[1,1.1,1]},{at:2.2,duration:.55,ease:'easeInOut'}],[el,{opacity:[1,0],scale:[1,.65]},{at:2.75,duration:.4,ease:'easeOut'}]);
  });
  root.querySelectorAll('.secret-particle').forEach(el=>{
   const direction=rand()>.5?1:-1,delay=rand()*.5;
   sequence.push([el,{opacity:[0,.7,.5,0],x:[0,direction*(12+rand()*30)],y:[30,-50-rand()*90],rotate:[-15,15+rand()*40]},{at:2.9+delay,duration:3.3,times:[0,.18,.7,1],ease:'easeInOut'}]);
  });
  try{controls=motion.animate(sequence,{autoplay:false});controls.time=Math.max(0,elapsed);if(elapsed<0){root.style.opacity='0';timer=setTimeout(()=>{root.style.opacity='';controls.play();timer=setTimeout(finish,SECRET_DURATION)},-elapsed*1000)}else{controls.play();timer=setTimeout(finish,SECRET_DURATION-elapsed*1000)}}catch{controls?.stop();controls=null;root.classList.add('secret-still');timer=setTimeout(finish,Math.max(0,SECRET_DURATION-elapsed*1000))}
 }else timer=setTimeout(finish,Math.max(0,SECRET_DURATION-elapsed*1000));
 return finish;
}
