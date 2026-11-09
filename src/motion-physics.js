export const springs=Object.freeze({release:{stiffness:440,damping:38,mass:1},gentle:{stiffness:300,damping:32,mass:1}});
export function springSamples(from,velocity=0,{stiffness:k,damping:c,mass:m}=springs.release){
 const w=Math.sqrt(k/m),z=c/(2*Math.sqrt(k*m)),v=Math.max(-1600,Math.min(1600,velocity));const values=[];
 for(let i=0;i<=120;i++){const t=i/120;let x;
  if(z>=1){const r1=-w*(z-Math.sqrt(z*z-1)),r2=-w*(z+Math.sqrt(z*z-1));if(Math.abs(r1-r2)<.001)x=(from+(v+w*from)*t)*Math.exp(-w*t);else {const a=(v-r2*from)/(r1-r2);x=a*Math.exp(r1*t)+(from-a)*Math.exp(r2*t)}}
  else{const d=w*Math.sqrt(1-z*z);x=Math.exp(-z*w*t)*(from*Math.cos(d*t)+(v+z*w*from)/d*Math.sin(d*t))}
  const previous=values.at(-1);values.push(x);if(i>12&&Math.abs(x)<.05&&Math.abs((x-previous)*120)<1)break;
 }values[values.length-1]=0;return values;
}
