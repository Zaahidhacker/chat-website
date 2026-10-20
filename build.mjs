import {build,transform} from 'esbuild';
import {readFile,writeFile,copyFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
await rm('dist',{recursive:true,force:true});await mkdir('dist/assets',{recursive:true});
const featureDefines={};
for(const name of ['photos','garden','island','location','pages']){
 const css=(await transform((name==='location'?await readFile('node_modules/leaflet/dist/leaflet.css','utf8'):'')+await readFile(`src/${name}.css`,'utf8'),{loader:'css',minify:true})).code;
 const hash=createHash('sha256').update(css).digest('hex').slice(0,12),url=`/assets/${name}-${hash}.css`;
 await writeFile('dist'+url,css);featureDefines[name==='photos'?'PHOTO_STYLE_URL':name.toUpperCase()+'_STYLE_URL']=JSON.stringify(url);
}
const worker=await build({entryPoints:['src/photo-worker.js'],bundle:true,minify:true,format:'esm',write:false,target:'es2020'});
const workerBytes=worker.outputFiles[0].contents,workerHash=createHash('sha256').update(workerBytes).digest('hex').slice(0,12);
const workerURL=`/assets/photo-worker-${workerHash}.js`;await writeFile('dist'+workerURL,workerBytes);
const result=await build({entryPoints:['src/app.js'],bundle:true,minify:true,splitting:true,format:'esm',outdir:'dist/assets',entryNames:'[name]-[hash]',chunkNames:'[name]-[hash]',target:['es2020'],metafile:true,legalComments:'none',define:{...featureDefines,PHOTO_WORKER_URL:JSON.stringify(workerURL)}});
const entry=Object.entries(result.metafile.outputs).find(([,v])=>v.entryPoint==='src/app.js')[0].replace(/^dist/,'');
let cssSource=await readFile('src/style.css','utf8')+await readFile('src/overhaul.css','utf8');
for(const [name,file]of [['manrope','node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2'],['cormorant','node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2']]){
 const bytes=await readFile(file),version=createHash('sha256').update(bytes).digest('hex').slice(0,12);
 const url=`/assets/${name}-${version}.woff2`;await writeFile('dist'+url,bytes);
 cssSource=cssSource.replace(`/assets/${name}-latin.woff2`,url);
}
const css=(await transform(cssSource,{loader:'css',minify:true,target:'es2020'})).code;
const hash=createHash('sha256').update(css).digest('hex').slice(0,12);
const cssURL=`/assets/style-${hash}.css`;await writeFile('dist'+cssURL,css);
let html=await readFile('src/index.html','utf8');html=html.replace('/app.js',entry).replace('/style.css',cssURL);await writeFile('dist/index.html',html);
for(const f of ['icon.svg','icon-192.png','icon-512.png','manifest.webmanifest'])await copyFile('src/'+f,'dist/'+f);
await copyFile('node_modules/leaflet/LICENSE','dist/leaflet-LICENSE.txt');
await copyFile('node_modules/@fontsource-variable/manrope/LICENSE','dist/manrope-LICENSE.txt');
await copyFile('node_modules/@fontsource/cormorant-garamond/LICENSE','dist/cormorant-LICENSE.txt');
const shell=['/',entry,cssURL,'/icon.svg'];
const shellVersion=createHash('sha256').update(JSON.stringify(shell)).digest('hex').slice(0,12);
const sw=(await readFile('src/sw.js','utf8')).replace('__SHELL_ASSETS__',JSON.stringify(shell)).replace('__BUILD_VERSION__',shellVersion);
await writeFile('dist/sw.js',sw);
const initialFiles=new Set();function collect(file){if(initialFiles.has(file))return;initialFiles.add(file);for(const i of result.metafile.outputs[file]?.imports||[])if(i.kind==='import-statement')collect(i.path)}collect('dist'+entry);
const budget={initial:[],lazy:[]};
for(const [file,meta]of Object.entries(result.metafile.outputs)){
 const bytes=await readFile(file);const row={file:file.replace('dist/',''),bytes:bytes.length,gzip:gzipSync(bytes).length,brotli:brotliCompressSync(bytes).length};
 (initialFiles.has(file)?budget.initial:budget.lazy).push(row);
}
budget.initial.push({file:cssURL.slice(1),bytes:Buffer.byteLength(css),gzip:gzipSync(css).length,brotli:brotliCompressSync(css).length});
const initialGzip=budget.initial.reduce((n,v)=>n+v.gzip,0);
if(initialGzip>25000)throw Error(`Initial JS/CSS exceeds 25 KB gzip budget: ${initialGzip}`);
await mkdir('work',{recursive:true});await writeFile('work/build-budget.json',JSON.stringify({...budget,initialGzip},null,2));
console.log(`Initial JS + CSS: ${(initialGzip/1024).toFixed(1)} KiB gzip. Messaging SDK loads on sign-in.`);
