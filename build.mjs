import {build,transform} from 'esbuild';
import {readFile,writeFile,copyFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
await rm('dist',{recursive:true,force:true});await mkdir('dist/assets',{recursive:true});
const result=await build({entryPoints:['src/app.js'],bundle:true,minify:true,splitting:true,format:'esm',outdir:'dist/assets',entryNames:'[name]-[hash]',chunkNames:'[name]-[hash]',target:['es2020'],metafile:true,legalComments:'none'});
const entry=Object.entries(result.metafile.outputs).find(([,v])=>v.entryPoint==='src/app.js')[0].replace(/^dist/,'');
const css=(await transform(await readFile('src/style.css','utf8'),{loader:'css',minify:true,target:'es2020'})).code;
const hash=createHash('sha256').update(css).digest('hex').slice(0,12);
const cssURL=`/assets/style-${hash}.css`;await writeFile('dist'+cssURL,css);
let html=await readFile('src/index.html','utf8');html=html.replace('/app.js',entry).replace('/style.css',cssURL);await writeFile('dist/index.html',html);
for(const f of ['icon.svg','manifest.webmanifest'])await copyFile('src/'+f,'dist/'+f);
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
