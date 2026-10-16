import os
from flask import Flask, jsonify, render_template, request
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

def get_conn():
    """Read connection settings from environment variables; never hard-code passwords."""
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
        dbname=os.getenv("PGDATABASE", "amr_ecosim"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", ""),
    )

def query_db(sql, params=()):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/summary")
def summary():
    rows = query_db("""
        SELECT COUNT(*)::int AS row_count,
               ROUND(AVG(surv_frac)::numeric, 4)::float AS mean_surv_frac,
               MIN(time)::int AS min_time,
               MAX(time)::int AS max_time,
               COUNT(DISTINCT ab_conc)::int AS dose_levels,
               COUNT(DISTINCT nutrient_conc)::int AS nutrient_levels
        FROM amr_evol_dynamics
    """)
    return jsonify(rows[0])

@app.get("/api/options")
def options():
    return jsonify({
        "doses": [r["ab_conc"] for r in query_db("SELECT DISTINCT ab_conc FROM amr_evol_dynamics ORDER BY ab_conc")],
        "nutrients": [r["nutrient_conc"] for r in query_db("SELECT DISTINCT nutrient_conc FROM amr_evol_dynamics ORDER BY nutrient_conc")],
    })

@app.get("/api/compare")
def compare():
    dose = request.args.get("dose")
    nutrient = request.args.get("nutrient")
    if dose is None or nutrient is None:
        return jsonify({"error": "ต้องระบุ dose และ nutrient"}), 400
    try:
        dose = float(dose)
        nutrient = float(nutrient)
    except ValueError:
        return jsonify({"error": "dose และ nutrient ต้องเป็นตัวเลข"}), 400

    stats = query_db("""
        SELECT COUNT(*)::int AS sample_count,
               ROUND(AVG(surv_frac)::numeric, 4)::float AS mean_surv_frac,
               ROUND(MIN(surv_frac)::numeric, 4)::float AS min_surv_frac,
               ROUND(MAX(surv_frac)::numeric, 4)::float AS max_surv_frac
        FROM amr_evol_dynamics
        WHERE ab_conc = %s AND nutrient_conc = %s
    """, (dose, nutrient))[0]

    timeline = query_db("""
        SELECT time::int AS time,
               COUNT(*)::int AS sample_count,
               ROUND(AVG(surv_frac)::numeric, 4)::float AS mean_surv_frac
        FROM amr_evol_dynamics
        WHERE ab_conc = %s AND nutrient_conc = %s
        GROUP BY time
        ORDER BY time
    """, (dose, nutrient))

    sample_rows = query_db("""
        SELECT population, time, surv_frac
        FROM amr_evol_dynamics
        WHERE ab_conc = %s AND nutrient_conc = %s
        ORDER BY time, population
        LIMIT 30
    """, (dose, nutrient))
    return jsonify({"stats": stats, "timeline": timeline, "rows": sample_rows})

@app.get("/api/dose-summary")
def dose_summary():
    rows = query_db("""
        SELECT ab_conc,
               COUNT(*)::int AS sample_count,
               ROUND(AVG(surv_frac)::numeric, 4)::float AS mean_surv_frac
        FROM amr_evol_dynamics
        GROUP BY ab_conc
        ORDER BY ab_conc
    """)
    return jsonify(rows)

@app.get("/api/data")
def data():
    try:
        limit = min(max(int(request.args.get("limit", "50")), 1), 500)
        offset = max(int(request.args.get("offset", "0")), 0)
    except ValueError:
        return jsonify({"error": "limit และ offset ต้องเป็นจำนวนเต็ม"}), 400
    rows = query_db("""
        SELECT ab_conc, nutrient_conc, population, time, surv_frac
        FROM amr_evol_dynamics
        ORDER BY time, population
        LIMIT %s OFFSET %s
    """, (limit, offset))
    return jsonify({"rows": rows, "limit": limit, "offset": offset})

@app.get("/api/health")
def health():
    try:
        query_db("SELECT 1 AS ok")
        return jsonify({"database": "connected"})
    except Exception:
        app.logger.exception("Database health check failed")
        return jsonify({"database": "disconnected", "message": "ตรวจการตั้งค่า PostgreSQL และไฟล์ .env"}), 503

if __name__ == "__main__":
    app.run(debug=True)
