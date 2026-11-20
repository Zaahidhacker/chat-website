import {liteMotion,reducedMotion} from './motion-system.js';

const prefix='universe-welcome-';
const pendingInMemory=new Set();
const memberNames={1:'Zaahid',2:'Layaana'};
// Twinkles scattered around the edges of the screen, away from the words.
const stars=[{x:14,y:24},{x:84,y:18},{x:76,y:80},{x:20,y:74},{x:88,y:56}];

export function rememberSignOut(userId){
 try{localStorage.setItem(prefix+userId,'1')}
 catch{pendingInMemory.add(userId)}
}

export function welcomeBack(member){
 const name=memberNames[member?.slot];
 if(!name)return;
 const key=prefix+member.user_id;
 let pending=pendingInMemory.delete(member.user_id);
 try{
  if(localStorage.getItem(key)==='1'){
   pending=true;
   localStorage.removeItem(key);
  }
 }catch{}
 if(pending)showTransition(`Welcome Back, ${name}`,{eyebrow:'A little hello',sub:'Your little world kept everything just as you left it.'})?.();
}

export function farewell(){
 return showTransition('GoodBye! Come Back again..',{eyebrow:'Until next time',sub:'Your person will be right here when you return.'});
}

function showTransition(message,{eyebrow,sub}){
 const scene=document.createElement('dialog');
 if(!scene.showModal||document.hidden)return;
 scene.className='session-transition';
 scene.setAttribute('aria-label',message);
 scene.addEventListener('cancel',event=>event.preventDefault());

 const decor=document.createElement('div');
 decor.className='session-decor';decor.setAttribute('aria-hidden','true');
 decor.innerHTML='<i class="session-halo"></i><i class="session-ring"></i><i class="session-heart">♡</i>';
 scene.append(decor);
 for(const [index,star] of stars.entries()){
  const s=document.createElement('i');
  s.className='session-star';s.setAttribute('aria-hidden','true');s.textContent='✦';
  s.style.left=star.x+'%';s.style.top=star.y+'%';s.style.setProperty('--star-order',index);
  scene.append(s);
 }
 const brow=document.createElement('p');
 brow.className='session-eyebrow';brow.textContent=eyebrow;scene.append(brow);

 const text=document.createElement('p');
 text.className='session-words';text.setAttribute('aria-hidden','true');
 const words=message.split(' ');
 for(const [index,word] of words.entries()){
  if(index)text.append(' ');
  const span=document.createElement('span');
  span.textContent=word;
  span.style.setProperty('--word-order',index);
  if(index===words.length-1)span.classList.add('session-cursive');
  text.append(span);
 }
 scene.append(text);

 const foot=document.createElement('p');
 foot.className='session-sub';foot.textContent=sub;scene.append(foot);

 document.body.append(scene);
 scene.showModal();

 const shownAt=performance.now();
 const hold=reducedMotion()?550:liteMotion()?1100:1500;
 const remove=()=>scene.remove();
 window.addEventListener('pagehide',remove,{once:true});
 return async()=>{
  const remaining=hold-(performance.now()-shownAt);
  if(remaining>0&&!document.hidden)await new Promise(resolve=>setTimeout(resolve,remaining));
  if(scene.isConnected&&!reducedMotion()&&scene.animate){
   await scene.animate([{opacity:1},{opacity:0}],{duration:180,fill:'forwards'}).finished.catch(()=>{});
  }
  window.removeEventListener('pagehide',remove);
  remove();
 };
}
