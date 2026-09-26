import {createHash} from 'node:crypto';
import config from '../data/fleet-image-delivery.json' with {type:'json'};
const attr=(tag,name)=>tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*("[^"]*"|\'[^\']*\')','i'))?.[1]?.slice(1,-1);
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const set=(tag,name,value)=>tag.replace(new RegExp('\\s'+name+'\\s*=\\s*(?:"[^"]*"|\'[^\']*\')','gi'),'').replace(/\s*\/?>$/,` ${name}="${esc(value)}">`);
const pathname=url=>{try{const u=new URL(url,'https://'+config.domain);return u.hostname===config.domain?u.pathname:null}catch{return null}};
const image=url=>config.images[pathname(url)];
function srcset(item,original,existing){
 if(existing&&/\s[\d.]+x(?:\s*,|$)/.test(existing))return existing;
 const entries=new Map();for(const part of (existing||'').split(',')){const m=part.trim().match(/^(\S+)\s+(\d+)w$/);if(m)entries.set(Number(m[2]),m[1])}
 entries.set(item.width,original);for(const v of item.variants)entries.set(v.width,v.src);
 return [...entries].sort((a,b)=>a[0]-b[0]).map(([w,s])=>`${s} ${w}w`).join(', ');
}
export function optimizeFleetImages(html){
 if(!html)return html;
 const canonical=html.match(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i)?.[0];
 if(pathname(attr(canonical||'','href'))!=='/')return html;
 if(config.optionalGoogleFonts)html=html.replace(/<link\b[^>]*href=["'][^"']*fonts\.googleapis\.com[^"']*["'][^>]*>/gi,t=>t.replace(/display=swap/g,'display=optional'));
 if(config.blockingStylesheets?.length)html=html.replace(/<link\b[^>]*>/gi,t=>config.blockingStylesheets.includes(pathname(attr(t,'href')))?t.replace(/\srel=["'][^"']+["']/i,' rel="stylesheet"').replace(/\s(?:as|onload)=(?:"[^"]*"|'[^']*')/gi,''):t);
 html=html.replace(/<style\b[^>]*id=["']fleet-mobile-images["'][^>]*>[\s\S]*?<\/style>/gi,'').replace(/<script\b[^>]*data-fleet-background-loader[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*data-fleet-hero-preload[^>]*>/gi,'');
 html=html.replace(/<img\b[^>]*>/gi,tag=>{
  const source=attr(tag,'src'),item=image(source);if(!item)return tag;
  tag=set(tag,'srcset',srcset(item,source,attr(tag,'srcset')));
  tag=set(tag,'sizes',attr(tag,'sizes')||`(max-width:640px) ${item.mobileSize||'100vw'}, ${item.width}px`);
  if(config.lazyImages.includes(pathname(source)))tag=set(set(tag,'loading','lazy'),'fetchpriority','low');
  if(pathname(source)===config.heroImage)tag=set(set(tag,'loading','eager'),'fetchpriority','high');
  return tag;
 });
 html=html.replace(/<source\b[^>]*>/gi,tag=>{const existing=attr(tag,'srcset');if(!existing||/\s[\d.]+x(?:\s*,|$)/.test(existing))return tag;const original=existing.split(',').map(s=>s.trim().split(/\s+/)[0]).find(s=>image(s));const item=image(original);if(!item)return tag;tag=set(tag,'srcset',srcset(item,original,existing));return set(tag,'sizes',attr(tag,'sizes')||`(max-width:640px) ${item.mobileSize||'100vw'}, ${item.width}px`)});
 html=html.replace(/<link\b[^>]*>/gi,tag=>{if(attr(tag,'rel')!=='preload'||attr(tag,'as')!=='image')return tag;const original=attr(tag,'href'),item=image(original);if(!item||config.heroBackground===pathname(original))return tag;return set(set(tag,'imagesrcset',srcset(item,original,attr(tag,'imagesrcset'))),'imagesizes',`(max-width:640px) ${item.mobileSize||'100vw'}, ${item.width}px`)});
 const rules=[],deferred=[];
 html=html.replace(/<[a-z][^>]*\bstyle=("[^"]*"|'[^']*')[^>]*>/gi,tag=>{
  const quoted=tag.match(/\bstyle=("[^"]*"|'[^']*')/i)?.[1];if(!quoted)return tag;
  const style=quoted.slice(1,-1).replace(/&quot;/gi,'"').replace(/&#(?:0*39|x0*27);|&apos;/gi,"'").replace(/&amp;/gi,'&');
  const found=[...style.matchAll(/(?:^|;)\s*(background(?:-image)?|--[\w-]+)\s*:\s*([^;]+)/gi)].find(m=>[...m[2].matchAll(/url\(["']?([^)'"\s]+)["']?\)/gi)].some(u=>image(u[1])?.backgroundVariants));if(!found)return tag;
  const original=found[2].replace(/\s*!important\s*$/i,'').replace(/^var\(--fleet-mobile-bg,\s*([\s\S]*)\)$/,'$1');
  let changed=false,mayDefer=false;
  const value=original.replace(/url\(["']?([^)'"\s]+)["']?\)/gi,(all,url)=>{const item=image(url);if(!item?.backgroundVariants)return all;changed=true;mayDefer ||= config.lazyBackgrounds.includes(pathname(url));return `image-set(${item.backgroundVariants.map(v=>`url('${v.src}') ${v.density}x`).join(', ')})`});
  if(!changed)return tag;
  const id=createHash('sha256').update(found[1]+':'+value).digest('hex').slice(0,16);
  rules.push(`[data-fleet-mobile-bg="${id}"]{--fleet-mobile-bg:${value}!important}`);if(mayDefer)deferred.push(id);
  tag=set(tag,'style',style.replace(found[2],`var(--fleet-mobile-bg, ${original})!important`));return set(tag,'data-fleet-mobile-bg',id);
 });
 if(deferred.length){
  rules.push(deferred.map(id=>`html.fleet-lazy-bg [data-fleet-mobile-bg="${id}"]:not([data-fleet-bg-ready])`).join(',')+'{--fleet-mobile-bg:none!important}');
  html=html.replace(/<\/head>/i,`<script data-fleet-background-loader>if(matchMedia('(max-width:640px)').matches&&'IntersectionObserver' in window)document.documentElement.classList.add('fleet-lazy-bg')</script></head>`);
  html=html.replace(/<\/body>/i,`<script data-fleet-background-loader>(function(){if(!document.documentElement.classList.contains('fleet-lazy-bg'))return;var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.setAttribute('data-fleet-bg-ready','');observer.unobserve(entry.target)}})},{rootMargin:'250px'});${JSON.stringify([...new Set(deferred)])}.forEach(function(id){document.querySelectorAll('[data-fleet-mobile-bg="'+id+'"]').forEach(function(el){observer.observe(el)})})})()</script></body>`);
 }
 html=html.replace(/<\/head>/i,`<style id="fleet-mobile-images">@media(max-width:640px){${[...new Set(rules)].join('')}}</style></head>`);
 const bg=config.images[config.heroBackground];const img=config.images[config.heroImage];let hint='';
 if(bg?.backgroundVariants){
  html=html.replace(/<link\b[^>]*>/gi,t=>attr(t,'rel')==='preload'&&attr(t,'as')==='image'&&pathname(attr(t,'href'))===config.heroBackground?'':t);
  hint=`<link rel="preload" as="image" href="${bg.backgroundVariants[0].src}" imagesrcset="${bg.backgroundVariants.map(v=>`${v.src} ${v.density}x`).join(', ')}" media="(max-width:640px)" fetchpriority="high" data-fleet-hero-preload>`;
 }else if(img)hint=`<link rel="preload" as="image" href="${img.variants[0].src}" imagesrcset="${esc(srcset(img,config.heroImage))}" imagesizes="(max-width:640px) ${img.mobileSize||'100vw'}, ${img.width}px" media="(max-width:640px)" fetchpriority="high" data-fleet-hero-preload>`;
 if(hint)html=html.replace(/<head\b[^>]*>/i,t=>t+hint);
 return html;
}
