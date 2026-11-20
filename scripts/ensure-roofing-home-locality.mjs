import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
function parseGeneratedPagesModule(source) {
 const prefix=source.match(/^(export\s+const\s+pages\s*=\s*)/);if(!prefix)throw new Error('Unknown generated-page module format');
 let depth=0,inString=false,escaped=false,body='',end=-1,repaired=0;
 for(let i=prefix[1].length;i<source.length;i++){
  const char=source[i];
  if(inString){
   if(escaped){if(char==='\n'||char==='\r'){body=body.slice(0,-1);if(char==='\r'&&source[i+1]==='\n')i++;repaired++;}else body+=char;escaped=false;continue;}
   if(char==='\\'){body+=char;escaped=true;continue;}
   if(char==='"'){body+=char;inString=false;continue;}
   if(char.charCodeAt(0)<32){body+=JSON.stringify(char).slice(1,-1);repaired++;}else body+=char;
   continue;
  }
  body+=char;if(char==='"'){inString=true;continue;}if(char==='{'||char==='[')depth++;else if(char==='}'||char===']'){depth--;if(depth===0){end=i+1;break;}}
 }
 if(end<0)throw new Error('Generated-page object did not close');
 return{prefix:prefix[1],pages:JSON.parse(body),suffix:source.slice(end),repaired};
}

