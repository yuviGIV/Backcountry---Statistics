import sys, json, duckdb, re
out = sys.argv[1]
con = duckdb.connect()
con.execute(f"CREATE TABLE A AS SELECT * FROM '{out}/A.csv'")
con.execute(f"CREATE TABLE M AS SELECT * FROM '{out}/M.csv'")
def city(desc):
    m = re.search(r'עיר:\s*(.*?)\s*רציף', desc or '')
    return m.group(1).strip() if m else ''
A = []
for sid,name,desc,lat,lon,trips,mn,med,lines in con.execute("select stop_id,stop_name,stop_desc,lat,lon,trips,min_min,med_min,lines from A").fetchall():
    A.append(dict(id=sid,name=name,city=city(desc),lat=lat,lon=lon,trips=trips,med=med,lines=lines,matches=[]))
idx = {a['id']:a for a in A}
for aid,bname,blat,blon,blines,bmin,btrips,dist in con.execute("select a_id,b_name,b_lat,b_lon,b_lines,b_min,b_trips,dist_m from M").fetchall():
    idx[aid]['matches'].append(dict(b=bname,lat=blat,lon=blon,lines=blines,med=bmin,trips=btrips,dist=dist))
for a in A:
    a['matches'].sort(key=lambda m:(m['dist'],m['med']))
json.dump(A, open(f'{out}/data.json','w'), ensure_ascii=False)
from collections import Counter
print(Counter(a['city'] for a in A))
print("A stops with a match:", sum(1 for a in A if a['matches']), "of", len(A))
print("exact same stop:", [(a['name'],a['city'],a['lines'],[ (m['lines'],m['med']) for m in a['matches'] if m['dist']==0]) for a in A if any(m['dist']==0 for m in a['matches'])])

# stops in the Tel Aviv area with a direct ride to work, for the "catch the work bus here" layer
B = [dict(id=sid, name=name, city=city(desc), lat=lat, lon=lon, trips=trips, med=med, lines=lines)
     for sid, name, desc, lat, lon, trips, med, lines in con.execute(f"""
     select stop_id,stop_name,stop_desc,lat,lon,trips,med_min,lines from '{out}/B.csv'
     where lat between 32.03 and 32.135 and lon between 34.74 and 34.87""").fetchall()]
json.dump(B, open(f'{out}/work.json', 'w'), ensure_ascii=False)
print("work-bus stops in Tel Aviv area:", len(B))
