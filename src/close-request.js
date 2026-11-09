const watchers=new Map();
export function watchClose(key,close){
 unwatchClose(key);if(!window.CloseWatcher)return;
 try{const watcher=new CloseWatcher();watchers.set(key,watcher);watcher.addEventListener('close',()=>{watchers.delete(key);close()},{once:true})}catch{}
}
export function unwatchClose(key){watchers.get(key)?.destroy();watchers.delete(key)}
