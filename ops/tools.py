#!/usr/bin/env python3
"""Cleanup helper. usage:
  tools.py extract OUTDIR slug1 slug2 ...   -> OUTDIR/<slug>.json {slug,category,tool,peers}
  tools.py apply FIXEDDIR                    -> validates + splices each <slug>.json (full tool dict) into build.py
"""
import ast, json, re, sys, os, datetime
SRC = 'build.py'
def slugify(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
def load():
    src = open(SRC, encoding='utf-8').read()
    tree = ast.parse(src)
    cats = None
    for n in tree.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], 'id', '') == 'CATEGORIES':
            cats = n.value; break
    out = []  # (cat_slug, cat_name, tool_dict_node)
    for c in cats.elts:
        cd = {}
        for k, v in zip(c.keys, c.values):
            if isinstance(k, ast.Constant) and k.value in ('name', 'slug'):
                cd[k.value] = ast.literal_eval(v)
            if isinstance(k, ast.Constant) and k.value == 'tools':
                tools = v
        for t in tools.elts:
            out.append((cd.get('slug'), cd.get('name'), t))
    return src, out
def offsets(src):
    lines = src.split('\n'); acc = [0]
    for l in lines: acc.append(acc[-1] + len(l.encode('utf-8')) + 1)
    return acc
def pos(src_b, acc, lineno, col): return acc[lineno-1] + col
def extract(outdir, slugs):
    src, items = load(); os.makedirs(outdir, exist_ok=True)
    allslugs = {}
    for cs, cn, node in items:
        d = ast.literal_eval(node); allslugs[slugify(d['name'])] = (cs, cn, d)
    for s in slugs:
        cs, cn, d = allslugs[s]
        peers = [{'slug': k, 'name': v[2]['name'], 'tagline': v[2]['tagline']} for k, v in allslugs.items() if v[0] == cs and k != s]
        json.dump({'slug': s, 'category': cs, 'tool': d, 'peers': peers}, open(f'{outdir}/{s}.json', 'w'), indent=1)
        print(s, cs, len(peers))
REQ = ['name','tagline','desc','pricing','url','tags','features','pros','cons','best_for','deep','last_checked','alternatives']
DEEP = ['overview','who_for','features_detailed','pricing_plans','pros_expanded','cons_expanded','faq']
def validate(slug, d, valid):
    errs = []
    for k in REQ:
        if k not in d: errs.append('missing '+k)
    for k in DEEP:
        if k not in d.get('deep', {}): errs.append('missing deep.'+k)
    if slugify(d.get('name','')) != slug: errs.append('name/slug mismatch')
    if d.get('last_checked') != datetime.date.today().isoformat(): errs.append('last_checked not today')
    for a in d.get('alternatives', []):
        if a.get('slug') not in valid or a['slug'] == slug: errs.append('bad alt '+str(a.get('slug')))
    ov = d.get('deep', {}).get('overview', '')
    if len(ov) < 200: errs.append('overview short')
    if not 3 <= len(d.get('deep', {}).get('faq', [])) <= 6: errs.append('faq count')
    return errs
def apply(fdir):
    src, items = load(); sb = src.encode('utf-8'); acc = offsets(src)
    valid = {slugify(ast.literal_eval(n)['name']) for _, _, n in items}
    edits = []; ok = []
    for f in sorted(os.listdir(fdir)):
        if not f.endswith('.json'): continue
        slug = f[:-5]; d = json.load(open(f'{fdir}/{f}'))
        if 'tool' in d and 'name' not in d: d = d['tool']
        if d.get('verdict') == 'REMOVE': print('REMOVE-PROPOSED', slug, d.get('reason')); continue
        errs = validate(slug, d, valid)
        if errs: print('FAIL', slug, errs); continue
        for cs, cn, node in items:
            if slugify(ast.literal_eval(node)['name']) == slug:
                a = pos(sb, acc, node.lineno, node.col_offset); b = pos(sb, acc, node.end_lineno, node.end_col_offset)
                edits.append((a, b, repr(d).encode('utf-8'))); ok.append(slug); break
    for a, b, r in sorted(edits, reverse=True): sb = sb[:a] + r + sb[b:]
    open(SRC, 'wb').write(sb); ast.parse(sb.decode('utf-8'))
    print('APPLIED', ok)
if __name__ == '__main__':
    if sys.argv[1] == 'extract': extract(sys.argv[2], sys.argv[3:])
    else: apply(sys.argv[2])
