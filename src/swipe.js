export function attachSwipeReply(log, onReply) {
 let gesture = null, blockedClick = null;
 log.addEventListener('click',event=>{if(blockedClick&&event.target.closest('.photo-frame')&&event.target.closest('[data-message]')?.dataset.message===blockedClick){blockedClick=null;event.preventDefault();event.stopPropagation()}},{capture:true});
 const reset = () => {
  if (!gesture) return;
  gesture.bubble.style.removeProperty('transform');
  gesture.article.classList.remove('swiping', 'reply-ready');
  gesture = null;
 };
 log.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' || !event.isPrimary || event.target.closest('.removed') || (event.target.closest('button,a')&&!event.target.closest('.photo-frame'))) return;
  const article = event.target.closest('[data-message]'), bubble = article?.querySelector('.message-main');
  if (!bubble) return;
  reset();
  gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,article,bubble,dx:0,dy:0};
 });
 log.addEventListener('pointermove', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x, dy = Math.abs(event.clientY - gesture.y);
  if (dy > 12 && dy > Math.abs(dx)) { reset(); return; }
  gesture.dx = dx; gesture.dy = dy;
  if (dx < 8) return;
  if (!gesture.article.hasPointerCapture(event.pointerId)) gesture.article.setPointerCapture(event.pointerId);
  gesture.article.classList.add('swiping');
  gesture.article.classList.toggle('reply-ready', dx >= 64 && dx > dy * 1.5);
  gesture.bubble.style.transform = `translateX(${Math.min(84,dx * .7)}px)`;
 }, {passive:true});
 log.addEventListener('pointerup', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const id = gesture.article.dataset.message, reply = gesture.dx >= 64 && gesture.dx > gesture.dy * 1.5;
  reset(); if (reply) {blockedClick=id;setTimeout(()=>{if(blockedClick===id)blockedClick=null},600);onReply(id)}
 });
 log.addEventListener('pointercancel',reset);
 // Touch browsers implicitly capture the pressed bubble first. Moving capture
 // to its article emits a bubbling loss event for that bubble; keep the gesture.
 log.addEventListener('lostpointercapture',event=>{if(gesture&&event.target===gesture.article)reset()});
}