const states=Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming|DC:District of Columbia'.split('|').map(s=>s.split(':')));
function readRouteJson(file){
 const before=fs.readFileSync(file,'utf8');try{return JSON.parse(before)}catch(error){
  if(!/(?:manifest|routes|route-map)\.json$/.test(file))throw error;
  const marker='"notFound": "',start=before.lastIndexOf(marker)+marker.length,end=before.lastIndexOf('"');
  if(start<marker.length||end<=start||before.slice(end+1).trim()!=='}'||!/^<(?:!doctype|html)/i.test(before.slice(start)))throw error;
  let fixed='',slashes=0,count=0;for(const char of before.slice(start,end)){if(char==='"'&&slashes%2===0){fixed+='\\';count++}fixed+=char;slashes=char==='\\'?slashes+1:0;}
  if(!count||count>200)throw error;const after=before.slice(0,start)+fixed+before.slice(end);const value=JSON.parse(after);fs.writeFileSync(file,after);console.log(JSON.stringify({syntaxRepair:file,escapedFallbackQuotes:count}));return value;
 }
}
let config=fs.existsSync('data/roofing-home-locality-input.json')?JSON.parse(fs.readFileSync('data/roofing-home-locality-input.json')):{};
if(fs.existsSync('home.config.json'))config=JSON.parse(fs.readFileSync('home.config.json'));
for(const f of ['lib/contact-config.js','lib/contact-config.cjs','api/lib/contact-config.js'])if(fs.existsSync(f)){
 const s=fs.readFileSync(f,'utf8');for(const k of ['city','state','domain']){const m=s.match(new RegExp('\\b'+k+'\\s*:\\s*["\']([^"\']+)["\']'));if(m)config[k]||=m[1];}
}
if(!config.city&&fs.existsSync('data/site.generated.json')){const b=JSON.parse(fs.readFileSync('data/site.generated.json')).business||{};config={...b,...config};}
if(!config.city||!config.state){
 const addresses=[];function visit(x){if(!x||typeof x!=='object')return;if(x.addressLocality&&x.addressRegion)addresses.push({city:x.addressLocality,state:x.addressRegion});if(typeof x.streetAddress==='string'){const m=x.streetAddress.match(/,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);if(m)addresses.push({city:m[1].trim(),state:m[2]});}if(x.url&&/RoofingContractor|LocalBusiness/.test(String(x['@type']))){try{config.domain||=new URL(x.url).hostname;}catch{}}for(const v of Object.values(x)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
 for(const f of ['public/index.html','public/__static-pages/index.html','data/rendered-pages/index.html'])if(fs.existsSync(f)){
  const html=fs.readFileSync(f,'utf8');for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]));}catch{}}
  const url=html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];if(url){try{config.domain||=new URL(url).hostname;}catch{}}
 }
 const unique=[...new Set(addresses.map(x=>JSON.stringify(x)))];if(unique.length===1)config={...JSON.parse(unique[0]),...config};
}
config.state ||= String(config.address||'').match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/)?.[1];
let state=config.state;if(state&&!states[state])state=Object.keys(states).find(k=>states[k].toLowerCase()===state.toLowerCase());
const city=String(config.city||'').trim(),domain=String(config.domain||'');
const statewide=Object.values(states).some(n=>domain.toLowerCase().replace(/\.com$/, '').replace(/^commercial(?:roofingcontractors|roofing|roofers)/,'')===n.toLowerCase().replace(/ /g,'')&&city.toLowerCase()!==n.toLowerCase());
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync('data/roofing-home-locality.json',JSON.stringify({city,state,stateName:states[state],domain,exempt:!city||!state||statewide},null,2)+'\n');
if(!city||!state)throw new Error('Homepage locality could not be verified from current production source');
if(statewide){console.log(JSON.stringify({h1Locality:'EXEMPT_OR_NO_VERIFIED_LOCALITY',city,state,domain}));}else{
 const locality=city+', '+state,escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),cityPattern=new RegExp('\\b'+escape(city)+'\\b','i');
 const valid=new RegExp('\\b'+escape(city)+'\\s*,\\s*(?:'+state+'\\b|'+escape(states[state])+'\\b)','i');
 const modifications=[];
 function transform(html){return html.replace(/(<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/gi,(all,open,inner,close,offset)=>{
  const text=inner.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();const prefix=html.slice(0,offset).toLowerCase();const inHeader=prefix.lastIndexOf('<header')>prefix.lastIndexOf('</header'),heroHeader=inHeader&&/\b(?:hero|page-title|screen-height|home-banner)\b/.test(prefix.slice(prefix.lastIndexOf('<header')));if(!text||/\b(?:site-title|brand|logo)\b/i.test(open)||(inHeader&&!heroHeader))return all;if(valid.test(text))return all;
  let next=inner;
  if(cityPattern.test(text)){
   let applied=false;next=inner.split(/(<[^>]+>)/g).map(token=>{if(applied||token.startsWith('<'))return token;if(cityPattern.test(token)){applied=true;return token.replace(cityPattern,match=>match===match.toUpperCase()?locality.toUpperCase():locality);}return token;}).join('');
   if(!applied)next=inner+' <span>'+locality+'</span>';
  }else{
   let applied=false;const title='Commercial Roof Repair and Replacement in '+locality;
   next=inner.split(/(<[^>]+>)/g).map(token=>{if(token.startsWith('<')||!token.trim())return token;if(!applied){applied=true;return title;}return '';}).join('');
   if(!applied)next=title;
  }
  assert.ok(valid.test(next.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')),'Homepage city/state failed');
  modifications.push({before:text,after:next.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()});return open+next+close;
 });}
 for(const file of ['app/lib/sitePage.tsx','app/site-renderer.jsx'])if(fs.existsSync(file)){
  const before=fs.readFileSync(file,'utf8');const after=before.replace(/((?:export\s+)?function\s+SiteHomePage\b[\s\S]*?)(?=\n(?:export\s+)?(?:async\s+)?function\s|\nexport\s+(?:const|default)|$)/g,block=>transform(block));if(before!==after)fs.writeFileSync(file,after);
 }
 for(const relative of ['app/page.js','app/page.jsx','app/page.ts','app/page.tsx'])if(fs.existsSync(relative)){const before=fs.readFileSync(relative,'utf8'),after=transform(before);if(before!==after)fs.writeFileSync(relative,after);}
 for(const relative of ['lib/site-html.js'])if(fs.existsSync(relative)){const before=fs.readFileSync(relative,'utf8'),after=before.replace(/(function\s+(?:buildPremiumHomePage|buildHomePage|buildHomeHero)\b[\s\S]*?)(?=\nfunction\s|\nexport\s|$)/g,block=>transform(block));if(before!==after)fs.writeFileSync(relative,after);}
 const files=new Set(['public/index.html','public/home.html','public/__static-pages/index.html','public/__static-pages/home.html','data/rendered-pages/index.html','data/rendered-pages/index/index.html','data/rendered-pages/home.html','rendered/pages/index.html','rendered/pages/home.html','public/site-pages/index.html','public/site-pages/home.html','public/rendered-pages/index.html','public/rendered-pages/home.html','public/rendered/index.html','public/rendered/index/index.html','public/rendered/home/index.html','public/leak-first-rich/home.html','data/leak-first-rendered/home.html','.site/pages/index.html','.site/pages/home.html','rendered/index.html','rendered/home.html']);
 for(const f of ['data/manifest.json','data/rendered-pages/manifest.json','rendered/route-manifest.json'])if(fs.existsSync(f)){const m=readRouteJson(f);const x=(m.routes||m)['/'];const v=typeof x==='string'?x:x?.file;if(v){files.add(path.join(path.dirname(f),v));files.add(path.join('public/__static-pages',v));}}
 const mappingFiles=['rendered/manifest.json','.site/manifest.json','lib/weather-static-routes.json','public/site-pages/routes.json','public/route-map.json','data/route-map.json','data/rendered-pages.json','data/site-pages.json','data/site-catalog.generated.json','data/routes.generated.json','data/pages.generated.json'];
 for(const relative of mappingFiles){if(!fs.existsSync(relative))continue;const value=readRouteJson(relative);const table=value.routes||value.pages||value;let record=Array.isArray(value.records)?value.records.find(r=>r.route==='/'):Array.isArray(table)?table.find(r=>r.route==='/'):table['/'];if(!record)continue;let changed=false;if(typeof record==='object'&&typeof record.html==='string'){const after=transform(record.html);changed=after!==record.html;record.html=after;}if(changed)fs.writeFileSync(relative,JSON.stringify(value,null,2)+'\n');const name=typeof record==='string'?record:record.file||record.filePath;if(typeof name==='string'&&/\.html?$/.test(name)&&!name.includes('..')){const leaf=path.basename(name);for(const base of [path.dirname(relative),'public/site-pages','public/rendered-pages','public/__static-pages','data/rendered-pages','public/rendered','rendered/pages','public'])for(const candidate of [path.join(base,name),path.join(base,leaf)])if(path.resolve(root,candidate).startsWith(root+path.sep))files.add(candidate);}}
 const moduleFile='lib/generated-pages.mjs';if(fs.existsSync(moduleFile)){const before=fs.readFileSync(moduleFile,'utf8'),module=parseGeneratedPagesModule(before),pages=module.pages;let changed=module.repaired>0;if(typeof pages['/']?.html==='string'){const next=transform(pages['/'].html);if(next!==pages['/'].html){pages['/'].html=next;changed=true;}}if(changed)fs.writeFileSync(moduleFile,module.prefix+JSON.stringify(pages)+module.suffix);}

 for(const file of files){if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;const before=fs.readFileSync(file,'utf8'),after=transform(before);if(before!==after)fs.writeFileSync(file,after);}
 for(const jsonFile of ['data/pages.generated.json','data/routes.generated.json'])if(fs.existsSync(jsonFile)){const f=jsonFile,s=fs.readFileSync(f,'utf8'),pages=JSON.parse(s);if(typeof pages['/']?.html==='string'){const old=pages['/'].html;pages['/'].html=transform(old);if(old!==pages['/'].html)fs.writeFileSync(f,JSON.stringify(pages,null,2)+'\n');}}
 console.log(JSON.stringify({h1Locality:locality,modifications}));
}
