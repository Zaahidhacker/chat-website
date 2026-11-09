import {release,stopMotion,reducedMotion} from './motion-system.js';
export function attachSwipeReply(log,onReply,onHold){
 let gesture=null,blockedClick=null,frame=0,hold=0;
 const clearHold=()=>{clearTimeout(hold);hold=0};
 const reset=(spring=true)=>{
  clearHold();cancelAnimationFrame(frame);frame=0;
  if(!gesture)return;const g=gesture;gesture=null;
  g.article.classList.remove('swiping','reply-ready','message-actions-held');
  if(spring&&g.offset)release(g.bubble,g.offset,g.velocity);else g.bubble.style.removeProperty('transform');
 };
 const block=id=>{blockedClick=id;setTimeout(()=>{if(blockedClick===id)blockedClick=null},600)};
 log.addEventListener('click',event=>{if(blockedClick&&event.target.closest('[data-message]')?.dataset.message===blockedClick&&(!event.target.closest('button,a')||event.target.closest('.photo-frame'))){blockedClick=null;event.preventDefault();event.stopPropagation()}},{capture:true});
 log.addEventListener('contextmenu',event=>{if(gesture?.held||blockedClick&&event.target.closest('[data-message]')?.dataset.message===blockedClick){event.preventDefault()}});
 log.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'||!event.isPrimary||event.target.closest('.removed')||(event.target.closest('button,a')&&!event.target.closest('.photo-frame')))return;
  const article=event.target.closest('[data-message]'),bubble=article?.querySelector('.message-main');if(!bubble)return;
  reset();const matrix=getComputedStyle(bubble).transform,start=matrix==='none'?0:new DOMMatrixReadOnly(matrix).m41;stopMotion(bubble,true);bubble.style.transform=`translateX(${start}px)`;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,article,bubble,dx:0,dy:0,offset:start,start,velocity:0,time:event.timeStamp,held:false};
  if(onHold&&!event.target.closest('.photo-frame'))hold=setTimeout(()=>{if(!gesture)return;gesture.held=true;article.classList.add('message-actions-held');block(article.dataset.message);onHold(article.dataset.message);reset(false)},480);
 });
 log.addEventListener('pointermove',event=>{
  const g=gesture;if(!g||g.id!==event.pointerId)return;
  const dx=event.clientX-g.x,dy=Math.abs(event.clientY-g.y);if(Math.abs(dx)>7||dy>7)clearHold();
  if(dy>12&&dy>Math.abs(dx)){reset();return}
  g.dx=dx;g.dy=dy;if(dx<8){if(g.offset)reset();return}
  const offset=g.start+(dx<=64?dx*.7:44.8+40*(1-Math.exp(-(dx-64)/80)));
  const dt=Math.max(1,event.timeStamp-g.time);g.velocity=.6*g.velocity+.4*(offset-g.offset)*1000/dt;g.offset=offset;g.time=event.timeStamp;
  if(!g.article.hasPointerCapture(event.pointerId))g.article.setPointerCapture(event.pointerId);
  g.article.classList.add('swiping');g.article.classList.toggle('reply-ready',dx>=64&&dx>dy*1.5);
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(gesture===g&&!reducedMotion())g.bubble.style.transform=`translateX(${g.offset}px)`});
 },{passive:true});
 log.addEventListener('pointerup',event=>{const g=gesture;if(!g||g.id!==event.pointerId)return;const id=g.article.dataset.message,reply=g.dx>=64&&g.dx>g.dy*1.5;reset();if(reply){block(id);onReply(id)}});
 log.addEventListener('pointercancel',()=>reset());log.addEventListener('lostpointercapture',event=>{if(gesture&&event.target===gesture.article)reset()});
 log.addEventListener('scroll',()=>{if(gesture&&!gesture.offset)reset(false)},{passive:true});
 const cancel=()=>{if(document.hidden)reset(false)};document.addEventListener('visibilitychange',cancel);
 // The log is replaced on navigation; release the document listener with it.
 return ()=>{reset(false);document.removeEventListener('visibilitychange',cancel)};
}
