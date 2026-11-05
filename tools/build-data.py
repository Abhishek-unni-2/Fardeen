#!/usr/bin/env python3
"""Generates js/data.js from whichever assets exist in assets/.
Edit TITLES / CATS below to rename or regroup work, then re-run: python3 tools/build-data.py"""
import json, re, subprocess
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
A = SITE / "assets"

CATEGORIES = {"desgro": "Desgro Academy", "fast": "Fast Cuts", "film": "Brand Film"}
ALBUMS = {"ATHIRADI": "Athiradi", "VEDAN": "Vedan"}

# id -> (title, category). Anything missing is auto-titled from the filename.
TITLES = {
    "red-bull-red-bull": ("Red Bull — Showreel", "film"),
    "desgro-ann-final": ("Story Telling Session", "desgro"),
    "desgro-aflu": ("Why Stories Matter", "desgro"),
    "desgro-chanakya-out": ("Finance Professionals", "desgro"),
    "desgro-burger-dude-re": ("The Burger Dude", "desgro"),
    "desgro-a-02": ("The Importance of Portfolio", "desgro"),
    "desgro-final-out": ("Professional Cutting", "desgro"),
    "desgro-dspace-out": ("D-Space", "desgro"),
    "desgro-games-out": ("Games Night", "desgro"),
    "desgro-imposter": ("Imposter", "desgro"),
    "desgro-comp-01": ("Comp 01", "desgro"),
    "desgro-comp-02": ("Comp 02", "desgro"),
    "desgro-03-re": ("Career Path", "desgro"),
    "desgro-0820-1": ("Student Spotlight", "desgro"),
    # placeholders for files whose names say nothing — rename these once you know the real project names
    "desgro-out": ("Reel Edit 04", "desgro"), "desgro-re-01": ("Reel Edit 01", "desgro"),
    "desgro-re-02": ("Reel Edit 02", "desgro"), "desgro-re-02-2": ("Reel Edit 03", "desgro"),
    "desgro-comp-02-2": ("Comp 03", "desgro"), "desgro-img-0370": ("Raw Footage Cut", "desgro"),
    "desgro-vertex": ("Vertex — Cut 1", "desgro"), "desgro-vertex-re-03": ("Vertex — Cut 2", "desgro"),
    "fast-cuts-0": ("Fast Cut 01", "fast"), "fast-cuts-1": ("Fast Cut 02", "fast"),
    "fast-cuts-2": ("Fast Cut 03", "fast"), "fast-cuts-11278": ("Fast Cut 04", "fast"),
}

def probe(p):
    r = subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
        "stream=width,height:format=duration","-of","json",str(p)],capture_output=True,text=True)
    d = json.loads(r.stdout); s = d["streams"][0]
    return int(s["width"]), int(s["height"]), round(float(d["format"]["duration"]),1)

videos = []
for v in sorted((A/"video").glob("*.mp4")):
    if v.name.endswith(".tmp.mp4"): continue
    vid = v.stem
    if not (A/"poster"/f"{vid}.jpg").exists(): continue      # still encoding
    try: w,h,dur = probe(v)
    except Exception: continue
    if vid in TITLES: title, cat = TITLES[vid]
    else:
        cat = "fast" if vid.startswith("fast-cuts") else "desgro"
        base = re.sub(r"^(desgro|fast-cuts)-","",vid)
        title = re.sub(r"\b(out|re|final)\b","",base.replace("-"," ")).strip().title() or base
    videos.append(dict(id=vid,title=title,cat=cat,w=w,h=h,dur=dur))

# showreel first, then the rest
videos.sort(key=lambda v: (v["id"]!="red-bull-red-bull", v["cat"]!="film", v["id"]))

photos = []
for t in sorted((A/"photos").glob("*-t.jpg")):
    pid = t.name[:-6]
    from PIL import Image
    w,h = Image.open(A/"photos"/f"{pid}.jpg").size
    album = "ATHIRADI" if pid.startswith("athiradi") else "VEDAN"
    photos.append(dict(id=pid,album=album,w=w,h=h))

out = dict(videos=videos, photos=photos, albums=ALBUMS, categories=CATEGORIES)
(SITE/"js"/"data.js").write_text("window.PORTFOLIO = "+json.dumps(out,indent=1)+";\n")
print(len(videos),"videos,",len(photos),"photos")
