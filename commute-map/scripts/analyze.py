import sys, duckdb
gtfs, out = sys.argv[1], sys.argv[2]
con = duckdb.connect()
con.execute("PRAGMA threads=2")
con.execute(f"CREATE TABLE st AS SELECT * FROM '{out}/st.parquet'")
con.execute(f"CREATE TABLE trips AS SELECT * FROM '{out}/trips.parquet'")
con.execute(f"""CREATE TABLE stops AS SELECT CAST(stop_id AS INTEGER) stop_id, stop_name, stop_desc,
   CAST(stop_lat AS DOUBLE) lat, CAST(stop_lon AS DOUBLE) lon
   FROM read_csv('{gtfs}/stops.txt', header=true, all_varchar=true)""")
con.execute(f"""CREATE TABLE routes AS SELECT route_id, route_short_name, route_long_name, agency_id, route_type
   FROM read_csv('{gtfs}/routes.txt', header=true, all_varchar=true)""")
con.execute(f"""CREATE TABLE agency AS SELECT agency_id, agency_name FROM read_csv('{gtfs}/agency.txt', header=true, all_varchar=true)""")

SHENKAR = (12918, 13920)
WORK = (621, 40899)
W0, W1 = 7*3600, 9*3600   # departure window at origin

def rides(targets, maxsec=None):
    t = ",".join(map(str, targets))
    sql = f"""
    CREATE OR REPLACE TABLE r AS
    SELECT o.trip_id, o.stop_id origin, o.dep, d.stop_id dest, d.arr - o.dep secs, tr.route_id, tr.trip_headsign
    FROM st o JOIN st d ON o.trip_id=d.trip_id AND o.seq < d.seq
    JOIN trips tr ON tr.trip_id=o.trip_id
    WHERE d.stop_id IN ({t}) AND o.dep BETWEEN {W0} AND {W1}
      AND o.pickup != 1 AND d.dropoff != 1
      {f'AND d.arr - o.dep <= {maxsec}' if maxsec else ''}
    """
    con.execute(sql)

def summarize(name):
    con.execute(f"""
    CREATE OR REPLACE TABLE {name} AS
    SELECT r.origin stop_id, s.stop_name, s.stop_desc, s.lat, s.lon,
           count(*) trips, round(min(secs)/60.0,1) min_min, round(median(secs)/60.0,1) med_min,
           string_agg(DISTINCT rt.route_short_name || ' (' || ag.agency_name || ')', ', ') lines
    FROM r JOIN stops s ON s.stop_id=r.origin
    JOIN routes rt ON rt.route_id=r.route_id JOIN agency ag ON ag.agency_id=rt.agency_id
    GROUP BY ALL
    """)

rides(SHENKAR, 900); summarize("A")
rides(WORK); summarize("B")
print("A (<=15min to Bialik/Tuval, dep 7-9):", con.execute("select count(*) from A").fetchone(), "stops")
print("B (direct to Hermelin/HaMehkar, dep 7-9):", con.execute("select count(*) from B").fetchone(), "stops")
con.execute(f"COPY A TO '{out}/A.csv' (HEADER)"); con.execute(f"COPY B TO '{out}/B.csv' (HEADER)")

# same physical stop in both, or within 400m
con.execute("""
CREATE TABLE M AS
SELECT a.stop_id a_id, a.stop_name a_name, a.stop_desc a_desc, a.lat a_lat, a.lon a_lon, a.lines a_lines, a.trips a_trips, a.med_min a_min,
       b.stop_id b_id, b.stop_name b_name, b.lat b_lat, b.lon b_lon, b.lines b_lines, b.trips b_trips, b.med_min b_min,
       round(111320*sqrt(power(a.lat-b.lat,2)+power(cos(radians(a.lat))*(a.lon-b.lon),2))) dist_m
FROM A a JOIN B b ON 111320*sqrt(power(a.lat-b.lat,2)+power(cos(radians(a.lat))*(a.lon-b.lon),2)) <= 400
""")
con.execute(f"COPY M TO '{out}/M.csv' (HEADER)")
print("matches:", con.execute("select count(*) from M").fetchone())
print(con.execute("select count(*) from M where dist_m=0").fetchone(), "exact same stop")
print(con.execute("select a_name, a_lines, a_min, b_lines, b_min, dist_m from M order by dist_m, b_min limit 40").fetchall())
