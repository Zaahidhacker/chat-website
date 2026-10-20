const stamp=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const time=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'});
export function presenceLabel(member,{now=Date.now(),connected=true}={}){
 if(!member)return {text:'Your person hasn’t joined yet',online:false};
 if(!member.share_presence)return {text:'A little space, just for us',online:false};
 const seen=Date.parse(member.last_seen);if(!Number.isFinite(seen))return {text:'No recent activity yet',online:false};
 const age=Math.max(0,now-seen),online=connected&&age<65000;
 if(online)return {text:'Online · here in our universe',online:true,title:'Recent activity, updated about every 30 seconds.'};
 const minutes=Math.floor(age/60000),today=new Date(now).toDateString()===new Date(seen).toDateString();
 return {text:minutes<1?'Last seen just now':minutes<60?`Last seen ${minutes} min ago`:today?`Last seen today at ${time.format(seen)}`:`Last seen ${stamp.format(seen)}`,online:false,title:stamp.format(seen)};
}
