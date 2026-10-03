#!/usr/bin/env python3
"""Regroups the caption track into whole phrases (one line on screen at a time).

captions.mjs groups ~3 words; with a 2.8-minute narration that flickers. Here a group ends at punctuation
or at a pause in the recording, holds ≤ 7 words / ≤ 40 characters, and short tails merge into the phrase
before them. Rewrites `var GROUPS = …` in compositions/captions.html (and caption_groups.json).
"""
import json, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT, 'audio_meta.json')))
MAXW, MAXC = 7, 40
groups, t0 = [], 0.0
for v in meta['voices']:
    ws = [dict(w, start=w['start'] + t0, end=w['end'] + t0) for w in v['words']]
    cur = []
    def flush():
        if cur: groups.append({'frame': v['frame'], 'words': list(cur)}); cur.clear()
    for i, w in enumerate(ws):
        if cur and (len(cur) >= MAXW or len(' '.join(x['text'] for x in cur + [w])) > MAXC): flush()
        cur.append(w)
        nxt = ws[i + 1] if i + 1 < len(ws) else None
        pause = nxt is not None and nxt['start'] - w['end'] > 0.22
        if re.search(r'[.:?!]$', w['text']) or (re.search(r',$', w['text']) and len(cur) >= 3) or pause: flush()
    flush()
    t0 += v['duration_s']
# merge 1–2-word groups into the previous group of the same frame when it fits
out = []
for g in groups:
    if out and len(g['words']) <= 2 and out[-1]['frame'] == g['frame'] and not re.search(r'[.?!]$', out[-1]['words'][-1]['text']) and len(out[-1]['words']) + len(g['words']) <= MAXW + 1 \
       and len(' '.join(x['text'] for x in out[-1]['words'] + g['words'])) <= MAXC + 8:
        out[-1]['words'] += g['words']
    else:
        out.append(g)
final = []
for i, g in enumerate(out):
    nxt = out[i + 1] if i + 1 < len(out) else None
    start = g['words'][0]['start']
    end = g['words'][-1]['end'] + 0.25
    if nxt: end = min(end, nxt['words'][0]['start'])
    final.append({'id': f'caption-group-{i}', 'frame': g['frame'], 'start': round(start, 3), 'end': round(end, 3),
                  'text': ' '.join(w['text'] for w in g['words']),
                  'words': [{'id': f'caption-word-{i}-{j}', 'text': w['text'], 'start': round(w['start'], 3), 'end': round(w['end'], 3)} for j, w in enumerate(g['words'])]})
p = os.path.join(ROOT, 'compositions', 'captions.html')
html = open(p, encoding='utf-8').read()
html = re.sub(r'var GROUPS = \[.*?\];\n', lambda m: 'var GROUPS = ' + json.dumps(final, ensure_ascii=False) + ';\n', html, count=1, flags=re.S)
open(p, 'w', encoding='utf-8').write(html)
cg = os.path.join(ROOT, 'caption_groups.json')
d = json.load(open(cg)); d['groups'] = final; json.dump(d, open(cg, 'w'), ensure_ascii=False, indent=1)
print(len(final), 'groups')
for g in final[:20]: print(f"{g['start']:7.2f}–{g['end']:7.2f}  {g['text']}")
