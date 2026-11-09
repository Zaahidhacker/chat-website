let log,observer,anchor,frame=0,settle=0,scheduled=false,restoring=false,ready=false,pin=false;
const root=document.documentElement,vv=window.visualViewport;
function snapshot(){
 if(document.hidden||!log?.isConnected||restoring)return;
 const top=log.scrollTop,height=log.clientHeight,bottom=log.scrollHeight-top-height;
 if(pin&&bottom>=40)return;pin=false;const r=log.getBoundingClientRect();let node;
 let lo=0,hi=log.children.length;while(lo<hi){const mid=(lo+hi)>>1;if(log.children[mid].getBoundingClientRect().bottom>r.top+1)hi=mid;else lo=mid+1}node=log.children[lo];
 anchor={bottom:bottom<40,top,node,key:node?.dataset.logKey,offset:node?node.getBoundingClientRect().top:0};
}
function restore(){
 if(document.hidden||!ready||!log?.isConnected||!anchor)return;restoring=true;
 if(!anchor.node?.isConnected&&anchor.key)anchor.node=[...log.children].find(el=>el.dataset.logKey===anchor.key);
 if(anchor.bottom)log.scrollTop=log.scrollHeight;
 else if(anchor.node?.isConnected)log.scrollTop+=anchor.node.getBoundingClientRect().top-anchor.offset;
 else log.scrollTop=anchor.top;
 requestAnimationFrame(()=>{restoring=false;snapshot()});
}
export function bindViewport(){
 ready=false;pin=false;observer?.disconnect();log?.removeEventListener('scroll',scroll);log=document.querySelector('#messages');anchor=null;
 if(log){snapshot();log.addEventListener('scroll',scroll,{passive:true});observer??=new ResizeObserver(restore);observer.observe(log);const current=log;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(log===current){snapshot();ready=true}}))}schedule();
}
function scroll(){if(scheduled||restoring)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;snapshot()})}
function update(){
 frame=0;if(document.hidden||vv&&Math.abs(vv.scale-1)>.01)return;
 const height=vv?.height??innerHeight,y=vv?.offsetTop||0;if(!Number.isFinite(height)||height<=0)return;
 const h=`${Math.round(height*100)/100}px`,offset=`${Math.round(y*100)/100}px`;
 if(root.style.getPropertyValue('--app-height')!==h)root.style.setProperty('--app-height',h);
 if(root.style.getPropertyValue('--app-y')!==offset)root.style.setProperty('--app-y',offset);
 root.dataset.viewportMoving='';cancelAnimationFrame(settle);settle=requestAnimationFrame(()=>{settle=requestAnimationFrame(()=>delete root.dataset.viewportMoving)});
}
function schedule(){if(!frame)frame=requestAnimationFrame(update)}
vv?.addEventListener('resize',schedule,{passive:true});vv?.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',schedule,{passive:true});window.addEventListener('pageshow',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});schedule();

export function pinViewport(){if(log){pin=true;anchor={bottom:true,top:0}}}

export function unbindViewport(){observer?.disconnect();log?.removeEventListener('scroll',scroll);log=null;anchor=null;ready=false;pin=false}
