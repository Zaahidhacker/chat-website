// Test-only call transport; production SQL is verified separately in rollback.
export function callFixture(transport){
 const calls=new Map(),signals=[],requests=[];let sequence=0,delayStart=0;
 const emit=c=>transport.broadcast('universe_calls','UPDATE',structuredClone(c));
 const update=c=>{c.updated_at=new Date().toISOString();emit(c);return c};
 async function install(context){
  await context.route('https://jczsnrzqocstbpsgwkdy.supabase.co/rest/v1/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(!/universe_call/.test(path))return route.fallback();
   const headers={'access-control-allow-origin':'*','content-type':'application/json'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{...headers,'access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   const body=req.postDataJSON()||{};let uid;try{uid=JSON.parse(atob((req.headers().authorization||'').split('.')[1])).sub}catch{}
   requests.push({path,uid,body});let data=null,status=200;
   try{
    if(!uid)throw Error('Not authenticated');
    if(path.endsWith('/rpc/universe_call_ice'))data={iceServers:JSON.parse(process.env.CALL_TEST_ICE_SERVERS||'[]'),relayConfigured:!!process.env.CALL_TEST_ICE_SERVERS};
    else if(path.endsWith('/rpc/universe_call_start')){
     data=calls.get(body.mid);
     if(!data){if([...calls.values()].some(c=>['calling','accepted'].includes(c.state)&&Date.parse(c.expires_at)>Date.now()))throw Error('A call is already in progress.');
      data={id:body.mid,caller:uid,recipient:transport.users.find(u=>u.id!==uid).id,caller_device:body.device,recipient_device:null,state:'calling',offer:body.sdp,answer:null,ring_until:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()};calls.set(data.id,data);emit(data)}
     if(delayStart)await new Promise(resolve=>setTimeout(resolve,delayStart));
    }else if(path.endsWith('/rpc/universe_call_update')){
     data=calls.get(body.mid);if(!data)throw Error('Call unavailable');
     if(['calling','accepted'].includes(data.state)){
      const own=uid===data.caller&&body.device===data.caller_device||uid===data.recipient&&body.device===data.recipient_device;
      if(Date.parse(data.expires_at)<=Date.now()){data.state='missed'}
      else if(body.action==='ring'&&data.recipient===uid&&data.state==='calling'){data.ring_until=new Date(Date.now()+25000).toISOString();data.ring_device=body.device}
      else if(body.action==='away'&&data.recipient===uid&&data.state==='calling'){if(data.ring_device===body.device)data.ring_until=null}
      else if(body.action==='accept'&&data.recipient===uid&&data.state==='calling'){Object.assign(data,{state:'accepted',answer:body.sdp,recipient_device:body.device,expires_at:new Date(Date.now()+90000).toISOString()})}
      else if(body.action==='end'&&own){data.state='ended'}
      else if(body.action==='decline'&&data.recipient===uid&&data.state==='calling'){data.state='declined'}
      else if(body.action==='heartbeat'&&own){data.expires_at=new Date(Date.now()+90000).toISOString()}
      else throw Error('This call was answered elsewhere or is no longer available');
      if(!['calling','accepted'].includes(data.state)){data.offer=null;data.answer=null}update(data);
     }
    }else if(path.endsWith('/rpc/universe_call_signal')){
     const call=calls.get(body.mid);if(!call)throw Error('Call unavailable');
     const signal={id:++sequence,call_id:body.mid,sender:uid,recipient:uid===call.caller?call.recipient:call.caller,payload:{candidate:body.candidate},created_at:new Date().toISOString()};signals.push(signal);transport.broadcast('universe_call_signals','INSERT',signal);
    }else if(path.endsWith('/universe_calls')){
     const id=url.searchParams.get('id')?.slice(3);data=id?calls.get(id):[...calls.values()].filter(c=>['calling','accepted'].includes(c.state)&&Date.parse(c.expires_at)>Date.now()).at(-1);data=data||null;
    }else if(path.endsWith('/universe_call_signals'))data=signals.filter(s=>s.call_id===url.searchParams.get('call_id')?.slice(3));
    else throw Error('Unknown test call request');
   }catch(error){data={message:error.message};status=400}
   await route.fulfill({status,headers,body:JSON.stringify(data)});
  });
 }
 return {calls,signals,requests,install,expire(){const c=[...calls.values()].at(-1);c.expires_at=new Date(Date.now()-1000).toISOString();update(c)},setStartDelay(ms){delayStart=ms}};
}
