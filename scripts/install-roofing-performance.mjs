// Build-time delivery only. Form handlers, scripts, content and layout remain unchanged.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const config=JSON.parse(fs.readFileSync(path.join(root,'data/roofing-performance.json'),'utf8'));
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const attr=(tag,name)=>tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*("[^"]*"|\'[^\']*\')','i'))?.[1]?.slice(1,-1);
const set=(tag,name,value)=>tag.replace(new RegExp('\\s'+name+'\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)','gi'),'').replace(/\s*\/?>$/,` ${name}="${value}">`);
let stats={html:0,css:0,json:0,imageReferences:0,lazyImages:0,lazyMaps:0,externalCssBytes:0};
const pairs=Object.entries(config.images).sort((a,b)=>b[0].length-a[0].length);
const regexSlash=String.fromCharCode(92);
const escapeRegExp=value=>[...value].map(c=>'.*+?^${}()|[]'.includes(c)||c===regexSlash?regexSlash+c:c).join('');
const imageRules=pairs.map(([from,to])=>({to,absolute:new RegExp(String.raw`(https?:\/\/(?:www\.)?${escapeRegExp(config.domain)}|\/\/(?:www\.)?${escapeRegExp(config.domain)})${escapeRegExp(from)}(?![A-Za-z0-9._~%/-])`,'g'),relative:new RegExp(String.raw`(?<![A-Za-z0-9._~%:/\\-])${escapeRegExp(from)}(?![A-Za-z0-9._~%/-])`,'g')}));
function images(s){for(const rule of imageRules)s=s.replace(rule.absolute,(_,origin)=>origin+rule.to).replace(rule.relative,rule.to);return s;}
function cssImages(s,base){return images(s).replace(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi,(all,q,value)=>{if(/^(?:data:|#)/i.test(value))return all;try{const url=new URL(value,new URL(base,'https://'+config.domain));if(![config.domain,'www.'+config.domain].includes(url.hostname))return all;const image=config.images[url.pathname]||config.images[decodeURIComponent(url.pathname)];return image?`url("${image+url.search+url.hash}")`:all;}catch{return all;}});}

const localFile=url=>{try{const u=new URL(url,'https://'+config.domain);if(u.hostname!==config.domain)return null;const file=path.resolve(root,'public','.'+decodeURIComponent(u.pathname));return file.startsWith(root+'/public/')?file:null;}catch{return null;}};
const cssCache=new Map();
function combineCss(group){
 const links=[...group.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]);if(links.length<3)return group;
 const chunks=[];for(const link of links){if(attr(link,'rel')!=='stylesheet'||/\s(?:id|onload|integrity|nonce|disabled|data-[\w-]+)\b/i.test(link)||!['','all'].includes(attr(link,'media')||''))return group;const url=attr(link,'href'),f=localFile(url);if(!f||!f.endsWith('.css')||!fs.existsSync(f))return group;let css=cssCache.get(f);if(css===undefined){css=fonts(cssImages(fs.readFileSync(f,'utf8'),url),true);cssCache.set(f,css);}if(/@(?:import|namespace)\b/i.test(css))return group;css=css.replace(/@charset\s+["'][^"']+["'];?/gi,'').replace(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi,(all,q,value)=>{if(/^(?:data:|https?:|\/|#)/i.test(value))return all;const resolved=new URL(value,new URL(url,'https://'+config.domain));return `url("${resolved.pathname+resolved.search+resolved.hash}")`;});chunks.push(images(css));}
 const css=chunks.join('\n'),url='/performance/roofing-v1/'+digest(css).slice(0,24)+'.css',file=path.join(root,'public',url);if(!fs.existsSync(file))fs.writeFileSync(file,css);return `<link rel="stylesheet" href="${url}">`;
}
function fonts(s,css=false){
 const items=(config.fonts||[]).slice().sort((a,b)=>b.source.length-a.source.length);
 for(const item of items){
  if(css)s=s.replace(/@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)|"([^"]+)"|'([^']+)')\s*;/gi,(all,...args)=>args.slice(0,5).find(v=>v!==undefined)?.trim()===item.source?fs.readFileSync(path.join(root,'public',item.cssPath),'utf8'):all);
  else for(const source of [...new Set([item.source.replaceAll('&','&amp;'),item.source])]){const re=new RegExp(escapeRegExp(source)+String.raw`(?=["'<>)]|\s*(?:["'<>)]|$))`,'g');s=s.replace(re,()=>item.cssPath);}
 }return s;
}

function html(s){
 if(!/<(?:html|main|section|img|iframe)\b/i.test(s))return s;
 const old=s;s=fonts(images(s));const scripts=[],scriptKey='rh-performance-script-'+digest(old).slice(0,16);s=s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,block=>{const marker='<!--'+scriptKey+':'+scripts.length+'-->';scripts.push([marker,block]);return marker;});if(config.inlineSvg)s=s.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi,svg=>config.inlineSvg[digest(svg)]?.replacement||svg);let count=0;const footerAt=s.search(/<footer\b/i);
 s=s.replace(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,(tag,offset)=>{count++;let priority=attr(tag,'fetchpriority');const inFooter=footerAt>=0&&offset>footerAt,taxonomyImage=/\/ours\/(?:services|roof-systems|damage-repair|property-types|industries|capabilities|service-areas)\//.test(attr(tag,'src')||'');if(priority==='high'&&(inFooter||(count>4&&taxonomyImage&&!/\b(?:hero|banner|masthead)\b/i.test((attr(tag,'class')||'')+' '+(attr(tag,'id')||''))))){tag=set(tag,'fetchpriority','low');priority='low';}if((count>4||inFooter)&&priority!=='high'&&(inFooter||!/\b(?:hero|banner|logo|masthead)\b/i.test((attr(tag,'class')||'')+' '+(attr(tag,'id')||'')))){if(attr(tag,'loading')!=='lazy'){tag=set(tag,'loading','lazy');stats.lazyImages++;}}return tag;});
 s=s.replace(/<iframe\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,tag=>{if(/(?:google\.[^/]+\/maps|maps\.google\.)/i.test(attr(tag,'src')||'')&&attr(tag,'loading')!=='lazy'){tag=set(tag,'loading','lazy');stats.lazyMaps++;}return tag;});
 // Keep every stylesheet in its original cascade position, including repeated sheets.
 // Identical large inline sheets share a content-addressed network resource.
 s=s.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi,(all,attributes,css)=>{
  if(css.length<20000||/@(?:layer|charset)\b|<\/|\bnonce\s*=|data-(?:rh|fleet)/i.test(attributes+' '+css))return all;
  if([...css.matchAll(/url\(\s*['"]?([^'"\s)]+)/gi)].some(m=>! /^(?:\/|https?:|data:|#)/i.test(m[1])))return all;
  const id=attr('<style '+attributes+'>','id');
  if(id&&!/^(?:fa-|global-styles-inline-css$|wp-)/.test(id))return all;
  const rel='/performance/roofing-v1/'+digest(css).slice(0,24)+'.css',file=path.join(root,'public',rel);
  fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file))fs.writeFileSync(file,css);
  const media=attr('<style '+attributes+'>','media');stats.externalCssBytes+=css.length;
  return `<link rel="stylesheet" href="${rel}"${id?' id="'+id+'"':''}${media?' media="'+media+'"':''}>`;
 });
 s=s.replace(/(?:<link\b(?![^>]*\s(?:id|onload|integrity|nonce|disabled|data-[\w-]+)\b)[^>]*rel=["']stylesheet["'][^>]*>\s*){3,}/gi,combineCss);
 if(/<head\b/i.test(s)&&!s.includes('data-roofing-image-preload')){const tag=[...s.matchAll(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(m=>m[0]).find(t=>attr(t,'fetchpriority')==='high');const src=tag&&attr(tag,'src');if(src&&!s.includes('as="image"')){const srcset=attr(tag,'srcset'),sizes=attr(tag,'sizes');s=s.replace(/<\/head>/i,`<link rel="preload" as="image" href="${src}"${srcset?' imagesrcset="'+srcset+'"':''}${sizes?' imagesizes="'+sizes+'"':''} fetchpriority="high" data-roofing-image-preload></head>`);}}
 for(const [marker,block]of scripts)s=s.replace(marker,()=>block);if(s!==old)stats.html++;return s;
}
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const f=path.join(dir,e.name);if(e.isDirectory()){if(!['node_modules','.git','.next','roofing-v1'].includes(e.name))walk(f);}else if(/\.html$/.test(e.name)){const s=fs.readFileSync(f,'utf8'),t=html(s);if(t!==s)fs.writeFileSync(f,t);}else if(/\.css$/.test(e.name)){const s=fs.readFileSync(f,'utf8'),t=fonts(cssImages(s,'/'+path.relative(path.join(root,'public'),f).split(path.sep).join('/')),true);if(t!==s){fs.writeFileSync(f,t);stats.css++;}}}}
for(const d of ['public','app','data/rendered-pages','data/leak-first-rendered','rendered','.site/pages'])walk(path.join(root,d));
function jsonWalk(v){if(typeof v==='string')return /<(?:html|main|section|img|iframe)\b/i.test(v)?html(v):v;if(Array.isArray(v))return v.map(jsonWalk);if(v&&typeof v==='object')for(const k of Object.keys(v))v[k]=jsonWalk(v[k]);return v;}
for(const rel of ['data/pages.generated.json','data/routes.generated.json','data/site-catalog.generated.json','data/rendered-pages.json','data/site-pages.json']){const f=path.join(root,rel);if(!fs.existsSync(f))continue;const s=fs.readFileSync(f,'utf8');const t=JSON.stringify(jsonWalk(JSON.parse(s)),null,2)+'\n';if(s!==t){fs.writeFileSync(f,t);stats.json++;}}
// Dynamic image delivery can reintroduce the original fallback path after prebuild.
// Its optimized derivatives and originals have identical intrinsic dimensions.
console.log('Roofing performance delivery',JSON.stringify(stats));

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

const moduleFile=path.join(root,'lib/generated-pages.mjs');if(fs.existsSync(moduleFile)){const before=fs.readFileSync(moduleFile,'utf8'),parsed=parseGeneratedPagesModule(before);const after=parsed.prefix+JSON.stringify(jsonWalk(parsed.pages))+parsed.suffix;if(after!==before)fs.writeFileSync(moduleFile,after);}
