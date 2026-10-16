import os
import json
import math
from flask import Flask, jsonify, render_template, request
import psycopg2
from psycopg2.extras import RealDictCursor, Json

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

def run_model(params):
    """
    Educational deterministic toy model, not a clinically calibrated model.
    Values for antibiotic and nutrient are normalized to 0..1.
    State variables are relative populations, initially totaling 1.
    Mechanisms: nutrient-dependent growth, antibiotic selection, resistance fitness cost,
    and a small susceptible-to-resistant mutation flow.
    """
    antibiotic = float(params["antibiotic"])
    nutrient = float(params["nutrient"])
    steps = int(params["steps"])
    initial_resistant = float(params["initial_resistant"])

    susceptible = 1.0 - initial_resistant
    resistant = initial_resistant
    carrying_capacity = 1.0
    base_growth = 0.42
    fitness_cost = 0.12
    mutation_rate = 0.001
    rows = []

    def add_row(t, s, r):
        total = s + r
        rows.append({
            "time": t,
            "susceptible": round(max(0.0, s), 8),
            "resistant": round(max(0.0, r), 8),
            "total_population": round(max(0.0, total), 8),
            "resistant_fraction": round((r / total) if total > 1e-12 else 0.0, 8)
        })

    add_row(0, susceptible, resistant)
    for t in range(1, steps + 1):
        total = susceptible + resistant
        crowding = max(0.0, 1.0 - total / carrying_capacity)

        # Nutrients affect the growth term for both populations.
        growth_s = base_growth * nutrient * crowding * susceptible
        growth_r = base_growth * nutrient * (1.0 - fitness_cost) * crowding * resistant

        # Antibiotic exposure suppresses susceptible bacteria more strongly.
        drug_loss_s = (0.72 * antibiotic) * susceptible
        drug_loss_r = (0.16 * antibiotic) * resistant

        next_s = max(0.0, susceptible + growth_s - drug_loss_s)
        next_r = max(0.0, resistant + growth_r - drug_loss_r)

        # A small fraction of susceptible population transitions to resistant state.
        mutation_flow = min(next_s, mutation_rate * next_s)
        next_s -= mutation_flow
        next_r += mutation_flow

        susceptible, resistant = next_s, next_r
        add_row(t, susceptible, resistant)

    return {
        "parameters": params,
        "series": rows,
        "summary": {
            "initial_resistant_fraction": rows[0]["resistant_fraction"],
            "final_resistant_fraction": rows[-1]["resistant_fraction"],
            "final_susceptible": rows[-1]["susceptible"],
            "final_resistant": rows[-1]["resistant"],
            "final_total_population": rows[-1]["total_population"],
            "steps": steps
        },
        "model_notes": [
            "สารอาหารมีผลต่อการเจริญเติบโตของทั้งสองกลุ่ม",
            "ยาปฏิชีวนะกดประชากรไวต่อยามากกว่าประชากรดื้อยาในโมเดลนี้",
            "กำหนดต้นทุนการดื้อยาและอัตราการเปลี่ยนสถานะเป็นค่าคงที่เพื่อการเรียนรู้"
        ]
    }

@app.post("/api/simulate")
def simulate():
    body = request.get_json(silent=True) or {}
    try:
        antibiotic = float(body.get("antibiotic", 0.5))
        nutrient = float(body.get("nutrient", 0.7))
        steps = int(body.get("steps", 50))
        initial_resistant = float(body.get("initial_resistant", 0.02))
        if not (0 <= antibiotic <= 1 and 0 <= nutrient <= 1):
            return jsonify({"error": "ค่าความเข้มข้นต้องอยู่ระหว่าง 0 ถึง 1"}), 400
        if not (10 <= steps <= 100):
            return jsonify({"error": "จำนวน steps ต้องอยู่ระหว่าง 10 ถึง 100"}), 400
        if not (0.001 <= initial_resistant <= 0.5):
            return jsonify({"error": "สัดส่วนเริ่มต้นของเชื้อดื้อยาต้องอยู่ระหว่าง 0.001 ถึง 0.5"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "พารามิเตอร์ต้องเป็นตัวเลขที่ถูกต้อง"}), 400

    params = {
        "antibiotic": antibiotic,
        "nutrient": nutrient,
        "steps": steps,
        "initial_resistant": initial_resistant
    }
    result = run_model(params)

    # Save experiment history if PostgreSQL is available. The simulation result is still
    # returned if history persistence fails, and the failure is logged for debugging.
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS amr_simulation_runs (
                        id BIGSERIAL PRIMARY KEY,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        antibiotic DOUBLE PRECISION NOT NULL,
                        nutrient DOUBLE PRECISION NOT NULL,
                        steps INTEGER NOT NULL,
                        initial_resistant DOUBLE PRECISION NOT NULL,
                        final_resistant_fraction DOUBLE PRECISION NOT NULL,
                        result_json JSONB NOT NULL
                    )
                """)
                cur.execute("""
                    INSERT INTO amr_simulation_runs
                    (antibiotic, nutrient, steps, initial_resistant,
                     final_resistant_fraction, result_json)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    antibiotic, nutrient, steps, initial_resistant,
                    result["summary"]["final_resistant_fraction"], Json(result)
                ))
        result["saved_to_database"] = True
    except Exception:
        app.logger.exception("Could not save simulation history to PostgreSQL")
        result["saved_to_database"] = False

    return jsonify(result)

@app.get("/api/simulation-runs")
def simulation_runs():
    try:
        rows = query_db("""
            SELECT id, created_at, antibiotic, nutrient, steps,
                   initial_resistant, final_resistant_fraction
            FROM amr_simulation_runs
            ORDER BY created_at DESC
            LIMIT 10
        """)
        for row in rows:
            if row.get("created_at"):
                row["created_at"] = row["created_at"].isoformat()
        return jsonify({"rows": rows})
    except Exception:
        return jsonify({"rows": [], "message": "ยังไม่มีประวัติการจำลอง หรือยังไม่ได้สร้างตารางประวัติ"}), 200

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
