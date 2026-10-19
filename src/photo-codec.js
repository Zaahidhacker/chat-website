export const FULL_LIMIT=524288,THUMB_LIMIT=32768;
export function photoDimensions(width,height,max=1600){const ratio=Math.min(1,max/Math.max(width,height));return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))}}
export function imageKind(bytes){
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpeg';
 if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return 'png';
 const s=String.fromCharCode(...bytes.slice(0,32));if(s.startsWith('RIFF')&&s.slice(8,12)==='WEBP')return 'webp';
 if(s.slice(4,8)==='ftyp'&&/heic|heif|heix|mif1|avif/.test(s))return 'heif';
 return null;
}
async function encode(canvas,quality){return canvas.convertToBlob?canvas.convertToBlob({type:'image/jpeg',quality}):new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not compress this photo.')),'image/jpeg',quality))}
export async function compressPhoto(file){
 if(file.size>25*1024*1024)throw Error('Choose a photo smaller than 25 MB.');
 if(!file.size||!imageKind(new Uint8Array(await file.slice(0,32).arrayBuffer())))throw Error('Choose a JPEG, PNG, WebP or supported HEIC photo. Videos and other files are not supported.');
 let image,objectURL;
 try{
  if(typeof createImageBitmap==='function')image=await createImageBitmap(file,{imageOrientation:'from-image'});
  else{objectURL=URL.createObjectURL(file);image=new Image();image.src=objectURL;await image.decode()}
  if(image.width*image.height>40000000)throw Error('This photo is too large to process safely. Choose a smaller image.');
  let size=photoDimensions(image.width,image.height);
  const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(size.width,size.height):Object.assign(document.createElement('canvas'),size);
  const draw=(w,h)=>{canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h)};
  draw(size.width,size.height);
  let full=await encode(canvas,.82);
  const target=Math.min(280000,Math.max(40000,file.size*.8));
  for(const quality of [.74,.66,.58]){if(full.size<=target)break;const candidate=await encode(canvas,quality);if(candidate.size<full.size)full=candidate}
  while(full.size>FULL_LIMIT||(full.size>target&&Math.max(size.width,size.height)>800)){size=photoDimensions(size.width,size.height,Math.floor(Math.max(size.width,size.height)*.8));draw(size.width,size.height);full=await encode(canvas,.72)}
  const thumbSize=photoDimensions(size.width,size.height,320);draw(thumbSize.width,thumbSize.height);
  let thumb=await encode(canvas,.65);if(thumb.size>THUMB_LIMIT)thumb=await encode(canvas,.35);
  if(thumb.size>THUMB_LIMIT)throw Error('This photo’s preview is too large. Try a different photo.');
  return {full,thumb,width:size.width,height:size.height,originalBytes:file.size};
 }catch(error){if(error.message?.includes('too large'))throw error;throw Error('This photo could not be opened. Try a JPEG or PNG version.')}finally{image?.close?.();if(objectURL)URL.revokeObjectURL(objectURL)}
}
