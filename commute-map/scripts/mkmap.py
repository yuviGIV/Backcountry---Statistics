# Builds <out>/map/index.html from map_leaflet.html + data.json + work.json + Leaflet's CSS.
# Usage: python3 -I mkmap.py <out dir> <leaflet.css>
# Put the tiles next to it (<out>/map/tiles/...) with fetch_tiles.py <out>/map
import sys, os
out, leaflet_css = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
page = open(f"{here}/map_leaflet.html", encoding="utf-8").read()
page = (page.replace("/*LEAFLETCSS*/", open(leaflet_css, encoding="utf-8").read())
            .replace("/*DATA*/[]", open(f"{out}/data.json", encoding="utf-8").read())
            .replace("/*WORK*/[]", open(f"{out}/work.json", encoding="utf-8").read()))
os.makedirs(f"{out}/map", exist_ok=True)
open(f"{out}/map/index.html", "w", encoding="utf-8").write(page)
print(f"{out}/map/index.html", len(page), "bytes")
