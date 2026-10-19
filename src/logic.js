export function isConfirmed(m){return !m.pending&&!m.failed&&Number.isFinite(m.seq)}
export function compareMessages(a,b){
 if(isConfirmed(a)!==isConfirmed(b))return isConfirmed(a)?-1:1;
 return a.seq-b.seq||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)
}
export function visibleMessages(messages,cutoff){return messages.filter(m=>(m.seq>cutoff||!isConfirmed(m))&&!m.hidden).sort(compareMessages)}
export function mergeMessages(previous,incoming){
 const map=new Map(previous.map(m=>[m.id,m]));
 for(const m of incoming){const old=map.get(m.id);if(old?.revision&&m.revision&&old.revision>m.revision)continue;map.set(m.id,{...old,...m,pending:false,failed:false})}
 return [...map.values()].sort(compareMessages)
}
export function receiptLabel(m,partner){if(m.failed)return 'Failed';if(m.pending)return 'Sending';if((partner?.last_read||0)>=m.seq)return 'Read';if((partner?.last_delivered||0)>=m.seq)return 'Delivered';return 'Sent'}
export function boundMessages(messages,{limit=200,older=false,favorites=new Set()}={}){
 const confirmed=messages.filter(isConfirmed).sort(compareMessages);
 const keep=new Set((older?confirmed.slice(0,limit):confirmed.slice(-limit)).map(m=>m.id));
 return messages.filter(m=>!isConfirmed(m)||keep.has(m.id)||favorites.has(m.id)).sort(compareMessages)
}
