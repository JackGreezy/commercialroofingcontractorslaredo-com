import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
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

const growthUrl = '/rankhound-conversion-events.js?v=' + crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'public/rankhound-conversion-events.js'))).digest('hex').slice(0, 12);
const callbackHeroCssPath = path.join(root, 'public/website-taste.css');
const callbackHeroCss = fs.existsSync(callbackHeroCssPath) ? fs.readFileSync(callbackHeroCssPath, 'utf8') : '';
const callbackHeroCssUrl = callbackHeroCss.includes('Roofing callback hero: preserve native desktop phone behavior')
 ? '/website-taste.css?v=' + crypto.createHash('sha256').update(callbackHeroCss).digest('hex').slice(0,12) : null;
const tag = '<script async src="' + growthUrl + '"></script>';
const legacyFiles = fs.readdirSync(path.join(root,'public')).filter(name => /-conversion-events\.js$/.test(name) && name !== 'rankhound-conversion-events.js').filter(name => {
 const content=fs.readFileSync(path.join(root,'public',name),'utf8').replace(/__\w+ConversionEvents/g,'__legacyConversionEvents');
 return crypto.createHash('sha256').update(content).digest('hex') === '668fcf5aac098d3edeb9050bde1cf0d8efb69d1be5e3a5fc6ddb8e304eb70ca1';
});
const legacyPattern = legacyFiles.length ? new RegExp('(<script\\b[^>]*\\bsrc=)["\']/(' + legacyFiles.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')(?:\\?[^"\']*)?["\']','gi') : null;
function replaceLegacy(html) { return legacyPattern ? html.replace(legacyPattern, '$1"' + growthUrl + '"') : html; }
const scriptTag = /<script\b[^>]*\bsrc=["']\/(?:rankhound|fgfll)-conversion-events\.js(?:\?[^"']*)?["'][^>]*>/i;
function optionalFields(html) {
  return html.replace(/<(?:input|select|textarea)\b[^>]*>/gi, opening =>
    /\bname=["'](?:timeline|address|message)["']/i.test(opening)
      ? opening.replace(/\saria-required=(["'])true\1/gi, ' aria-required="false"').replace(/\srequired(?:=(?:["'][^"']*["']|\{true\}|true))?/gi, '') : opening);
}
function transform(html, inject = true) {
  let next = replaceLegacy(optionalFields(html)).replace(/(<script\b[^>]*\bsrc=)["']\/(?:rankhound|fgfll)-conversion-events\.js(?:\?[^"']*)?["']/gi, '$1' + '"' + growthUrl + '"');
  if (callbackHeroCssUrl) next = next.replace(/(href=)["']\/website-taste\.css(?:\?[^"']*)?["']/gi, '$1' + '"' + callbackHeroCssUrl + '"');
  if (callbackHeroCssUrl && !/<a\b[^>]*\bdata-rr-desktop-phone\b/i.test(next)) {
    const match = [...next.matchAll(/href=["']tel:([^"']+)["']/gi)].find(m => { const d=m[1].replace(/\D/g,''); return d.length>=10&&!/5555555/.test(d); });
    if (match) {
      const digits=match[1].replace(/\D/g,''), national=digits.length===11&&digits[0]==='1'?digits.slice(1):digits;
      const label=national.length===10?'('+national.slice(0,3)+') '+national.slice(3,6)+'-'+national.slice(6):digits;
      const anchor='<a href="tel:'+match[1]+'" data-rr-desktop-phone class="rr-desktop-phone" data-rh-server-header-phone>Call '+label+'</a>';
      next=next.replace(/(<header\b[\s\S]*?<\/nav>)(\s*<\/div>)/i,'$1'+anchor+'$2');
    }
  }

  if (!scriptTag.test(next) && inject) {
    const index = next.toLowerCase().lastIndexOf('</body>');
    next = index < 0 ? next + tag : next.slice(0, index) + tag + next.slice(index);
  }
  var seenGrowth = false;
  next = next.replace(/<script\b[^>]*\bsrc=["']\/rankhound-conversion-events\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi, element => { if (seenGrowth) return ''; seenGrowth = true; return element; });
  return next.replace(/<script\b[^>]*\bsrc=["']\/(?:rankhound|fgfll)-conversion-events\.js(?:\?[^"']*)?["'][^>]*>/gi, opening =>
    opening.replace(/\sdefer(?:=(?:["'][^"']*["']|true|\{true\}))?/gi, '').replace(/^<script\b/i, '<script async').replace(/\basync(?:\s+async)+/gi, 'async').replace(/integrity=(["'])(.*?)\1/i, (_, quote, values) => {
      const bytes = fs.readFileSync(path.join(root, 'public/rankhound-conversion-events.js'));
      const hashes = values.split(/\s+/).map(value => {
        const algorithm = value.split('-')[0];
        return ['sha256', 'sha384', 'sha512'].includes(algorithm) ? algorithm + '-' + crypto.createHash(algorithm).update(bytes).digest('base64') : value;
      });
      return 'integrity=' + quote + hashes.join(' ') + quote;
    }));
}
function walk(dir, inject = true) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, inject);
    else if (/\.html?$/i.test(entry.name)) {
      const before = fs.readFileSync(file, 'utf8'); const after = transform(before, inject || /<html\b/i.test(before));
      if (after !== before) fs.writeFileSync(file, after);
    }
  }
}
function updateRuntimeReferences(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='api')continue;const file=path.join(dir,entry.name);if(entry.isDirectory())updateRuntimeReferences(file);else if(/\.(?:js|jsx|ts|tsx)$/.test(entry.name)){const before=fs.readFileSync(file,'utf8');let after=optionalFields(before);for(const name of legacyFiles)after=after.replaceAll('/'+name,growthUrl);after=after.replace(/\/rankhound-conversion-events\.js(?:\?[^"'<>\s)]*)?/g,growthUrl);if(before!==after)fs.writeFileSync(file,after);}}}
updateRuntimeReferences(path.join(root,'app'));
for(const relative of ['lib/site-html.js']){const file=path.join(root,relative);if(!fs.existsSync(file))continue;const before=fs.readFileSync(file,'utf8');let after=optionalFields(before);for(const name of legacyFiles)after=after.replaceAll('/'+name,growthUrl);after=after.replace(/\/rankhound-conversion-events\.js(?:\?[^"'<>\s)]*)?/g,growthUrl);if(before!==after)fs.writeFileSync(file,after);}

walk(path.join(root, 'public'));
for(const dir of ['data/rendered-pages','data/leak-first-rendered','rendered','.site/pages'])if(fs.existsSync(path.join(root,dir)))walk(path.join(root,dir),false);
for(const relative of ['data/pages.generated.json','data/routes.generated.json','data/site-catalog.generated.json','data/rendered-pages.json','data/site-pages.json']){
 const file=path.join(root,relative);if(!fs.existsSync(file))continue;const value=JSON.parse(fs.readFileSync(file,'utf8'));let changed=false;const records=Array.isArray(value.records)?value.records:Object.values(value);for(const record of records){if(record&&typeof record.html==='string'){const next=transform(record.html,/<html\b/i.test(record.html));if(next!==record.html){record.html=next;changed=true;}}}if(changed)fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
}

const generatedModule=path.join(root,'lib/generated-pages.mjs');if(fs.existsSync(generatedModule)){const before=fs.readFileSync(generatedModule,'utf8'),module=parseGeneratedPagesModule(before),pages=module.pages;let changed=module.repaired>0;for(const page of Object.values(pages)){if(page&&typeof page.html==='string'){const next=transform(page.html,/<html\b/i.test(page.html));if(next!==page.html){page.html=next;changed=true;}}}if(changed)fs.writeFileSync(generatedModule,module.prefix+JSON.stringify(pages)+module.suffix);}
execFileSync(process.execPath, [path.join(root, 'scripts/ensure-roofing-home-locality.mjs')], { cwd: root, stdio: 'inherit' });
for (const relative of ['app/lib/sitePage.tsx', 'app/ContactHydrator.tsx', 'app/site-renderer.jsx']) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8'); const after = optionalFields(before);
  if (after !== before) fs.writeFileSync(file, after);
}
for (const relative of ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js']) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  if (!before.includes('</body>')) continue;
  let after = replaceLegacy(before).replace(/<script\b[^>]*\bsrc=["']\/turnstile-contact\.js["'][^>]*\/?>\s*(?:<\/script>)?/gi, '');
  if(['ConversionEvents.jsx','ConversionEvents.js','ConversionEvents.tsx'].some(name=>{const file=path.join(root,'app',name);return fs.existsSync(file)&&crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')==='c5653702627bac599e6355cf8b93b7c56d730615cf5afaa4d202366d352c2d03';})){after=after.replace(/^import\s+ConversionEvents\s+from\s+["']\.\/ConversionEvents["'];?\s*$/gm,'').replace(/<ConversionEvents\s*\/>/g,'');}
  if (/<ConversionEvents\s*\/>/.test(after)) throw new Error('Review this legacy React conversion component before adding another tracker');
  after = after.replace(/(<script\b[^>]*\bsrc=)["']\/(?:rankhound|fgfll)-conversion-events\.js(?:\?[^"']*)?["']/gi, '$1' + '"' + growthUrl + '"');
  if (!after.includes('data-rh-growth-react')) after = after.replace(/<html\b/, '<html data-rh-growth-react=""');
  if (!after.includes('import RankHoundGrowth')) after = after.replace(/^(\s*["']use client["'];?\s*)?/, (prefix) => prefix + 'import RankHoundGrowth from "./RankHoundGrowth";\n');
  if (!after.includes('<RankHoundGrowth')) after = after.replace('</body>', '<RankHoundGrowth /></body>');
  if (!after.includes('/rankhound-conversion-events.js')) after = after.replace('</body>', '<script async src="' + growthUrl + '" /></body>');
  after = transform(after, false);
  fs.writeFileSync(file, after.replace(/^[\t ]+$/gm, ''));
  const contactLoader = fs.existsSync(path.join(root, 'public/turnstile-contact.js')) ? `
    if (!document.querySelector('script[data-rh-contact-ready]')) {
      const script = document.createElement('script');
      script.src = '/turnstile-contact.js';
      script.dataset.rhContactReady = 'true';
      document.body.appendChild(script);
    }` : '';
  fs.writeFileSync(path.join(root, 'app/RankHoundGrowth.jsx'), `"use client";
import { useEffect } from "react";
export default function RankHoundGrowth() {
  useEffect(() => {
    window.__rankhoundGrowthHydrated = true;
    document.dispatchEvent(new Event("rankhound:hydrated"));${contactLoader}
  }, []);
  return null;
}
`);
}

// Stop a build if an earlier generator changes the existing security controls.
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'data/roofing-growth-security-baseline.json'), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const handlerSource = fs.readFileSync(path.join(root, baseline.handlerFile), 'utf8');
const normalizedHandler = handlerSource.replace(/const REQUIRED_FIELDS = \[[^\]]+\];/, 'const REQUIRED_FIELDS = ["name", "phone", "email"];').replace(/leadAccepted: true,\s*/g, '');
if (sha256(normalizedHandler) !== baseline.handlerNormalizedSha256) throw new Error('Existing lead security or mail routing was changed by a build generator');
if (!/const REQUIRED_FIELDS = \["name", "phone", "email"\];/.test(handlerSource) || !handlerSource.includes('leadAccepted: true')) throw new Error('Callback handler was overwritten by a build generator');
const currentPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (sha256(JSON.stringify({dependencies:currentPackage.dependencies||{},devDependencies:currentPackage.devDependencies||{}})) !== baseline.dependenciesSha256) throw new Error('Contact rollout must preserve dependency versions');
for (const file of baseline.securityFiles) {
  if (sha256(fs.readFileSync(path.join(root, file.path))) !== file.sha256) throw new Error('Existing security file was changed: ' + file.path);
}
