import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import webpush from 'npm:web-push@3.6.7';
import { timingSafeEqual } from 'node:crypto';
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const service=createClient(Deno.env.get('SUPABASE_URL')!,secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const {data:config,error}=await service.rpc('universe_push_server_config');
  if(error||!config?.enabled)return json({error:'Push unavailable'},503);
  const provided=new TextEncoder().encode(req.headers.get('x-universe-webhook')||'');
  const expected=new TextEncoder().encode(config.webhookSecret);
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return json({error:'Unauthorized'},401);
  const {messageId,callId}=await req.json();
  if(callId!==undefined){
   if(typeof callId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId))return json({error:'Invalid call'},400);
   const {data:call,error:callError}=await service.from('universe_calls').select('id,recipient,state,expires_at').eq('id',callId).maybeSingle();
   if(callError)throw callError;if(!call)return json({sent:0});
   const kind=call.state==='calling'&&Date.parse(call.expires_at)>Date.now()?'invite':'end';
   const {data:devices,error:devicesError}=await service.from('universe_push_subscriptions').select('endpoint,user_id,p256dh,auth').eq('user_id',call.recipient);
   if(devicesError)throw devicesError;
   const outcomes=await Promise.all((devices||[]).map(async sub=>{
    const {data:claimed,error:claimError}=await service.rpc('universe_call_push_claim',{mid:call.id,ep:sub.endpoint,event_kind:kind});
    if(claimError||!claimed)return false;
    let ok=false;
    try{
     const ttl=kind==='invite'?Math.max(1,Math.min(60,Math.ceil((Date.parse(call.expires_at)-Date.now())/1000))):60;
     await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({userId:sub.user_id,callId:call.id,kind,expiresAt:call.expires_at}),{
      vapidDetails:{subject:'https://chat-website-brown.vercel.app',publicKey:config.publicKey,privateKey:config.privateKey},TTL:ttl,urgency:'high',timeout:8000,
     });ok=true;
    }catch(error){
     if(error.statusCode===404||error.statusCode===410)await service.from('universe_push_subscriptions').delete().eq('endpoint',sub.endpoint);
     console.warn('Call push provider rejected delivery',{status:error.statusCode||0});
    }
    await service.rpc('universe_call_push_finish',{mid:call.id,ep:sub.endpoint,event_kind:kind,ok});return ok;
   }));
   return json({sent:outcomes.filter(Boolean).length});
  }
  if(typeof messageId!=='string'||!/^[0-9a-f-]{36}$/i.test(messageId))return json({error:'Invalid message'},400);
  // Look up authoritative sender. Never trust a recipient or message body in the webhook.
  const {data:message,error:messageError}=await service.from('universe_messages').select('id,sender,deleted').eq('id',messageId).maybeSingle();
  if(messageError)throw messageError;
  if(!message||message.deleted)return json({sent:0});
  const {data:subs,error:subError}=await service.from('universe_push_subscriptions').select('endpoint,user_id,p256dh,auth').neq('user_id',message.sender);
  if(subError)throw subError;
  const outcomes=await Promise.all((subs||[]).map(async sub=>{
   const {data:claimed,error:claimError}=await service.rpc('universe_push_claim',{mid:message.id,ep:sub.endpoint});
   if(claimError||!claimed)return false;
   let ok=false;
   try{
    await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({userId:sub.user_id,messageId:message.id}),{
     vapidDetails:{subject:'https://chat-website-brown.vercel.app',publicKey:config.publicKey,privateKey:config.privateKey},TTL:3600,urgency:'high',timeout:8000,
    });ok=true;
   }catch(error){
    if(error.statusCode===404||error.statusCode===410)await service.from('universe_push_subscriptions').delete().eq('endpoint',sub.endpoint);
    // Never log endpoint tokens, credentials or private message data.
    console.warn('Push provider rejected delivery',{status:error.statusCode||0});
   }
   await service.rpc('universe_push_finish',{mid:message.id,ep:sub.endpoint,ok});return ok;
  }));
  return json({sent:outcomes.filter(Boolean).length});
 }catch{console.error('Push dispatch unavailable');return json({error:'Dispatch unavailable'},503)}
});
