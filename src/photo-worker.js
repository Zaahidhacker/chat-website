import {compressPhoto} from './photo-codec.js';
self.onmessage=async event=>{try{self.postMessage({photo:await compressPhoto(event.data.file)})}catch(error){self.postMessage({error:error.message})}};
