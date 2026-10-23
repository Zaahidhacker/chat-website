export const SECRET_DURATION=8000;
export const SECRET_LEAD=900;
export function containsThreeHearts(body){
 if(typeof body!=='string'||!body.includes('❤️❤️❤️'))return false;
 return [...body.matchAll(/(?:❤\uFE0F?)+/gu)].some(m=>m[0]==='❤️❤️❤️'&&body[m.index-1]!=='\u200d'&&body[m.index+m[0].length]!=='\u200d');
}
export function createSecretGate({now=Date.now,storage}={}){
 let account=null,seen=new Set();
 return {
  accept(message,user){
   if(!user||!message?.id||message.pending||message.failed||message.deleted||message.edited_at||!containsThreeHearts(message.body))return null;
   if(account!==user){account=user;try{seen=new Set(JSON.parse(storage?.getItem('universe-hearts-'+user)||'[]').slice(-128))}catch{seen=new Set()}}
   if(seen.has(message.id))return null;
   const created=Date.parse(message.created_at),age=now()-created;
   if(!Number.isFinite(created)||age>SECRET_DURATION||age < -2000)return null;
   seen.add(message.id);while(seen.size>128)seen.delete(seen.values().next().value);
   try{storage?.setItem('universe-hearts-'+user,JSON.stringify([...seen]))}catch{}
   return {id:message.id,startAt:created+SECRET_LEAD};
  }
 };
}
