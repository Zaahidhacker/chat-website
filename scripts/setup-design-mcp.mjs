// Optional workstation tooling; never runs during install, build or deployment.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const destination=fileURLToPath(new URL('../work/after-effects-mcp',import.meta.url));
const revision='5223c17a8e8c1273b25c6a9d306839259ad35143';
function run(command,args,cwd){const r=spawnSync(command,args,{cwd,stdio:'inherit',shell:false});if(r.status!==0)process.exit(r.status||1)}
if(!existsSync(destination))run('git',['clone','https://github.com/ishu86/after-effects-mcp.git',destination],root);
run('git',['checkout','--detach',revision],destination);
run('npm',['ci','--ignore-scripts'],destination);
run('npm',['run','build'],destination);
console.log('Design MCP built. Rendering needs Adobe After Effects 2024+ and its CEP panel on macOS/Windows.');
