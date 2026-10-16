"""Import evol_dynamics.csv into PostgreSQL.
Usage: python import_csv.py path/to/evol_dynamics.csv
"""
import csv
import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()
REQUIRED = ["AB_conc", "nutrient_conc", "population", "time", "surv_frac"]

def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python import_csv.py evol_dynamics.csv")
    path = sys.argv[1]
    conn = psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
        dbname=os.getenv("PGDATABASE", "amr_ecosim"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", ""),
    )
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE amr_evol_dynamics")
                with open(path, "r", encoding="utf-8-sig", newline="") as f:
                    reader = csv.DictReader(f)
                    missing = [c for c in REQUIRED if c not in (reader.fieldnames or [])]
                    if missing:
                        raise ValueError(f"CSV missing required columns: {missing}")
                    inserted = 0
                    for row in reader:
                        cur.execute("""
                            INSERT INTO amr_evol_dynamics
                            (ab_conc, nutrient_conc, population, time, surv_frac)
                            VALUES (%s, %s, %s, %s, %s)
                        """, (
                            row["AB_conc"], row["nutrient_conc"],
                            row["population"], row["time"], row["surv_frac"]
                        ))
                        inserted += 1
        print(f"Import complete: {inserted} rows inserted.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
