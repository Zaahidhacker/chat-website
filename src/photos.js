import {compressPhoto} from './photo-codec.js';
import {savePhotoDraft,loadPhotoDrafts,deletePhotoDraft,clearPhotoDrafts} from './photo-outbox.js';
const URL_BASE='https://jczsnrzqocstbpsgwkdy.supabase.co',KEY='sb_publishable_bC-d7dzejgvGCetYD-JjOg_WKEZKJco';
let db,owner,preview,worker,observer,viewerId,zoom=1,epoch=0;
const urls=new Map(),inflight=new Map(),requests=new Set();
function keep(key,blob){if(urls.has(key))return urls.get(key);const value=URL.createObjectURL(blob);urls.set(key,value);while(urls.size>40){const [old,url]=urls.entries().next().value;if(old===viewerId+':full'){urls.delete(old);urls.set(old,url);continue}URL.revokeObjectURL(url);urls.delete(old)}return value}
export function configure(client,userId){if(owner&&owner!==userId)dispose(owner);db=client;owner=userId;if(!document.querySelector('[data-photo-styles]')){const link=document.createElement('link');link.rel='stylesheet';link.href=PHOTO_STYLE_URL;link.dataset.photoStyles='';document.head.append(link)}}
export function cancelPreview(){if(preview?.url)URL.revokeObjectURL(preview.url);preview=null;worker?.terminate();worker=null}
export function dispose(userId){epoch++;cancelPreview();observer?.disconnect();for(const xhr of requests)xhr.abort();requests.clear();for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();inflight.clear();viewerId=null;clearPhotoDrafts(userId).catch(()=>{});try{if(userId)localStorage.removeItem('universe-photo-pending-'+userId)}catch{}owner=null}
async function compress(file){
 if(typeof Worker==='undefined')return compressPhoto(file);
 return new Promise((resolve,reject)=>{
  worker=new Worker(PHOTO_WORKER_URL,{type:'module'});
  worker.onmessage=({data})=>{worker?.terminate();worker=null;data.error?reject(Error(data.error)):resolve(data.photo)};
  worker.onerror=()=>{worker?.terminate();worker=null;reject(Error('Could not process this photo. Please try a smaller JPEG.'))};worker.postMessage({file});
 });
}
export async function prepare(file){cancelPreview();const at=epoch;const photo=await compress(file);if(at!==epoch)throw Error('Photo selection was cancelled.');preview={...photo,url:URL.createObjectURL(photo.full)};return preview}
export function takePreview(){const value=preview;if(!value)throw Error('Select a photo first.');URL.revokeObjectURL(value.url);preview=null;return value}
export function peekPreview(){if(!preview)throw Error('Select a photo first.');return preview}
export const saveDraft=savePhotoDraft,loadDrafts=loadPhotoDrafts,removeDraft=deletePhotoDraft;
async function token(){const {data,error}=await db.auth.getSession();if(error||!data.session)throw Error('Sign in again to share a photo.');return data.session.access_token}
async function upload(bucket,path,blob,onProgress,signalEpoch){
 const access=await token();if(signalEpoch!==epoch)throw Error('Upload cancelled');
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();requests.add(xhr);xhr.open('POST',URL_BASE+'/storage/v1/object/'+bucket+'/'+path);xhr.timeout=120000;
  xhr.setRequestHeader('Authorization','Bearer '+access);xhr.setRequestHeader('apikey',KEY);xhr.setRequestHeader('Content-Type','image/jpeg');xhr.setRequestHeader('Cache-Control','private, max-age=0');
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total)};
  const end=()=>requests.delete(xhr);
  xhr.onload=()=>{end();let data;try{data=JSON.parse(xhr.responseText)}catch{}const code=Number(data?.statusCode||xhr.status);if((xhr.status>=200&&xhr.status<300)||code===409){onProgress(1);resolve()}else reject(Error(data?.message||data?.error||'Photo upload failed. Tap retry.'))};
  xhr.onerror=()=>{end();reject(Error('Connection interrupted. Your photo is saved on this device. Tap retry.'))};xhr.ontimeout=xhr.onerror;xhr.onabort=()=>{end();reject(Error('Upload cancelled'))};xhr.send(blob);
 });
}
export async function send(message,photo,onProgress){
 const at=epoch;
 const {data:record,error}=await db.rpc('universe_photo_reserve',{mid:message.id,full_bytes:photo.full.size,preview_bytes:photo.thumb.size,w:photo.width,h:photo.height});if(error)throw error;
 if(at!==epoch)throw Error('Upload cancelled');
 if(!record.sent){
  const total=photo.full.size+photo.thumb.size;
  await upload('universe-thumbs',record.path,photo.thumb,p=>onProgress(Math.round(p*photo.thumb.size/total*90)),at);
  await upload('universe-photos',record.path,photo.full,p=>onProgress(Math.round((photo.thumb.size+p*photo.full.size)/total*90)),at);
 }
 const result=await db.rpc('universe_send_photo',{mid:message.id,caption:message.body.slice(3),reply:message.reply_to});if(result.error)throw result.error;
 if(at!==epoch)throw Error('Upload cancelled');onProgress(100);return {message:result.data,photo:{...record,sent:true}};
}
export function localThumb(id,blob){return keep(id+':thumb',blob)}
export async function fetchImage(photo,full=false){
 const key=photo.id+(full?':full':':thumb');if(urls.has(key)){const value=urls.get(key);urls.delete(key);urls.set(key,value);return value}
 if(inflight.has(key))return inflight.get(key);
 const at=epoch;const task=(async()=>{const {data,error}=await db.storage.from(full?'universe-photos':'universe-thumbs').download(photo.path);if(error)throw error;if(at!==epoch)throw Error('Photo session ended');return keep(key,data)})();inflight.set(key,task);try{return await task}finally{inflight.delete(key)}
}
export function observe(root,lookup){
 observer?.disconnect();if(!root)return;
 const load=async img=>{const photo=lookup(img.dataset.photoId);if(!photo||img.dataset.loaded)return;img.dataset.loaded='yes';try{img.src=await fetchImage(photo);img.onload=()=>img.closest('.photo-frame')?.classList.add('loaded')}catch{img.dataset.loaded='';img.closest('.photo-frame')?.classList.add('photo-unavailable');img.alt='Photo unavailable. Tap to retry.'}};
 if(!('IntersectionObserver'in window)){for(const img of root.querySelectorAll('[data-photo-id]'))load(img);return}
 observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){load(entry.target);observer.unobserve(entry.target)}},{root:root.id==='messages'?root:null,rootMargin:'120px'});
 for(const img of root.querySelectorAll('[data-photo-id]')){const cached=urls.get(img.dataset.photoId+':thumb');if(cached){img.src=cached;img.dataset.loaded='yes';img.closest('.photo-frame')?.classList.add('loaded')}else observer.observe(img)}
}
export async function show(photo,root){
 viewerId=photo.id;zoom=1;root.innerHTML='<div class="photo-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer"><header><span>Just between us</span><div><button data-action="photo-zoom" aria-label="Zoom photo">＋</button><button data-action="photo-download" aria-label="Download photo">↓</button><button data-action="close-modal" aria-label="Close photo">×</button></div></header><div class="photo-stage"><div class="photo-canvas"><p role="status">Opening your photo…</p></div></div><p class="photo-view-help">Pinch or use ＋ to zoom. Drag to explore.</p></div>';
 root.querySelector('[aria-label="Close photo"]').focus();
 try{const url=await fetchImage(photo,true);if(viewerId!==photo.id||!root.querySelector('.photo-canvas'))return;root.querySelector('.photo-canvas').innerHTML='<img alt="Shared photo" draggable="false">';const img=root.querySelector('img');img.src=url;img.dataset.baseWidth=Math.min(root.querySelector('.photo-stage').clientWidth-24,photo.width);img.style.width=img.dataset.baseWidth+'px';root.querySelector('[data-action="photo-download"]').onclick=()=>{const a=document.createElement('a');a.href=url;a.download='our-little-moment-'+photo.id.slice(0,8)+'.jpg';a.click()};root.querySelector('[data-action="photo-zoom"]').onclick=()=>{zoom=zoom===1?2.5:1;img.style.width=Number(img.dataset.baseWidth)*zoom+'px';root.querySelector('[data-action="photo-zoom"]').textContent=zoom===1?'＋':'−'};
 }catch{const p=root.querySelector('.photo-canvas');if(p)p.innerHTML='<p role="alert">Couldn’t open this photo. Close and tap it again to retry.</p>'}
}
