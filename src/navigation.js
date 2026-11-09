import {clearExitLayers} from './motion-system.js';
import {watchClose,unwatchClose} from './close-request.js';
// Signed-in navigation behaves as a modal sheet on phones, without a second UI tree.
const side=()=>document.querySelector('#sidebar');
const opener=()=>document.querySelector('.main [data-action="mobile-menu"]');
export function closeNavigation(restoreFocus=false){
 const panel=side();if(!panel?.classList.contains('open'))return;
 const focusedInside=panel.contains(document.activeElement);
 unwatchClose('navigation');panel.classList.remove('open');panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-label');
 const main=document.querySelector('.main');if(main)main.inert=false;
 opener()?.setAttribute('aria-expanded','false');
 if(restoreFocus||focusedInside)opener()?.focus({preventScroll:true});
}
export function toggleNavigation(){
 const panel=side();if(!panel||!matchMedia('(max-width:700px)').matches)return;
 if(panel.classList.contains('open')){closeNavigation(true);return}
 clearExitLayers();watchClose('navigation',()=>closeNavigation(true));panel.classList.add('open');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Our spaces');
 opener()?.setAttribute('aria-expanded','true');
 document.querySelector('.main').inert=true;
 requestAnimationFrame(()=>{if(panel.isConnected&&panel.classList.contains('open'))panel.querySelector('.sidebar-close')?.focus({preventScroll:true})});
}
matchMedia('(min-width:701px)').addEventListener('change',event=>{if(event.matches)closeNavigation()});
