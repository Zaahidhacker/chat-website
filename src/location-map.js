import * as L from 'leaflet';
import {visiblePoint,distance,FRESH_MS} from './location-logic.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createLocationMap(element,{people,onError,initialRows=[]}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const map=L.map(element,{zoomControl:false,attributionControl:true,zoomAnimation:!reduced,fadeAnimation:!reduced,markerZoomAnimation:!reduced,worldCopyJump:true}).setView([20,0],2);
 const initial=initialRows.filter(r=>visiblePoint(r)).map(r=>[r.latitude,r.longitude]);
 if(initial.length)map.fitBounds(L.latLngBounds(initial),{padding:[50,50],maxZoom:16,animate:false});
 L.control.zoom({position:'bottomright'}).addTo(map);
 const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,minZoom:2,detectRetina:false,keepBuffer:0,updateWhenIdle:true,updateWhenZooming:false,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
 let failures=0;tiles.on('tileerror',()=>{if(++failures===3)onError('Map tiles are unavailable. Your location details still work. Try the map again later.')});
 const markers=new Map(),circles=new Map(),frames=new Map(),rendered=new Map();let fitted=!!initial.length,following=null;map.on('dragstart',()=>{following=null});
 function update(rows){const visible=rows.filter(r=>visiblePoint(r));const ids=new Set(visible.map(r=>r.user_id));for(const[id,marker]of markers)if(!ids.has(id)){cancelAnimationFrame(frames.get(id));map.removeLayer(marker);map.removeLayer(circles.get(id));markers.delete(id);circles.delete(id);rendered.delete(id)}
  for(const row of visible){const person=people.find(p=>p.id===row.user_id),own=person?.own,color=own?'#a6657c':'#557f77',point=L.latLng(row.latitude,row.longitude);let marker=markers.get(row.user_id);
   if(!marker){marker=L.marker(point,{icon:L.divIcon({className:'our-place-marker '+(own?'own':''),html:`<span><i>${escape(person?.name?.[0]||'♡')}</i></span><b>${escape(person?.name||'Your person')}</b>`,iconSize:[48,48],iconAnchor:[24,44]}),keyboard:true,title:person?.name||'Shared location'}).addTo(map);markers.set(row.user_id,marker);circles.set(row.user_id,L.circle(point,{radius:row.accuracy,color,weight:1,fillOpacity:.09,interactive:false}).addTo(map))}
   marker.getElement()?.classList.toggle('last-known',row.mode==='paused'||Date.now()-Date.parse(row.sampled_at)>FRESH_MS);
   const key=`${row.latitude}:${row.longitude}:${row.accuracy}`;if(rendered.get(row.user_id)===key)continue;rendered.set(row.user_id,key);
   cancelAnimationFrame(frames.get(row.user_id));const from=marker.getLatLng(),meters=distance({latitude:from.lat,longitude:from.lng},row);if(!reduced&&meters>1&&meters<500&&Math.abs(from.lng-point.lng)<1){const start=performance.now();const animate=now=>{const t=Math.min(1,(now-start)/650),ease=1-(1-t)**3;marker.setLatLng([from.lat+(point.lat-from.lat)*ease,from.lng+(point.lng-from.lng)*ease]);if(t<1)frames.set(row.user_id,requestAnimationFrame(animate))};frames.set(row.user_id,requestAnimationFrame(animate))}else marker.setLatLng(point);
   circles.get(row.user_id).setLatLng(point).setRadius(row.accuracy);if(following===row.user_id)map.panTo(point,{animate:!reduced});
  }
  if(!fitted&&visible.length){fit();fitted=true}
 }
 function fit(){following=null;const points=[...markers.values()].map(m=>m.getLatLng());if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[50,50],maxZoom:16,animate:false})}
 const observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(element);
 return {update,fit,focus(id){following=id;const marker=markers.get(id);if(marker)map.setView(marker.getLatLng(),16,{animate:!reduced})},destroy(){observer.disconnect();for(const id of frames.values())cancelAnimationFrame(id);map.remove()}};
}
