import json, sys
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET
out = sys.argv[1]
D = json.load(open(f'{out}/data.json', encoding='utf-8'))
isExact = lambda d: any(m['dist'] == 0 for m in d['matches'])
styles = {'dest': 'ff2b56c2', 'exact': 'ff14aae6', 'near': 'ff5b8a1f', 'reach': 'ff9f6f2f'}
def style(i, c):
    return (f'<Style id="{i}"><IconStyle><color>{c}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>')
def pm(name, lat, lon, desc, sid):
    return (f'<Placemark><name>{escape(name)}</name><description><![CDATA[{desc}]]></description>'
            f'<styleUrl>#{sid}</styleUrl><Point><coordinates>{lon},{lat}</coordinates></Point></Placemark>')
dest = [('שנקר: ביאליק/תובל (רחוב ביאליק 114)', 32.088275, 34.804620), ('שנקר: ביאליק/תובל (רחוב ביאליק 134)', 32.088489, 34.804702),
        ('עבודה: מכללת הרמלין/המחקר (המחקר 1)', 32.291133, 34.864850), ('עבודה: מכללת הרמלין/המחקר', 32.290960, 34.865025)]
def desc(d):
    s = f"{d['city']}<br>לשנקר: {d['lines']}, כ-{round(d['med'])} דק' נסיעה ({d['trips']} נסיעות 7:00-9:00)"
    for m in d['matches'][:3]:
        where = 'מאותה תחנה' if m['dist'] == 0 else f"הליכה {int(m['dist'])} מ' אל {m['b']}"
        s += f"<br>לעבודה ({where}): {m['lines']}, כ-{round(m['med'])} דק' נסיעה"
    return s
folders = [
 ('יעדים: שנקר ועבודה', 'dest', [pm(n, la, lo, 'יעד', 'dest') for n, la, lo in dest]),
 ('אותה תחנה: שנקר ועבודה', 'exact', [pm(d['name'], d['lat'], d['lon'], desc(d), 'exact') for d in D if isExact(d)]),
 ("חיבור לעבודה בהליכה עד 400 מ'", 'near', [pm(d['name'], d['lat'], d['lon'], desc(d), 'near') for d in D if d['matches'] and not isExact(d)]),
 ('מגיעות לשנקר בלבד (עד 15 דק)', 'reach', [pm(d['name'], d['lat'], d['lon'], desc(d), 'reach') for d in D if not d['matches']]),
]
kml = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>תחנות שנקר ונתניה</name>'
kml += ''.join(style(k, c) for k, c in styles.items())
for name, _, pms in folders:
    kml += f'<Folder><name>{escape(name)}</name>' + ''.join(pms) + '</Folder>'
kml += '</Document></kml>'
open(f'{out}/stops.kml', 'w', encoding='utf-8').write(kml)
root = ET.parse(f'{out}/stops.kml').getroot()
print({n: len(p) for n, _, p in folders}, 'xml ok')
