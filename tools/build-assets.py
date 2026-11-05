#!/usr/bin/env python3
"""Builds web-optimised assets from the original folders into site/assets.
Usage: python3 tools/build-assets.py   (run from /data/PORTFOLIO/site)
Originals are never modified. Safe to re-run: existing outputs are skipped."""
import subprocess, hashlib, json, re, glob, os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "site" / "assets"

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def probe(p):
    r = subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
        "stream=width,height:format=duration","-of","json",str(p)],capture_output=True,text=True)
    d = json.loads(r.stdout); s = d["streams"][0]
    return int(s["width"]), int(s["height"]), float(d["format"]["duration"])

def complete(p, dur):
    """True if p exists and its duration matches the source (guards against truncated files)."""
    if not p.exists(): return False
    try: return abs(probe(p)[2]-dur) < 1.0
    except Exception: return False

def unique_names(items):
    """slug() can collide ("COMP (02)" vs "COMP 02"); give later duplicates a -2, -3 suffix."""
    seen, out = {}, {}
    for src, folder in items:
        base = slug(f"{folder}-{src.stem}")
        seen[base] = seen.get(base, 0) + 1
        out[str(src)] = base if seen[base] == 1 else f"{base}-{seen[base]}"
    return out

NAMES = {}

def do_video(item):
    src, folder = item
    name = NAMES[str(src)]
    vid, post = OUT/"video"/f"{name}.mp4", OUT/"poster"/f"{name}.jpg"
    w,h,dur = probe(src)
    # cap the long edge to 1280 (720p class); keep aspect, even dimensions
    scale = "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'"
    if not complete(vid, dur):
        tmp = vid.with_suffix(".tmp.mp4")
        subprocess.run(["ffmpeg","-y","-v","error","-i",str(src),"-vf",scale+",format=yuv420p",
            "-c:v","libx264","-preset","fast","-threads","2","-crf","27","-maxrate","3M","-bufsize","6M",
            "-c:a","aac","-b:a","96k","-movflags","+faststart",str(tmp)],check=True)
        tmp.replace(vid)
    if not post.exists():
        subprocess.run(["ffmpeg","-y","-v","error","-ss",str(min(1.5,dur/3)),"-i",str(src),"-frames:v","1",
            "-vf",scale+",scale=iw*min(1\\,720/iw):-2","-q:v","4",str(post)],check=True)
    return dict(id=name, folder=folder, file=src.name, w=w, h=h, dur=round(dur,1))

def do_photos():
    seen, out = set(), []
    for album in ("ATHIRADI","VEDAN"):
        for f in sorted(glob.glob(str(ROOT/"PHOTOGRAPHS"/album/"*"))):
            data = Path(f).read_bytes()
            hsh = hashlib.md5(data).hexdigest()
            if hsh in seen: continue           # skip exact duplicates ("(1)" copies)
            seen.add(hsh)
            name = slug(f"{album}-{Path(f).name.split('.')[0]}")
            im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
            dst = OUT/"photos"/f"{name}.jpg"
            if not dst.exists():
                big = im.copy(); big.thumbnail((1800,1800)); big.save(dst,quality=82,optimize=True,progressive=True)
            th = OUT/"photos"/f"{name}-t.jpg"
            if not th.exists():
                t = im.copy(); t.thumbnail((700,700)); t.save(th,quality=78,optimize=True,progressive=True)
            out.append(dict(id=name, album=album, w=im.width, h=im.height))
    return out

if __name__ == "__main__":
    items = []
    for folder, pat in (("desgro","desgro/*.mp4"),("fast cuts","fast cuts/*.mp4"),("red bull","RED BULL.mp4")):
        for f in sorted(glob.glob(str(ROOT/pat))): items.append((Path(f), folder))
    NAMES.update(unique_names(items))
    def safe(item):
        try: return do_video(item)
        except Exception as e: print("FAILED", item[0].name, e); return None
    with ThreadPoolExecutor(max_workers=2) as ex: videos = [v for v in ex.map(safe, items) if v]
    photos = do_photos()
    (ROOT/"site"/"tools"/"manifest.json").write_text(json.dumps(dict(videos=videos,photos=photos),indent=1))
    print(len(videos),"videos,",len(photos),"photos")
