// Keep restored drafts, reply/edit changes and resized phone layouts readable.
let observed,observer,lastWidth=0;
export function fitComposer(input){
 if(!input?.isConnected)return;
 const hint=matchMedia('(max-width:700px)').matches?'A little thought…':'A little thought, just for you…';
 if(input.placeholder!==hint)input.placeholder=hint;
 input.style.height='auto';
 input.style.height=Math.min(140,input.scrollHeight)+'px';
}
export function observeComposer(input){
 observer?.disconnect();observed=input;lastWidth=0;
 if(!input)return;
 observer??=new ResizeObserver(entries=>{
  const width=entries[0]?.contentRect.width;
  if(width&&width!==lastWidth){lastWidth=width;fitComposer(observed)}
 });
 observer.observe(input.parentElement);fitComposer(input);
 document.fonts.ready.then(()=>{if(observed===input)fitComposer(input)});
}
