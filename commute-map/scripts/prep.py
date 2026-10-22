import sys, duckdb
gtfs, out, date = sys.argv[1], sys.argv[2], sys.argv[3]   # date like 20261025
con = duckdb.connect()
con.execute("PRAGMA threads=2")
q = f"""
CREATE TABLE svc AS
SELECT service_id FROM read_csv('{gtfs}/calendar.txt', header=true, all_varchar=true)
WHERE start_date <= '{date}' AND end_date >= '{date}' AND sunday='1';
"""
con.execute(q)
print("active services:", con.execute("select count(*) from svc").fetchone())
con.execute(f"""
CREATE TABLE trips AS
SELECT t.trip_id, t.route_id, t.trip_headsign, t.direction_id
FROM read_csv('{gtfs}/trips.txt', header=true, all_varchar=true) t
JOIN svc USING (service_id);
""")
print("active trips:", con.execute("select count(*) from trips").fetchone())
con.execute(f"""
COPY (
 SELECT st.trip_id,
        CAST(st.stop_id AS INTEGER) stop_id,
        CAST(st.stop_sequence AS INTEGER) seq,
        CAST(split_part(st.arrival_time,':',1) AS INTEGER)*3600 + CAST(split_part(st.arrival_time,':',2) AS INTEGER)*60 + CAST(split_part(st.arrival_time,':',3) AS INTEGER) arr,
        CAST(split_part(st.departure_time,':',1) AS INTEGER)*3600 + CAST(split_part(st.departure_time,':',2) AS INTEGER)*60 + CAST(split_part(st.departure_time,':',3) AS INTEGER) dep,
        CAST(st.pickup_type AS INTEGER) pickup, CAST(st.drop_off_type AS INTEGER) dropoff
 FROM read_csv('{gtfs}/stop_times.txt', header=true, all_varchar=true) st
 SEMI JOIN trips USING (trip_id)
) TO '{out}/st.parquet' (FORMAT parquet);
""")
con.execute(f"COPY trips TO '{out}/trips.parquet' (FORMAT parquet)")
print(con.execute(f"select count(*) from '{out}/st.parquet'").fetchone())
