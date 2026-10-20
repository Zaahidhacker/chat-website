export const MOVING_MS=10000,STILL_MS=60000,FRESH_MS=75000;
export function fixAge(sample,now=Date.now()){
 const time=Date.parse(sample);if(!Number.isFinite(time))return 'time unavailable';
 const seconds=Math.max(0,Math.floor((now-time)/1000));
 if(seconds<10)return 'just now';if(seconds<60)return `${seconds} seconds ago`;
 const minutes=Math.floor(seconds/60);if(minutes<60)return `${minutes} minute${minutes===1?'':'s'} ago`;
 const hours=Math.floor(minutes/60);if(hours<24)return `${hours} hour${hours===1?'':'s'} ago`;
 const days=Math.floor(hours/24);return `${days} day${days===1?'':'s'} ago`;
}
export function distance(a,b){const rad=Math.PI/180,dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad;const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))}
export function positionSample(position,now=Date.now()){
 const c=position?.coords,t=position?.timestamp;
 if(!c||![c.latitude,c.longitude,c.accuracy,t].every(Number.isFinite)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||c.accuracy<0||c.accuracy>100000||now-t>45000||t-now>10000)return null;
 return {latitude:c.latitude,longitude:c.longitude,accuracy:c.accuracy,sampled_at:new Date(t).toISOString()};
}
export function publishDelay(last,next,now=Date.now(),sentAt=0){
 if(!last)return 0;
 const moved=distance(last,next)>=Math.max(15,Math.max(last.accuracy,next.accuracy)*.7);
 const improved=next.accuracy<last.accuracy*.5;
 return Math.max(0,(moved||improved?MOVING_MS:STILL_MS)-(now-sentAt));
}
export function locationStatus(row,{now=Date.now(),online=true,connected=true}={}){
 if(!row||row.mode==='stopped')return 'Not sharing';
 if(new Date(row.expires_at).getTime()<=now)return 'Sharing ended';
 if(row.mode==='paused')return 'Paused · last known';
 if(!online||!connected)return 'Connection interrupted · last known';
 if(!row.sampled_at)return 'Waiting for a location';
 if(now-new Date(row.sampled_at).getTime()>FRESH_MS||now-new Date(row.received_at).getTime()>FRESH_MS)return 'No recent update · last known';
 return 'Sharing · updated recently';
}
export function visiblePoint(row,now=Date.now()){return !!row&&row.mode!=='stopped'&&new Date(row.expires_at).getTime()>now&&Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)}
