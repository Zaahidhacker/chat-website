import {liteMotion,reducedMotion} from './motion-system.js';

const prefix='universe-welcome-';
const pendingInMemory=new Set();
const memberNames={1:'Zaahid',2:'Layaana'};

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
 if(pending)showTransition(`Welcome Back, ${name}`)?.();
}

export function farewell(){
 return showTransition('GoodBye! Come Back again..');
}

function showTransition(message){
 const scene=document.createElement('dialog');
 if(!scene.showModal||document.hidden)return;
 scene.className='session-transition';
 scene.setAttribute('aria-label',message);
 scene.addEventListener('cancel',event=>event.preventDefault());

 const text=document.createElement('p');
 text.setAttribute('aria-hidden','true');
 for(const [index,word] of message.split(' ').entries()){
  if(index)text.append(' ');
  const span=document.createElement('span');
  span.textContent=word;
  span.style.setProperty('--word-order',index);
  text.append(span);
 }
 scene.append(text);
 document.body.append(scene);
 scene.showModal();

 const shownAt=performance.now();
 const hold=reducedMotion()?550:liteMotion()?980:1300;
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
