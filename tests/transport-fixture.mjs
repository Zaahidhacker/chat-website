// TEST ONLY: deterministic Supabase HTTP/WebSocket fixture. Never bundled or deployed.
// Verifies the real UI and SDK in two isolated browsers, without claiming live transport.
export const users=[
 {id:'10000000-0000-0000-0000-000000000001',email:'boy@test.invalid',name:'Zaahid'},
 {id:'10000000-0000-0000-0000-000000000002',email:'girl@test.invalid',name:'Layaana'}
];
export function createFixture(seed=350){
 let sequence=0,revision=0;const sockets=new Set(),requests=[],messages=[];
 const members=users.map((u,i)=>({user_id:u.id,name:u.name,slot:i+1,share_presence:true,last_seen:null,typing_until:null,last_delivered:0,last_read:0}));
 const preferences=new Map(users.map(u=>[u.id,{user_id:u.id,cleared_through:0,theme:'dark'}]));
 const favorites=new Map(users.map(u=>[u.id,new Set()])),hidden=new Map(users.map(u=>[u.id,new Set()]));
 const reactions=[];let loseNextResponse=false;
 const jwt=user=>[btoa(JSON.stringify({alg:'HS256',typ:'JWT'})),btoa(JSON.stringify({sub:user.id,email:user.email,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})),btoa('test-only')].join('.');
 function identity(token){try{return JSON.parse(atob(token.split('.')[1])).sub}catch{return null}}
 function canView(m,uid){return members.some(u=>u.user_id===uid)&&!hidden.get(uid).has(m.id)&&(m.seq>preferences.get(uid).cleared_through||favorites.get(uid).has(m.id))}
 function event(table,type,record,old={}){
  for(const ws of sockets){if(ws.paused)continue;
   if(table==='universe_messages'&&!canView(record,ws.uid))continue;
   if(['universe_preferences','universe_hidden','universe_favorites'].includes(table)&&(record.user_id||old.user_id)!==ws.uid)continue;
   const subs=ws.subscriptions.filter(s=>s.table===table&&(s.event==='*'||s.event===type));if(!subs.length)continue;
   ws.send([null,null,ws.topic,'postgres_changes',{ids:subs.map(s=>s.id),data:{schema:'public',table,type,commit_timestamp:new Date().toISOString(),columns:[],record,old_record:old,errors:null}}]);
  }
 }
 function add(sender,body,id=crypto.randomUUID(),reply=null){const old=messages.find(m=>m.id===id);if(old)return old;const m={id,sender,body,seq:++sequence,revision:++revision,created_at:new Date().toISOString(),edited_at:null,deleted:false,reply_to:reply};messages.push(m);event('universe_messages','INSERT',m);return m}
 for(let i=1;i<=seed;i++)add(users[i%2].id,`Earlier little moment ${i}`);
 async function install(context){
  await context.route('https://jczsnrzqocstbpsgwkdy.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   const body=req.postDataJSON()||{};const uid=identity((req.headers().authorization||'').replace('Bearer ',''));
   const headers={'access-control-allow-origin':'*','content-type':'application/json'};
   let data=null,status=200;
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...headers,'access-control-allow-headers':'*','access-control-allow-methods':'*'}});return}
   if(path==='/auth/v1/token'){
    const u=users.find(u=>u.email===body.email||body.refresh_token==='test-refresh-'+u.id);if(!u){data={msg:'Invalid login credentials'};status=400}else data={access_token:jwt(u),refresh_token:'test-refresh-'+u.id,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:u.id,email:u.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()}};
   }else if(path==='/auth/v1/logout'){data={};}
   else if(!uid){status=401;data={message:'Not authenticated'};}
   else if(path.endsWith('/rpc/universe_sync_state'))data={members,preferences:preferences.get(uid),favorites:[...favorites.get(uid)],hidden:[...hidden.get(uid)],revision};
   else if(path.endsWith('/rpc/universe_send')){
    data=add(uid,body.content,body.mid,body.reply);if(loseNextResponse){loseNextResponse=false;status=503;data={message:'Test: acknowledgement lost after commit'}}
   }else if(path.endsWith('/rpc/universe_change')){
    const m=messages.find(m=>m.id===body.mid&&m.sender===uid);if(!m){status=403;data={message:'Not your message'}}else{m.body=body.content||'';m.deleted=body.content===null;m.edited_at=new Date().toISOString();m.revision=++revision;event('universe_messages','UPDATE',m)}
   }else if(path.endsWith('/rpc/universe_receipt')){
    const m=members.find(m=>m.user_id===uid);const before=JSON.stringify(m);m.last_delivered=Math.max(m.last_delivered,Math.min(body.delivered,sequence));m.last_read=Math.max(m.last_read,Math.min(body.seen,body.delivered,sequence));if(m.share_presence&&(!m.last_seen||Date.now()-new Date(m.last_seen)>25000))m.last_seen=new Date().toISOString();if(before!==JSON.stringify(m))event('universe_members','UPDATE',m);
   }else if(path.endsWith('/rpc/universe_typing')){
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
   const ws={route,uid:null,topic:null,subscriptions:[],paused:false,arrayProtocol:false,send(parts){const [join_ref,ref,topic,event,payload]=parts;route.send(JSON.stringify(ws.arrayProtocol?parts:{join_ref,ref,topic,event,payload}))}};sockets.add(ws);
   route.onMessage(raw=>{const parsed=JSON.parse(String(raw));ws.arrayProtocol=Array.isArray(parsed);const [joinRef,ref,topic,event,payload]=ws.arrayProtocol?parsed:[parsed.join_ref,parsed.ref,parsed.topic,parsed.event,parsed.payload];
    if(event==='phx_join'){
     ws.uid=identity(payload.access_token);ws.topic=topic;ws.subscriptions=(payload.config.postgres_changes||[]).map((s,i)=>({...s,id:i+1}));
     ws.send([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:ws.subscriptions}}]);
    }else if(event==='heartbeat'||event==='phx_leave')ws.send([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]);
   });route.onClose(()=>sockets.delete(ws));
  });
 }
 return {install,users,messages,members,requests,add,preferences,favorites,hidden,reactions,
  pause(uid,paused=true){for(const ws of sockets)if(ws.uid===uid)ws.paused=paused},
  loseNextAcknowledgement(){loseNextResponse=true},
  editOffline(id,body){const m=messages.find(m=>m.id===id);m.body=body;m.revision=++revision;m.edited_at=new Date().toISOString();return m}
 };
}
