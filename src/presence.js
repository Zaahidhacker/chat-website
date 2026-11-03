const options={timeZone:'Asia/Colombo'};
const stamp=new Intl.DateTimeFormat(undefined,{...options,year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const time=new Intl.DateTimeFormat(undefined,{...options,hour:'numeric',minute:'2-digit'});
const day=new Intl.DateTimeFormat('en-CA',{...options,year:'numeric',month:'2-digit',day:'2-digit'});
export function presenceLabel(member,{now=Date.now(),connected=true,live=false}={}){
 if(!member)return {text:'Your person hasn’t joined yet',online:false};
 if(!member.share_presence)return {text:'A little space, just for us',online:false};
 const typing=Date.parse(member.typing_until);
 if(connected&&typing>now&&typing<=now+10000)return {text:'Online · here in our universe',online:true,title:'Actively typing in our conversation.'};
 const seen=Date.parse(member.last_seen);if(!Number.isFinite(seen))return {text:'No recent activity yet',online:false};
 if(seen>now+30000)return {text:'Last seen unavailable',online:false,title:'Your device clock may be out of sync.'};
 const age=Math.max(0,now-seen),online=connected&&live&&age<65000;
 if(online)return {text:'Online · here in our universe',online:true,title:'Connected with the website visible. Connection loss can take about a minute to detect.'};
 const minutes=Math.floor(age/60000),today=day.format(now)===day.format(seen);
 return {text:minutes<1?'Last seen just now':minutes<60?`Last seen ${minutes} min ago`:today?`Last seen today at ${time.format(seen)}`:`Last seen ${stamp.format(seen)}`,online:false,title:stamp.format(seen)+' · Sri Lanka time'};
}
