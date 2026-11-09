import {move,timing} from './motion-system.js';
let input,observer,mirror,host,writeFrame=0,lastWidth=0,lastHeight=0;
export function fitComposer(el){if(el!==input||!mirror)return;mirror.textContent=(el.value||'')+'\u200b';const send=el.form?.querySelector('.send'),ready=!!el.value.trim();if(send&&send.hasAttribute('data-has-text')!==ready){send.toggleAttribute('data-has-text',ready);move(send.querySelector('.icon'),[{transform:ready?'rotate(-8deg)':'rotate(4deg)'},{transform:'none'}],{duration:timing.micro})}}
export function observeComposer(el){
 observer?.disconnect();cancelAnimationFrame(writeFrame);host?.remove();mirror=null;host=null;input=el;lastWidth=0;lastHeight=0;if(!el)return;
 const style=getComputedStyle(el);host=document.createElement('div');host.setAttribute('aria-hidden','true');host.inert=true;mirror=document.createElement('div');host.attachShadow({mode:'closed'}).append(mirror);
 mirror.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:content-box;height:auto;min-height:0;contain:layout style;';
 for(const p of ['font','letterSpacing','lineHeight','paddingTop','paddingBottom','wordSpacing','textIndent','tabSize'])mirror.style[p]=style[p];
 const padding=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
 document.body.append(host);
 observer=new ResizeObserver(entries=>{
  if(input!==el||!el.isConnected)return;
  let height;
  for(const entry of entries){
   if(entry.target===el&&entry.contentRect.width!==lastWidth){lastWidth=entry.contentRect.width;const hint=matchMedia('(max-width:700px)').matches?'A little thought…':'A little thought, just for you…';if(el.placeholder!==hint)el.placeholder=hint}
   if(entry.target===mirror)height=Math.min(140,Math.ceil(entry.contentRect.height+padding));
  }
  if(height)lastHeight=height;cancelAnimationFrame(writeFrame);writeFrame=requestAnimationFrame(()=>{if(input!==el||!mirror)return;mirror.style.width=lastWidth+'px';if(lastHeight)el.style.height=lastHeight+'px'});
 });
 el.form?.querySelector('.send')?.toggleAttribute('data-has-text',!!el.value.trim());observer.observe(el);observer.observe(mirror);fitComposer(el);
}
