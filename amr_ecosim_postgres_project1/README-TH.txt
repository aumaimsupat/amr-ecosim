AMR-EcoSim Simulation Lab update

Replace these files in your existing Flask project:
- app.py -> project root/app.py
- templates/index.html -> project root/templates/index.html
- static/app.js -> project root/static/app.js
- static/style.css -> project root/static/style.css

Keep your existing .env and CSV/import scripts. Do not overwrite them.
The first successful POST /api/simulate creates table amr_simulation_runs if the database user has CREATE TABLE permission.
The simulation is an educational toy model with normalized 0..1 controls, not a clinically calibrated prediction.
Restart Flask after replacing files.
