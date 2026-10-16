-- Run this in the amr_ecosim database before importing the CSV.
CREATE TABLE IF NOT EXISTS amr_evol_dynamics (
    ab_conc       NUMERIC NOT NULL,
    nutrient_conc NUMERIC NOT NULL,
    population    INTEGER NOT NULL,
    time          INTEGER NOT NULL,
    surv_frac     NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_amr_dynamics_conditions_time
ON amr_evol_dynamics (ab_conc, nutrient_conc, time);
