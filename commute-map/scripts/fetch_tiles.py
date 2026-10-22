# Downloads OpenStreetMap tiles for the map into <out>/tiles/{z}/{x}/{y}.png.
# Polite by design: identified User-Agent, one request at a time with a pause, skips tiles already on disk.
# Usage: python3 -I fetch_tiles.py <out dir> [--z16]
import sys, os, math, time, urllib.request

out = sys.argv[1]
UA = "commute-map/1.0 (personal one-off, ~200 tiles; contact yuvalgiv98@gmail.com)"
# (south, west, north, east), zoom levels
AREAS = [
    ((32.03, 34.74, 32.31, 34.90), range(11, 13)),   # Tel Aviv up to Netanya, overview
    ((32.03, 34.74, 32.135, 34.87), range(13, 16)),  # Tel Aviv / Ramat Gan / Givatayim / Bnei Brak
]
if "--z16" in sys.argv:
    AREAS.append(((32.06, 34.765, 32.105, 34.83), range(16, 17)))

def tile(lat, lon, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y

todo = []
for (s, w, n, e), zs in AREAS:
    for z in zs:
        x0, y0 = tile(n, w, z); x1, y1 = tile(s, e, z)
        todo += [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
todo = sorted(set(todo))
print(len(todo), "tiles")
got = 0
for z, x, y in todo:
    p = f"{out}/tiles/{z}/{x}/{y}.png"
    if os.path.exists(p):
        continue
    os.makedirs(os.path.dirname(p), exist_ok=True)
    req = urllib.request.Request(f"https://tile.openstreetmap.org/{z}/{x}/{y}.png", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        open(p, "wb").write(r.read())
    got += 1
    time.sleep(0.5)
print("downloaded", got)
