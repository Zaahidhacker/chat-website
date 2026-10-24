let p28Module,p28Ticket=0;
export function stopProject28(){p28Ticket++;p28Module?.stopProject28()}
export async function project28(db,S,onReturn){const ticket=++p28Ticket;try{const r=await db.from('project28_config').select('*').eq('id',true);if(r.error||!r.data?.[0]||ticket!==p28Ticket)return;const module=await import('./project28.js');if(ticket!==p28Ticket)return;p28Module=module;module.project28(db,S,onReturn,r.data[0])}catch{}}
export {secretMessage,closeSecret} from './heart-secret.js';
export {presenceLabel} from './presence.js';
export function receiptHTML(m,status){

  return `<svg class="receipt-checks" viewBox="0 0 22 16" aria-hidden="true">${status==='Sending'?'<circle cx="10" cy="8" r="5.5"/><path d="M10 4.5V8l2 1.5"/>':'<path d="m2 8 4 4L15 3"/><path class="second" d="m10 11 2 1 8-9"/>'}</svg>${m.failed?`<button class="text-btn" data-action="retry-${m.id}">Failed · retry</button>`:`<span class="sr-status">${status}</span>`}`;

}
export function messageHTML(m,grouped,{S,photoRecords,messageLookup,reactionLookup,receiptLabel,icon,esc,time,photoHTML,receiptHTML,ib,linkify}) {
  const own = m.sender === S.user.id;
  const reply = messageLookup.get(m.reply_to);
  const reactions = reactionLookup.get(m.id)||[];
  let status = receiptLabel(m, S.partner);
  return `<article class="message ${own ? "own" : ""} ${grouped?"grouped":""}" data-message="${esc(m.id)}"><span class="swipe-hint" aria-hidden="true">${icon('reply')}</span><div class="avatar ${own ? "" : "pair"}">${esc((own ? S.me?.name : S.partner?.name)?.[0] || "\u2661")}</div><div class="message-main"><div class="bubble ${m.deleted ? "removed" : ""}">${m.reply_to ? `<div class="quote"><strong>${reply?esc(reply.sender===S.user.id?'You':S.partner?.name||'Your person'):'Reply'}</strong>${reply && !reply.deleted ? (photoRecords.has(reply.id)?`<img class="quote-photo" data-photo-id="${esc(reply.id)}" alt="Photo in reply">`:"")+esc(reply.body.slice(0, 180)) : reply?.deleted?'This message was removed':'Earlier message'}</div>` : ""}${m.deleted ? "This message was removed" : (photoHTML(m)||linkify(m.body))}</div>${reactions.map((r) => `<button class="reaction" data-action="react-${m.id}" aria-label="Reaction ${r.emoji}">${r.emoji}</button>`).join("")}<div class="message-meta">${S.favorites.has(m.id) ? icon("bookmark") : ""}<span class="message-time">${time(m.created_at)}${m.edited_at && !m.deleted ? " \xB7 edited" : ""}</span>${own?`<span class="receipt" data-receipt="${m.id}" data-status="${status}">${receiptHTML(m)}</span>`:''}</div></div>${m.deleted ? "" : `<div class="message-actions">${ib("bookmark", S.favorites.has(m.id) ? "Unsave message" : "Save to keepsakes", `save-${m.id}`, "quick-save")}${ib("more", "Message actions", `message-${m.id}`)}</div>`}</article>`;
}
export function unread(S){const has=!!S.user&&S.messages.some(m=>m.sender!==S.user.id&&!m.pending&&!m.failed&&m.seq>(S.me?.last_read||0));const nav=document.querySelector('.sidebar [data-action="page-chat"]'),old=nav?.querySelector('.nav-unread');if(has&&!old)nav?.insertAdjacentHTML('beforeend','<span class="nav-unread" aria-hidden="true">New</span>');if(!has)old?.remove();document.title=(has&&(S.page!=='chat'||document.hidden)?'• ':'')+'Our Little Universe — Just us.'}
