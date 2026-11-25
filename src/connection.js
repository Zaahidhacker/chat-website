export function isConnectionError(error) {
 return error?.name === 'AuthRetryableFetchError' || error?.name === 'TypeError' || /failed to fetch|networkerror|network request failed|load failed|timeout|timed out|fetch dynamically imported/i.test(error?.message || '');
}
export function explainError(error) {
 if (isConnectionError(error)) return 'Couldn’t reach our universe. Check your connection, try Wi-Fi or mobile data, then try again. Your account and messages are safe.';
 if (error?.message === 'Invalid login credentials') return 'That email and password didn’t open the door. Please try again.';
 return error?.message || 'Something didn’t go through. Please try again.';
}
// Retry transport failures once for reads and explicitly idempotent operations.
// Never retry enrollment, and never turn a rejected password into a retry loop.
export async function resilientFetch(input, init) {
 const url = String(input instanceof Request ? input.url : input);
 const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
 const safe = !url.includes('/auth/') && (method === 'GET' || /\/rpc\/universe_(sync_state|receipt|send)(?:\?|$)/.test(url));
 for (let attempt = 0; ; attempt++) {
  const controller=new AbortController(),source=init?.signal||(input instanceof Request?input.signal:null);
  const abort=()=>controller.abort(source.reason);
  if(source?.aborted)abort();else source?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Connection timed out.','TimeoutError')),30000);
  try { return await fetch(input instanceof Request?input.clone():input,{...init,keepalive:/\/rpc\/universe_presence_leave$/.test(url)||init?.keepalive,signal:controller.signal}); }
  catch (error) {
   if (!safe || attempt || !navigator.onLine || source?.aborted) throw error;
  }
  finally{clearTimeout(timer);source?.removeEventListener('abort',abort)}
  await new Promise(resolve => setTimeout(resolve, 250));
 }
}
