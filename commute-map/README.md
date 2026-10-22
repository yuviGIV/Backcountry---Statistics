# מפת תחנות שנקר ונתניה

חיפוש אזור מגורים לפי תחבורה ציבורית: תחנות שמגיעות לשנקר (ביאליק/תובל, רמת גן) תוך 15 דקות, ואילו מהן מחוברות לקו ישיר לעבודה (הרמלין/המחקר, נתניה). הרקע המלא נמצא ב-`HANDOFF.md`.

## הרצה מההתחלה
```
pip install duckdb
# GTFS: https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip -> gtfs/
python3 -I scripts/prep.py gtfs out 20261025
python3 -I scripts/analyze.py gtfs out
python3 -I scripts/mkjson.py out          # data.json + work.json
python3 -I scripts/mkmap.py out scripts/leaflet-1.9.4.css   # out/map/index.html
python3 -I scripts/fetch_tiles.py out/map # ~210 אריחי OSM אל out/map/tiles/
```
אחרי הורדת האריחים, לפתוח את `out/map/index.html` דרך שרת מקומי (`python3 -m http.server` בתוך `out/map`).

## מה חדש לעומת הגרסה הסכמטית
- מפת Leaflet על רקע OpenStreetMap, עם האריחים שמורים מקומית (z11-12 עד נתניה, z13-15 תל אביב/רמת גן). מעבר ל-z15 המפה מגדילה את אריחי z15.
- שכבה חדשה: תחנות באזור תל אביב שיש מהן קו ישיר לעבודה (`work.json`).
- בבחירת תחנה מוצג קו הליכה מקווקו אל תחנת הקו לעבודה.
- מצב כהה: האריחים מוצגים הפוכים כדי להתאים לרקע.
