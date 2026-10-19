// Original, bundled adventure content. No remote assets or generated-content API.
export const chapters=[
 {title:'The night the stars fell',text:'The sea has gone quiet. At your cottage door, a moth called Miri is holding a lantern with nothing inside it. “They didn’t go out,” she says. “They wandered.” Find four wandering lights to wake the tide path.',after:'Four lights settle into Miri’s lantern. Below the garden, stepping stones lift out of the sea. There’s a little island out there that wasn’t on your map.'},
 {title:'What the tide remembers',text:'In the cove, the water remembers every sky it has reflected. A crab named Otto has been collecting the pieces. He’ll trade them for a bit of patience, a good memory, and one very particular password.',after:'Otto turns his last glass pebble toward the horizon. A tower answers with one faint blink. The lighthouse is awake, but someone has forgotten how to bring it home.'},
 {title:'A light to come home to',text:'The lighthouse keeper left a note: a light isn’t a thing you keep. It’s a thing you leave on for someone. Carry the last four fragments up the tower and let the island find its way back.',after:'The lantern turns. Light crosses the sea, the cottage window, and the small space between two cups. Nothing needs rescuing now. There’s still a whole island to come back to.'}
];
export const locations=[
 {id:'cottage',name:'Little cottage',tag:'Make a place for us',chapter:0,x:28,y:47},
 {id:'garden',name:'Moonflower garden',tag:'A familiar pair of ears',chapter:0,x:59,y:65},
 {id:'forest',name:'Whisperwood',tag:'Follow the fireflies',chapter:0,x:48,y:31},
 {id:'observatory',name:'Stargazer’s rise',tag:'The sky is closer here',chapter:0,x:73,y:37},
 {id:'cove',name:'Glasswater cove',tag:'What the tide remembers',chapter:1,x:23,y:76},
 {id:'lighthouse',name:'The last lantern',tag:'A light to come home to',chapter:2,x:79,y:71}
];
const challenges=[
 ['first-fall','stars','observatory',0,'A pocket of starlight','Catch 18 points of wandering light before the sky clears.',{target:18,seconds:45,level:0}],
 ['keepers-desk','memory','cottage',0,'The keeper’s desk','Miri scattered her belongings. Find the four pairs.',{pairs:4,seed:17,level:0}],
 ['forest-door','code','forest',0,'The door with no handle','The woodpecker left a very literal set of directions.',{symbols:['Leaf','Moon','Shell','Star'],size:3,clues:['The moon is in the middle.','A leaf comes immediately before the moon.','The star is somewhere after the leaf.','The shell stays outside.'],answer:[0,1,3]}],
 ['little-kite','constellation','garden',0,'The little kite','Follow the old sky chart. Connect each line; order doesn’t matter.',{nodes:[[20,28],[48,12],[75,31],[48,60],[48,85],[83,78]],edges:[[0,1],[1,2],[2,3],[3,0],[3,4]]}],
 ['tide-lights','stars','cove',1,'Lights on the water','Blue lights drift faster. Golden ones are worth three.',{target:28,seconds:45,level:1}],
 ['moth-library','memory','forest',1,'The moth library','Six pairs of tiny treasures. A mismatch is just a clue.',{pairs:6,seed:83,level:1}],
 ['tide-chest','code','garden',1,'Otto’s tide chest','The carvings describe a chain. Find where it begins.',{symbols:['Shell','Leaf','Moon','Star','Rain'],size:4,clues:['The shell sits immediately after the star.','The moon comes immediately before the star.','The leaf is after the shell.','Rain is not part of the chain.'],answer:[2,3,0,1]}],
 ['sailing-home','constellation','observatory',1,'A boat for the moon','Restore the hull, then its little sail. Ignore the wandering stars.',{nodes:[[13,65],[86,65],[68,86],[31,86],[48,17],[48,65],[18,20],[83,32]],edges:[[0,1],[1,2],[2,3],[3,0],[4,5],[4,1],[0,4]]}],
 ['lantern-storm','stars','lighthouse',2,'The lantern storm','Catch 40 points. Keep your rhythm; purple clouds break a combo.',{target:40,seconds:45,level:2}],
 ['sea-archive','memory','cove',2,'The sea’s small archive','Eight pairs, sixteen memories. Take all the time you need.',{pairs:8,seed:211,level:2}],
 ['keeper-lock','code','cottage',2,'The keeper’s last lock','Exactly one of these three statements is true. Choose the three symbols that make it so.',{symbols:['Leaf','Moon','Shell','Star'],size:3,unique:true,clues:['The moon is first.','The leaf is second.','The moon is last.','Extra carvings: the shell is absent; the leaf comes somewhere before the moon.'],answer:[0,3,1],truthPuzzle:true}],
 ['home-light','constellation','lighthouse',2,'The light between us','Two small windows share one roof. Restore the whole constellation.',{nodes:[[15,43],[49,13],[84,43],[84,86],[15,86],[34,64],[64,64],[49,86],[91,12]],edges:[[0,1],[1,2],[2,3],[3,4],[4,0],[0,2],[5,6],[5,7],[6,7]]}]
];
// For the final logic lock: leaf,star,moon makes only “moon last” true.
export const story=challenges.map(([id,kind,location,chapter,title,intro,config])=>({id,kind,location,chapter,title,intro,config,reward:8+chapter*4}));
export const treasures=[
 ['sea-glass','cove','A sea-glass heart',32,55],['lost-key','cottage','A brass key',76,74],['moth-stamp','forest','Miri’s stamp',29,33],['moon-petal','garden','A silver petal',75,70],['tiny-orbit','observatory','A pocket planet',34,38],['lantern-feather','lighthouse','A copper feather',21,72],['tea-shell','cottage','A shell for two',19,68],['sleepy-snail','garden','The sleepiest snail',25,79]
].map(([id,location,name,x,y])=>({id:'find-'+id,location,name,x,y,reward:3}));
export const items=[
 ['wall-dawn','Apricot dawn','wall',8,'#e9c2a8'],['wall-night','Midnight blue','wall',8,'#344b63'],['rug-rose','Rosewoven rug','floor',10,'#b67581'],['rug-sea','Sea-glass rug','floor',10,'#72aaa1'],['fern','A very happy fern','left',8,'#658a65'],['books','Stories for rainy days','left',12,'#c3a26f'],['sofa-sage','The reading sofa','center',18,'#92a291'],['tea-table','Tea for two','center',14,'#bd9270'],['flowers','Moonflower vase','right',10,'#c891a2'],['telescope','Pocket telescope','right',24,'#d4bc80'],['lamp','Honeyglow lamp','light',12,'#e2b66a'],['stars','Paper star garland','light',16,'#ddd0a2'],['ivy','Window ivy','sill',8,'#729278'],['mugs','Our two mugs','sill',8,'#e6bbac']
].map(([id,name,slot,cost,color])=>({id,name,slot,cost,color}));
export const slots=['wall','floor','left','center','right','light','sill'];
export const kinds={stars:'Star Catcher',memory:'Memory Mystery',code:'Secret Code',constellation:'Constellation Puzzle'};
export function dayNumber(day){return Math.floor(Date.parse(day+'T00:00:00Z')/86400000)}
export function rng(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function shuffled(values,seed){const a=[...values],r=rng(seed);for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function rotateCode(config,n){const names=config.symbols.map((_,j)=>config.symbols[(j+n)%config.symbols.length]);const replace=word=>{const i=config.symbols.findIndex(s=>s.toLowerCase()===word.toLowerCase());return /^[A-Z]/.test(word)?names[i]:names[i].toLowerCase()};return {symbols:names,clues:config.clues.map(clue=>clue.replace(new RegExp('\\b('+config.symbols.join('|')+')\\b','gi'),replace))}}
export function dailyChallenges(day){const n=dayNumber(day);return Object.keys(kinds).map((kind,i)=>{const base=story.filter(c=>c.kind===kind)[(n+i)%3];return {...base,id:'daily-'+kind,chapter:0,title:['A new sky','A shuffled memory','Today’s tide lock','Tonight’s sky chart'][i],reward:5,daily:true,config:{...base.config,...(['memory','stars'].includes(kind)?{seed:n}:{}),...(kind==='code'?rotateCode(base.config,n):{})}}})}
export function chapterFor(completions){const count=new Set(completions.filter(c=>story.some(s=>s.id===c.challenge_id)).map(c=>c.challenge_id)).size;return Math.min(2,Math.floor(count/4))}
export function memoryDeck(config){return shuffled(Array.from({length:config.pairs*2},(_,i)=>Math.floor(i/2)),config.seed)}
export function edgeKey(a,b){return [a,b].sort((x,y)=>x-y).join('-')}
export function validProof(challenge,proof){const c=challenge.config;switch(challenge.kind){case 'stars':return Number.isInteger(proof.score)&&proof.score>=c.target&&proof.score<=5000&&proof.seconds>=30&&proof.seconds<=60;case 'memory':return Array.isArray(proof.matched)&&proof.matched.length===c.pairs*2&&new Set(proof.matched).size===c.pairs*2&&proof.matched.every(n=>Number.isInteger(n)&&n>=0&&n<c.pairs*2);case 'code':return JSON.stringify(proof.answer)===JSON.stringify(c.answer);case 'constellation':return Array.isArray(proof.edges)&&JSON.stringify([...proof.edges].sort())===JSON.stringify(c.edges.map(e=>edgeKey(...e)).sort());default:return false}}
export function starReward(type,combo){return type==='cloud'?-3:(type==='gold'?3:1)+Math.floor(combo/5)}
export function emptyState(day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){return {day,balance:0,completions:[],owned:[],slots:[],surprises:[],bunnyPoints:0}}
