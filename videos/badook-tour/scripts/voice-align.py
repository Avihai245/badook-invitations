#!/usr/bin/env python3
"""Cuts the supplied narration into one clip per frame and times its words (no ASR available).

The recording reads video/NARRATION.he.md verbatim. Segment windows come from a silence-based
forced alignment (/tmp/claude-0/vo/segments.json + chunks.json: speech chunks between pauses).
Frame k spans from the middle of the pause before its segment to the middle of the pause after
it, so the 17 clips laid end to end ARE the original recording. Inside a segment, the words are
split across its speech chunks (a DP that matches each chunk's length to its share of characters
and prefers to break after punctuation), then spread over each chunk by character count.

Writes assets/voice/NN.wav and audio_meta.json (product-launch shape: frame-relative words).
"""
import json, re, subprocess, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]
VO = '/tmp/claude-0/vo'
TAIL = 3.0  # the end card holds "שימוש חינם" after the last word

segs = json.load(open(f'{VO}/segments.json'))
chunks_raw = json.load(open(f'{VO}/chunks.json'))
speech = chunks_raw['speech'] if 'speech' in chunks_raw else chunks_raw['chunks']
total = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SRC]).decode())

# the 17 texts, in order, from the narration doc ("**N · `id.mp3`**" then "> text")
doc = open(os.path.join(ROOT, '..', '..', 'video', 'NARRATION.he.md'), encoding='utf-8').read()
texts = dict(re.findall(r"\*\*\d+ · `(\w+)\.mp3`\*\*[^\n]*\n> ([^\n]+)", doc))
assert len(texts) == 17, texts.keys()

bounds = [0.0] + [(segs[i - 1]['end'] + segs[i]['start']) / 2 for i in range(1, len(segs))] + [total]
os.makedirs(os.path.join(ROOT, 'assets', 'voice'), exist_ok=True)

def split_words(text):
    return [w for w in text.replace('—', ' — ').split() if w != '—']

def partition(words, durs):
    """words → len(durs) contiguous groups: each group's character share ≈ its chunk's time share."""
    n, k = len(words), len(durs)
    if k == 1: return [words]
    L = [len(w) + 1 for w in words]
    pre = [0]
    for x in L: pre.append(pre[-1] + x)
    T, C = sum(durs), pre[-1]
    INF = float('inf')
    best = [[INF] * (n + 1) for _ in range(k + 1)]
    back = [[0] * (n + 1) for _ in range(k + 1)]
    best[0][0] = 0
    for j in range(1, k + 1):
        for i in range(j, n - (k - j) + 1):
            for p in range(j - 1, i):
                if best[j - 1][p] == INF: continue
                share = (pre[i] - pre[p]) / C * T
                cost = (share - durs[j - 1]) ** 2 / max(durs[j - 1], 0.3)
                if j < k and not re.search(r'[,.:?!—]$', words[i - 1]): cost += 0.6  # a pause mid-phrase is rarer
                if best[j - 1][p] + cost < best[j][i]:
                    best[j][i], back[j][i] = best[j - 1][p] + cost, p
    out, i = [], n
    for j in range(k, 0, -1):
        p = back[j][i]; out.append(words[p:i]); i = p
    return out[::-1]

voices = []
for idx, s in enumerate(segs):
    num = idx + 1
    f0, f1 = bounds[idx], bounds[idx + 1]
    a, b = s['chunks']
    ch = [speech[c] for c in range(a, b + 1)]
    words = split_words(texts[s['id']])
    groups = partition(words, [c[1] - c[0] for c in ch])
    timed, wid = [], 0
    for (c0, c1), grp in zip(ch, groups):
        if not grp: continue
        weights = [len(w.strip(',.:?!')) + 1.5 for w in grp]
        tw, t = sum(weights), c0
        for w, wt in zip(grp, weights):
            d = (c1 - c0) * wt / tw
            timed.append({'id': f'w{num:02d}_{wid}', 'text': w, 'start': round(t - f0, 3), 'end': round(t + d - f0 - 0.02, 3)})
            t += d; wid += 1
    path = f'assets/voice/{num:02d}.wav'
    dur = f1 - f0
    cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', f'{f0:.4f}', '-t', f'{dur:.4f}', '-i', SRC, '-ac', '1', '-ar', '48000']
    if num == len(segs):
        cmd += ['-af', f'apad=pad_dur={TAIL}']; dur += TAIL
    subprocess.check_call(cmd + [os.path.join(ROOT, path)])
    voices.append({'frame': num, 'id': s['id'], 'path': path, 'duration_s': round(dur, 3), 'start_in_recording_s': round(f0, 3), 'words': timed})
    print(f'{num:02d} {s["id"]:9s} {f0:7.2f}–{f1:7.2f}  {dur:5.2f}s  {len(timed)} words  ' + ' | '.join(' '.join(g) for g in groups))

meta = {'bgm': None, 'bgm_pending': False, 'voices': voices, 'sfx': [],
        'source': {'file': os.path.basename(SRC), 'duration_s': round(total, 3), 'note': 'supplied recording, cut at mid-pause; words force-aligned by speech chunk'}}
json.dump(meta, open(os.path.join(ROOT, 'audio_meta.json'), 'w'), ensure_ascii=False, indent=1)
print('total', round(sum(v['duration_s'] for v in voices), 3))
