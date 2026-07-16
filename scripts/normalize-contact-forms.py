#!/usr/bin/env python3
from pathlib import Path
import re, sys
try:
    from bs4 import BeautifulSoup
except Exception as exc:
    raise SystemExit(f"BeautifulSoup unavailable: {exc}")
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1])
TEXT_EXTS = {'.html','.json','.js','.jsx','.ts','.tsx','.mjs'}
SKIP = {'.git','node_modules','.next','qa-out'}

def route_for(path):
    rel = path.relative_to(ROOT)
    parts = list(rel.parts)
    if parts and parts[0] == 'public': parts = parts[1:]
    if parts[:1] == ['__static-pages']:
        name = Path(parts[-1]).stem
        if name in ('index','home','root'): return '/'
        return '/' + name.replace('__','/').replace('_','-')
    if parts[:1] == ['data'] and len(parts) >= 3 and parts[1] == 'rendered-pages':
        name = Path(parts[-1]).stem
        if name in ('index','home'): return '/'
        return '/' + '/'.join(parts[2:]).replace('/index.html','').replace('.html','')
    if not parts: return '/'
    if parts[-1] in ('index.html','home.html'): parts = parts[:-1]
    else: parts[-1] = Path(parts[-1]).stem
    route = '/' + '/'.join(p for p in parts if p and p != 'public')
    return route.replace('/home','/') or '/'

def has_name(form, name):
    return form.find(attrs={'name': name}) is not None

def prepend_hidden(soup, form, name, value):
    if has_name(form, name): return
    tag = soup.new_tag('input')
    tag['type'] = 'hidden'; tag['name'] = name; tag['value'] = value
    form.insert(0, tag)

def is_contact_form(form):
    blob = ' '.join([str(form.get('action') or ''), ' '.join(form.get('class') or []), str(form.get('id') or ''), str(form.get('data-contact-form') or ''), form.get_text(' ', strip=True)]).lower()
    names = {el.get('name','').lower() for el in form.find_all(['input','textarea','select'])}
    return ('/api/contact' in blob or '/api/submit' in blob or 'contact' in blob or 'lead' in blob or {'name','email','phone'} <= names or {'fullname','email','phone'} <= names)

def normalize_html(path):
    before = path.read_text(errors='ignore')
    soup = BeautifulSoup(before, 'html.parser')
    changed = False
    for form in soup.find_all('form'):
        if not is_contact_form(form):
            continue
        if form.get('action') != '/api/submit': form['action'] = '/api/submit'; changed = True
        if (form.get('method') or '').lower() != 'post': form['method'] = 'post'; changed = True
        for attr in ['enctype', 'target', 'onsubmit']:
            if form.has_attr(attr):
                del form[attr]; changed = True
        if not form.has_attr('data-contact-form'): form['data-contact-form'] = ''; changed = True
        names = {el.get('name','') for el in form.find_all(['input','textarea','select'])}
        prepend_hidden(soup, form, 'serviceType', 'Commercial Roofing')
        prepend_hidden(soup, form, 'page', route_for(path))
        if '_company' not in names:
            hp = soup.new_tag('input')
            hp['type']='text'; hp['name']='_company'; hp['autocomplete']='off'; hp['tabindex']='-1'; hp['aria-hidden']='true'; hp['style']='position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden'
            form.append(hp); changed = True
        names = {el.get('name','') for el in form.find_all(['input','textarea','select'])}
        phone_aliases = {'phone','phoneNumber','phone_number','telephone','tel'}
        if not any(n in names for n in phone_aliases):
            wrapper = soup.new_tag('label')
            wrapper.string = 'Phone'
            phone = soup.new_tag('input')
            phone['name'] = 'phone'; phone['type'] = 'tel'; phone['required'] = ''; phone['autocomplete'] = 'tel'; phone['placeholder'] = 'Phone'
            wrapper.append(phone)
            anchor = form.find('textarea') or form.find(['button','input'], attrs={'type':'submit'})
            if anchor is not None:
                anchor.insert_before(wrapper)
            else:
                form.append(wrapper)
            changed = True
        names = {el.get('name','') for el in form.find_all(['input','textarea','select'])}
        if 'timeline' not in names:
            prepend_hidden(soup, form, 'timeline', 'Not sure yet'); changed = True
        if 'message' not in names and not any(n in names for n in ['projectDetails','project_details','details','comments','notes']):
            prepend_hidden(soup, form, 'message', 'Roof assessment request'); changed = True
        for wanted in ['name','email','phone','timeline','message']:
            for el in form.find_all(['input','textarea','select'], attrs={'name': wanted}):
                if el.get('type') != 'hidden' and not el.has_attr('required'):
                    el['required'] = ''; changed = True
    after = str(soup) if changed else before
    after = after.replace('/api/contact', '/api/submit')
    if after != before:
        path.write_text(after)
        return True
    return False

def normalize_text(path):
    before = path.read_text(errors='ignore')
    after = before.replace('/api/contact', '/api/submit')
    if after != before:
        path.write_text(after)
        return True
    return False

count = 0
for path in ROOT.rglob('*'):
    if not path.is_file() or path.suffix.lower() not in TEXT_EXTS: continue
    if any(part in SKIP for part in path.parts): continue
    if path.suffix.lower() == '.html':
        count += int(normalize_html(path))
    else:
        count += int(normalize_text(path))
print(f'normalize-contact-forms: updated {count} files')
