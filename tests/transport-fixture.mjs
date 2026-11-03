// TEST ONLY: deterministic Supabase HTTP/WebSocket fixture. Never bundled or deployed.
// Verifies the real UI and SDK in two isolated browsers, without claiming live transport.
export const users=[
 {id:'10000000-0000-0000-0000-000000000001',email:'boy@test.invalid',name:'Zaahid'},
 {id:'10000000-0000-0000-0000-000000000002',email:'girl@test.invalid',name:'Layaana'}
];
export function createFixture(seed=350,{sessionSeconds=3600}={}){
 let sequence=0,revision=0;const sockets=new Set(),requests=[],messages=[];
 const presenceEvents=[];
 const transport={inboundBytes:0,outboundBytes:0};
 const members=users.map((u,i)=>({user_id:u.id,name:u.name,slot:i+1,share_presence:true,last_seen:null,typing_until:null,last_delivered:0,last_read:0}));
 const preferences=new Map(users.map(u=>[u.id,{user_id:u.id,cleared_through:0,theme:'dark'}]));
 const favorites=new Map(users.map(u=>[u.id,new Set()])),hidden=new Map(users.map(u=>[u.id,new Set()]));
 const reactions=[];let loseNextResponse=false;const photos=new Map(),objects=new Map(),voices=new Map(),gardenEvents=new Map(),gardenAnswers=new Map();let failPhotoUpload=false;
 const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const gardenState=uid=>({day:day(),xp:[...gardenEvents.values()].reduce((n,e)=>n+e.points,0),done:[...gardenEvents.values()].filter(e=>e.user_id===uid).map(e=>e.kind),care:[...gardenEvents.values()].filter(e=>['water','feed'].includes(e.kind)),answers:[...gardenAnswers.values()].filter(a=>a.user_id===uid||gardenAnswers.has(uid)),partnerAnswered:[...gardenAnswers.values()].some(a=>a.user_id!==uid),memories:[]});
 const jwt=user=>[btoa(JSON.stringify({alg:'HS256',typ:'JWT'})),btoa(JSON.stringify({sub:user.id,email:user.email,role:'authenticated',exp:Math.floor(Date.now()/1000)+sessionSeconds})),btoa('test-only')].join('.');
 function identity(token){try{return JSON.parse(atob(token.split('.')[1])).sub}catch{return null}}
 function canView(m,uid){return members.some(u=>u.user_id===uid)&&!hidden.get(uid).has(m.id)&&(m.seq>preferences.get(uid).cleared_through||favorites.get(uid).has(m.id))}
 function event(table,type,record,old={}){
  for(const ws of sockets){if(ws.paused)continue;
   if(table==='universe_messages'&&!canView(record,ws.uid))continue;
   if(['universe_preferences','universe_hidden','universe_favorites'].includes(table)&&(record.user_id||old.user_id)!==ws.uid)continue;
   for(const [topic,channel] of ws.channels){
    const subs=channel.subscriptions.filter(s=>s.table===table&&(s.event==='*'||s.event===type));if(!subs.length)continue;
    ws.send([null,null,topic,'postgres_changes',{ids:subs.map(s=>s.id),data:{schema:'public',table,type,commit_timestamp:new Date().toISOString(),columns:[],record,old_record:old,errors:null}}]);
   }
  }
 }
 function presenceState(topic){const state={};for(const ws of sockets){const c=ws.channels.get(topic);if(c?.tracked){(state[c.key]??={metas:[]}).metas.push(c.tracked)}}return state}
 function presenceDiff(topic,joins={},leaves={}){for(const ws of sockets)if(!ws.paused&&ws.channels.has(topic))ws.send([null,null,topic,'presence_diff',{joins,leaves}])}
 function untrack(ws,topic){const c=ws.channels.get(topic);if(c?.tracked){const old=c.tracked;c.tracked=null;presenceDiff(topic,{}, {[c.key]:{metas:[old]}})}}
 function add(sender,body,id=crypto.randomUUID(),reply=null){const old=messages.find(m=>m.id===id);if(old)return old;const m={id,sender,body,seq:++sequence,revision:++revision,created_at:new Date().toISOString(),edited_at:null,deleted:false,reply_to:reply};messages.push(m);event('universe_messages','INSERT',m);return m}
 for(let i=1;i<=seed;i++)add(users[i%2].id,`Earlier little moment ${i}`);
 async function install(context){
  await context.route('https://jczsnrzqocstbpsgwkdy.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   const body=(req.headers()['content-type']||'').includes('application/json')?(req.postDataJSON()||{}):{};const uid=identity((req.headers().authorization||'').replace('Bearer ',''));
   const headers={'access-control-allow-origin':'*','content-type':'application/json'};
   let data=null,status=200;
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...headers,'access-control-allow-headers':'*','access-control-allow-methods':'*'}});return}
   if(path.startsWith('/storage/v1/object/')){
    const parts=path.replace('/storage/v1/object/','').split('/');if(parts[0]==='authenticated')parts.shift();const bucket=parts.shift(),objectPath=parts.join('/'),record=[...photos.values()].find(p=>p.path===objectPath);const stored=objects.get(bucket+':'+objectPath);let allowed=!!uid&&!!record&&(record.owner_id===uid&&!record.sent||record.sent&&canView(messages.find(m=>m.id===record.id),uid));
    requests.push({path,method:req.method(),uid,at:Date.now()});
    if(req.method()==='POST'){
     if(!uid||!record||record.owner_id!==uid||record.sent){await route.fulfill({status:403,headers,body:JSON.stringify({message:'Forbidden'})});return}
     if(stored){await route.fulfill({status:409,headers,body:JSON.stringify({statusCode:'409',message:'Already exists'})});return}
     if(failPhotoUpload){failPhotoUpload=false;await route.fulfill({status:503,headers,body:JSON.stringify({message:'Test interrupted upload'})});return}
     const bytes=req.postDataBuffer();if(bytes.length>(bucket==='universe-thumbs'?32768:524288)){await route.fulfill({status:413,headers,body:'{}'});return}objects.set(bucket+':'+objectPath,bytes);await route.fulfill({status:200,headers,body:JSON.stringify({Key:bucket+'/'+objectPath})});return;
    }
    if(!allowed||!stored){await route.fulfill({status:403,headers,body:'{}'});return}
    await route.fulfill({status:200,headers:{...headers,'content-type':'image/jpeg'},body:stored});return;
   }
   if(path==='/auth/v1/token'){
    const u=users.find(u=>u.email===body.email||body.refresh_token==='test-refresh-'+u.id);if(!u){data={msg:'Invalid login credentials'};status=400}else data={access_token:jwt(u),refresh_token:'test-refresh-'+u.id,token_type:'bearer',expires_in:sessionSeconds,expires_at:Math.floor(Date.now()/1000)+sessionSeconds,user:{id:u.id,email:u.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()}};
   }else if(path==='/auth/v1/logout'){data={};}
   else if(!uid){status=401;data={message:'Not authenticated'};}
   else if(path.endsWith('/rpc/universe_sync_state'))data={members,preferences:preferences.get(uid),favorites:[...favorites.get(uid)],hidden:[...hidden.get(uid)],revision};
   else if(path.endsWith('/rpc/universe_photo_reserve')){
    data=photos.get(body.mid);if(!data){data={id:body.mid,owner_id:uid,path:uid+'/'+body.mid+'.jpg',bytes:body.full_bytes,thumb_bytes:body.preview_bytes,width:body.w,height:body.h,sent:false};photos.set(body.mid,data)}
   }else if(path.endsWith('/rpc/universe_send_photo')){
    const p=photos.get(body.mid);if(!p||p.owner_id!==uid||!objects.has('universe-photos:'+p.path)||!objects.has('universe-thumbs:'+p.path)){status=400;data={message:'Incomplete photo'}}else{p.sent=true;data=add(uid,'📷 '+(body.caption||'Photo'),body.mid,body.reply);event('universe_photos','UPDATE',p);if(loseNextResponse){loseNextResponse=false;status=503;data={message:'Acknowledgement lost after photo commit'}}}
   }else if(path.endsWith('/universe_photos')){const ids=url.searchParams.get('id');const set=ids?.startsWith('in.(')?new Set(ids.slice(4,-1).split(',')):null;data=[...photos.values()].filter(p=>(!set||set.has(p.id))&&(p.owner_id===uid&&!p.sent||p.sent&&canView(messages.find(m=>m.id===p.id),uid)))}
   else if(path.endsWith('/rpc/universe_send_voice')){if(!voices.has(body.mid))voices.set(body.mid,{id:body.mid,audio:body.encoded,mime:body.mime_type,expires_at:new Date(Date.now()+48*3600000).toISOString()});data=add(uid,'🎙 Voice note · expires in 48 hours',body.mid,body.reply);if(loseNextResponse){loseNextResponse=false;status=503;data={message:'Acknowledgement lost after voice commit'}}}
   else if(path.endsWith('/universe_voice')){const id=url.searchParams.get('id')?.slice(3),voice=voices.get(id),m=messages.find(m=>m.id===id);data=voice&&Date.parse(voice.expires_at)>Date.now()&&m&&!m.deleted&&canView(m,uid)?[voice]:[]}
   else if(path.endsWith('/rpc/universe_garden_state'))data=gardenState(uid);
   else if(path.endsWith('/rpc/universe_garden_act')){const points={feed:3,water:3,question:5,pairs:4,code:4,moon:1};const key=uid+':'+body.activity;if(points[body.activity]&&!gardenEvents.has(key))gardenEvents.set(key,{user_id:uid,kind:body.activity,points:points[body.activity]});if(body.activity==='question'&&!gardenAnswers.has(uid))gardenAnswers.set(uid,{user_id:uid,day:day(),answer:body.note});data=gardenState(uid)}
   else if(path.endsWith('/rpc/universe_send')){
    data=add(uid,body.content,body.mid,body.reply);if(loseNextResponse){loseNextResponse=false;status=503;data={message:'Test: acknowledgement lost after commit'}}
   }else if(path.endsWith('/rpc/universe_change')){
    const m=messages.find(m=>m.id===body.mid&&m.sender===uid);if(!m){status=403;data={message:'Not your message'}}else{m.body=body.content||'';m.deleted=body.content===null;m.edited_at=new Date().toISOString();m.revision=++revision;event('universe_messages','UPDATE',m)}
   }else if(path.endsWith('/rpc/universe_receipt')){
    const m=members.find(m=>m.user_id===uid);const before=JSON.stringify(m);m.last_delivered=Math.max(m.last_delivered,Math.min(body.delivered,sequence));m.last_read=Math.max(m.last_read,Math.min(body.seen,body.delivered,sequence));if(m.share_presence&&(!m.last_seen||Date.now()-new Date(m.last_seen)>25000))m.last_seen=new Date().toISOString();if(before!==JSON.stringify(m))event('universe_members','UPDATE',m);
   }else if(path.endsWith('/rpc/universe_presence_leave')){const m=members.find(m=>m.user_id===uid);if(m.share_presence){m.last_seen=new Date().toISOString();m.typing_until=null;event('universe_members','UPDATE',m)}}else if(path.endsWith('/rpc/universe_typing')){
    const m=members.find(m=>m.user_id===uid);if(m.share_presence){m.typing_until=new Date(Date.now()+4000).toISOString();event('universe_members','UPDATE',m)}
   }else if(path.endsWith('/rpc/universe_clear')){preferences.get(uid).cleared_through=sequence;data=sequence;event('universe_preferences','UPDATE',preferences.get(uid))}
   else if(path.endsWith('/rpc/universe_profile')){const m=members.find(m=>m.user_id===uid);m.name=body.display_name;m.share_presence=body.presence;preferences.get(uid).theme=body.selected_theme;event('universe_members','UPDATE',m);event('universe_preferences','UPDATE',preferences.get(uid))}
   else if(path.endsWith('/universe_messages')){
    data=messages.filter(m=>canView(m,uid));
    for(const name of ['seq','revision'])for(const condition of url.searchParams.getAll(name)){
     const [op,n]=condition.split('.');data=data.filter(m=>op==='gt'?m[name]>+n:op==='lt'?m[name]<+n:op==='lte'?m[name]<=+n:m[name]===+n);
    }
    const ids=url.searchParams.get('id');if(ids?.startsWith('in.(')){const set=new Set(ids.slice(4,-1).split(','));data=data.filter(m=>set.has(m.id))}
    const [field,dir]=(url.searchParams.get('order')||'seq.asc').split('.');data.sort((a,b)=>(a[field]-b[field])*(dir==='desc'?-1:1));data=data.slice(0,+(url.searchParams.get('limit')||10000));
   }else if(path.endsWith('/universe_reactions')){
    if(req.method()==='GET')data=reactions.filter(r=>canView(messages.find(m=>m.id===r.message_id),uid));
    else{const old=reactions.find(r=>r.user_id===uid&&r.message_id===body.message_id);if(old)Object.assign(old,body);else reactions.push(body);event('universe_reactions',old?'UPDATE':'INSERT',body)}
   }else if(path.endsWith('/universe_favorites')){
    if(req.method()==='DELETE'){const id=url.searchParams.get('message_id').slice(3);favorites.get(uid).delete(id);event('universe_favorites','DELETE',{}, {user_id:uid,message_id:id})}
    else if(req.method()==='POST'){favorites.get(uid).add(body.message_id);event('universe_favorites','INSERT',body)}
    else data=[...favorites.get(uid)].map(message_id=>({user_id:uid,message_id}));
   }else if(path.endsWith('/universe_hidden')){hidden.get(uid).add(body.message_id);event('universe_hidden','INSERT',body)}
   else{status=404;data={message:'Unimplemented fixture: '+path}}
   const serialized=JSON.stringify(data);requests.push({path,method:req.method(),uid,bytes:Buffer.byteLength(serialized),at:Date.now()});
   await route.fulfill({status,headers,body:serialized});
  });
  await context.routeWebSocket('wss://jczsnrzqocstbpsgwkdy.supabase.co/**',route=>{
   const ws={route,uid:null,channels:new Map(),paused:false,arrayProtocol:false,send(parts){const [join_ref,ref,topic,event,payload]=parts;const encoded=JSON.stringify(ws.arrayProtocol?parts:{join_ref,ref,topic,event,payload});transport.outboundBytes+=Buffer.byteLength(encoded);route.send(encoded)}};sockets.add(ws);
   route.onMessage(raw=>{transport.inboundBytes+=Buffer.byteLength(String(raw));const parsed=JSON.parse(String(raw));ws.arrayProtocol=Array.isArray(parsed);const [joinRef,ref,topic,event,payload]=ws.arrayProtocol?parsed:[parsed.join_ref,parsed.ref,parsed.topic,parsed.event,parsed.payload];
    if(event==='phx_join'){
     ws.uid=identity(payload.access_token);const subscriptions=(payload.config.postgres_changes||[]).map((s,i)=>({...s,id:i+1}));const privatePresence=topic==='realtime:universe-presence:two';if(privatePresence&&(!payload.config.private||!members.some(m=>m.user_id===ws.uid))){ws.send([joinRef,ref,topic,'phx_reply',{status:'error',response:{reason:'Forbidden'}}]);return}ws.channels.set(topic,{subscriptions,key:payload.config.presence?.key,tracked:null});if(privatePresence)presenceEvents.push({action:'join',uid:ws.uid,private:payload.config.private});
     ws.send([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:subscriptions}}]);if(topic==='realtime:universe-presence:two')ws.send([joinRef,null,topic,'presence_state',presenceState(topic)]);
    }else if(event==='presence'){const c=ws.channels.get(topic);if(payload.event==='track'&&c){untrack(ws,topic);c.tracked={...payload.payload,phx_ref:crypto.randomUUID()};presenceEvents.push({action:'track',uid:ws.uid});presenceDiff(topic,{[c.key]:{metas:[c.tracked]}})}else if(payload.event==='untrack'){presenceEvents.push({action:'untrack',uid:ws.uid});untrack(ws,topic)}ws.send([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]);
    }else if(event==='heartbeat'||event==='phx_leave'){if(event==='phx_leave'){untrack(ws,topic);ws.channels.delete(topic)}ws.send([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]);}
   });route.onClose(()=>{sockets.delete(ws);for(const topic of ws.channels.keys())untrack(ws,topic)});
  });
 }
 return {install,users,messages,members,requests,presenceEvents,transport,add,preferences,favorites,hidden,reactions,
  broadcast(table,type,record){event(table,type,record)},photos,objects,voices,gardenEvents,gardenAnswers,failNextPhotoUpload(){failPhotoUpload=true},
  pause(uid,paused=true){for(const ws of sockets)if(ws.uid===uid)ws.paused=paused},
  loseNextAcknowledgement(){loseNextResponse=true},
  editOffline(id,body){const m=messages.find(m=>m.id===id);m.body=body;m.revision=++revision;m.edited_at=new Date().toISOString();return m}
 };
}
