// Calendar days in Sri Lanka; independent of the viewer's device time zone.
const date=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Colombo',year:'numeric',month:'numeric',day:'numeric'});
export function relationshipDays(now=Date.now()){
 const p=Object.fromEntries(date.formatToParts(new Date(now)).map(v=>[v.type,v.value]));
 return Math.max(0,Math.round((Date.UTC(+p.year,+p.month-1,+p.day)-Date.UTC(2026,8,27))/86400000));
}
let clock;
export function updateRelationship(){for(const el of document.querySelectorAll('[data-relationship-days]')){const text=relationshipDays()+' days together ౨ৎ',changed=!!el.textContent&&el.textContent!==text;el.textContent=text;if(changed&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate?.([{transform:'translateY(2px)'},{transform:'none'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});el.title='Since September 27, 2026 · Sri Lankan calendar days'}}
export function startRelationshipClock(){clearTimeout(clock);updateRelationship();const now=Date.now(),day=86400000;clock=setTimeout(startRelationshipClock,day-((now+19800000)%day)+100)}

if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(!document.hidden)startRelationshipClock()});
