export function searchMessages(messages,query,limit=20){
 const q=query.trim().toLowerCase();if(!q)return {matches:[],total:0};
 const all=messages.filter(m=>!m.deleted&&!m.hidden&&String(m.body).toLowerCase().includes(q));
 return {matches:all.slice(-limit).reverse(),total:all.length};
}
export function searchHTML(messages,query,{S,esc,date,time}){
 const {matches,total}=searchMessages(messages,query);if(!query.trim())return '';
 const q=query.trim(),lower=q.toLowerCase();
 const snippet=body=>{const at=body.toLowerCase().indexOf(lower),start=Math.max(0,at-65),end=Math.min(body.length,Math.max(at+q.length+65,start+160)),text=body.slice(start,end),offset=at-start;
  return (start?'…':'')+esc(text.slice(0,offset))+'<mark>'+esc(text.slice(offset,offset+q.length))+'</mark>'+esc(text.slice(offset+q.length))+(end<body.length?'…':'');
 };
 return `<p class="search-summary" role="status">${total?`${total} matching moment${total===1?'':'s'}${total>20?' · showing the latest 20':''}. Tap to return to the conversation.`:'No little moments found. Try another word.'}</p>`+matches.map(m=>`<button class="search-moment" data-action="find-message-${esc(m.id)}"><small><b>${esc(m.sender===S.user.id?'You':S.partner?.name||'Your person')}</b> · ${esc(date(m.created_at))} · ${esc(time(m.created_at))}</small><span>${snippet(m.body)}</span><i aria-hidden="true">↗</i></button>`).join('');
}
export function dialogFocusables(dialog){return [...dialog.querySelectorAll('button,input,textarea,a[href],select,audio[controls],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&el.getClientRects().length)}
export function prepareDialog(dialog){const heading=dialog.querySelector('h2');if(heading){heading.id='conversation-dialog-title';dialog.setAttribute('aria-labelledby',heading.id);dialog.removeAttribute('aria-label')}}
