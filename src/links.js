// Render-only: stored message text stays unchanged. No link previews or requests.
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const webAddress=/\b(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#][^\s<>"']*)?/gi;
function trimAddress(text){
 const counts={};for(const char of text)if('()[]{}'.includes(char))counts[char]=(counts[char]||0)+1;
 let end=text.length;
 for(;;){const last=text[end-1];if(!last)break;
  if(/[.,!?;:\u2019\u201d]/.test(last)){end--;continue}
  const opening={')':'(',']':'[','}':'{'}[last];
  if(opening&&(counts[last]||0)>(counts[opening]||0)){counts[last]--;end--;continue}break;
 }return text.slice(0,end);
}
export function linkify(value){
 const text=String(value??'');let html='',cursor=0;
 for(const match of text.matchAll(webAddress)){
  const start=match.index,previous=text[start-1];
  // Do not turn email suffixes or unsupported scheme fragments into links.
  if(previous&&/[\w@/:.\-]/.test(previous))continue;
  const label=trimAddress(match[0]);if(!label)continue;
  let url;try{url=new URL(/^https?:\/\//i.test(label)?label:'https://'+label)}catch{continue}
  if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)continue;
  html+=escapeHTML(text.slice(cursor,start))+`<a class="message-link" href="${escapeHTML(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`;
  cursor=start+label.length;
 }
 return html+escapeHTML(text.slice(cursor));
}
