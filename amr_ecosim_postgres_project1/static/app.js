const $=id=>document.getElementById(id);
const fmt=(v,n=3)=>v===null||v===undefined?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:n});
async function api(url,options={}){const r=await fetch(url,options);const j=await r.json();if(!r.ok)throw new Error(j.message||j.error||'API request failed');return j}
function showError(msg){$('error').hidden=false;$('error').textContent=msg}
function clearError(){$('error').hidden=true;$('error').textContent=''}
function fillSelect(id,values){$(id).innerHTML=values.map(v=>`<option value="${v}">${v}</option>`).join('')}
function lineChart(id,points){
 const el=$(id);if(!points.length){el.innerHTML='<p class="muted">ไม่มีข้อมูลในเงื่อนไขนี้</p>';return}
 const W=580,H=255,L=52,R=18,T=18,B=35,iw=W-L-R,ih=H-T-B;
 let min=Math.min(0,...points.map(p=>Number(p.mean_surv_frac))),max=Math.max(...points.map(p=>Number(p.mean_surv_frac)));if(max===min)max=min+1;max+=(max-min)*.08;
 const x=i=>L+(points.length===1?iw/2:i*iw/(points.length-1)),y=v=>T+ih-(v-min)/(max-min)*ih;
 let grid='';for(let i=0;i<5;i++){let v=min+(max-min)*i/4,yy=y(v);grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e7ebf3"/><text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="10" fill="#718096">${fmt(v,2)}</text>`}
 let path=points.map((p,i)=>(i?'L':'M')+x(i)+','+y(Number(p.mean_surv_frac))).join(' ');
 let dots=points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(Number(p.mean_surv_frac))}" r="4" fill="#315ee8"><title>time ${p.time}: ${fmt(p.mean_surv_frac,4)}</title></circle><text x="${x(i)}" y="${H-13}" text-anchor="middle" font-size="10" fill="#718096">${p.time}</text>`).join('');
 el.innerHTML=`<svg viewBox="0 0 ${W} ${H}">${grid}<path d="${path}" fill="none" stroke="#315ee8" stroke-width="3" stroke-linecap="round"/>${dots}<text x="${W/2}" y="${H-1}" text-anchor="middle" font-size="10" fill="#718096">time</text></svg>`;
}
function barChart(id,points){
 const el=$(id);if(!points.length){el.textContent='ไม่มีข้อมูล';return}
 const W=560,H=245,L=45,R=15,T=18,B=40,iw=W-L-R,ih=H-T-B;let max=Math.max(.01,...points.map(p=>Number(p.mean_surv_frac)));max*=1.15;
 let grid='';for(let i=0;i<5;i++){let v=max*i/4,yy=T+ih-v/max*ih;grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e7ebf3"/><text x="${L-7}" y="${yy+4}" text-anchor="end" font-size="10" fill="#718096">${fmt(v,2)}</text>`}
 let gap=iw/points.length,bw=Math.min(60,gap*.55),bars=points.map((p,i)=>{let h=Number(p.mean_surv_frac)/max*ih,x=L+i*gap+(gap-bw)/2,yy=T+ih-h;return `<rect x="${x}" y="${yy}" width="${bw}" height="${Math.max(0,h)}" rx="4" fill="#315ee8"/><text x="${x+bw/2}" y="${yy-5}" text-anchor="middle" font-size="10" fill="#526078">${fmt(p.mean_surv_frac,2)}</text><text x="${x+bw/2}" y="${H-16}" text-anchor="middle" font-size="11" fill="#718096">${p.ab_conc}</text>`}).join('');
 el.innerHTML=`<svg viewBox="0 0 ${W} ${H}">${grid}${bars}</svg>`;
}
function simulationChart(points){
 const el=$('simulationChart');if(!points||!points.length){el.innerHTML='<div class="empty-state">ไม่มีผลการจำลอง</div>';return}
 const W=700,H=300,L=58,R=20,T=22,B=42,iw=W-L-R,ih=H-T-B;
 const max=Math.max(1,...points.map(p=>p.total_population))*1.08;
 const x=i=>L+(points.length===1?iw/2:i*iw/(points.length-1));
 const y=v=>T+ih-(v/max)*ih;
 let grid='';for(let i=0;i<5;i++){const v=max*i/4,yy=y(v);grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e7ebf3"/><text x="${L-9}" y="${yy+4}" text-anchor="end" font-size="11" fill="#718096">${fmt(v,2)}</text>`}
 const pathS=points.map((p,i)=>(i?'L':'M')+x(i)+','+y(p.susceptible)).join(' ');
 const pathR=points.map((p,i)=>(i?'L':'M')+x(i)+','+y(p.resistant)).join(' ');
 const labels=points.map((p,i)=>i===0||i===points.length-1||i%Math.ceil(points.length/6)===0?`<text x="${x(i)}" y="${H-16}" text-anchor="middle" font-size="10" fill="#718096">${p.time}</text>`:'').join('');
 el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Population simulation chart">${grid}<path d="${pathS}" fill="none" stroke="#315ee8" stroke-width="3" stroke-linecap="round"/><path d="${pathR}" fill="none" stroke="#e06b48" stroke-width="3" stroke-linecap="round"/>${points.map((p,i)=>i===points.length-1?`<circle cx="${x(i)}" cy="${y(p.susceptible)}" r="4" fill="#315ee8"/><circle cx="${x(i)}" cy="${y(p.resistant)}" r="4" fill="#e06b48"/>`: '').join('')}${labels}<text x="${W/2}" y="${H-1}" text-anchor="middle" font-size="11" fill="#718096">Time steps</text></svg>`;
}
async function loadSummary(){const s=await api('/api/summary');$('rowCount').textContent=fmt(s.row_count,0);$('overallMean').textContent=fmt(s.mean_surv_frac,4);$('doseLevels').textContent=fmt(s.dose_levels,0);$('timeRange').textContent=`${s.min_time}–${s.max_time}`;barChart('doseChart',await api('/api/dose-summary'))}
async function loadCompare(){clearError();const d=$('dose').value,n=$('nutrient').value;if(d===''||n==='')return;const data=await api(`/api/compare?dose=${encodeURIComponent(d)}&nutrient=${encodeURIComponent(n)}`);const s=data.stats;$('filteredCount').textContent=fmt(s.sample_count,0);$('filteredMean').textContent=fmt(s.mean_surv_frac,4);$('filteredMin').textContent=fmt(s.min_surv_frac,4);$('filteredMax').textContent=fmt(s.max_surv_frac,4);lineChart('timelineChart',data.timeline);$('filteredRows').innerHTML=data.rows.map(r=>`<tr><td>${r.population}</td><td>${r.time}</td><td>${fmt(r.surv_frac,5)}</td></tr>`).join('')}
async function loadTable(){const d=await api('/api/data?limit=50');$('allRows').innerHTML=d.rows.map(r=>`<tr><td>${r.ab_conc}</td><td>${r.nutrient_conc}</td><td>${r.population}</td><td>${r.time}</td><td>${r.surv_frac}</td></tr>`).join('')}
function updateSimulationLabels(){
 $('simAntibioticValue').textContent=Number($('simAntibiotic').value).toFixed(2);
 $('simNutrientValue').textContent=Number($('simNutrient').value).toFixed(2);
 $('simInitialResistantValue').textContent=(Number($('simInitialResistant').value)*100).toFixed(1)+'%';
 $('simStepsValue').textContent=$('simSteps').value+' steps';
}
async function runSimulation(){
 clearError();const btn=$('runSimulation');btn.disabled=true;btn.textContent='กำลังคำนวณ…';
 try{
  const payload={antibiotic:Number($('simAntibiotic').value),nutrient:Number($('simNutrient').value),initial_resistant:Number($('simInitialResistant').value),steps:Number($('simSteps').value)};
  const result=await api('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  simulationChart(result.series);const s=result.summary;
  $('finalResistant').textContent=(s.final_resistant_fraction*100).toFixed(2)+'%';
  $('finalSusceptible').textContent=fmt(s.final_susceptible,4);
  $('finalResistantPop').textContent=fmt(s.final_resistant,4);
  $('simulationMessage').textContent=`จำลอง ${s.steps} steps สำเร็จ • ปรับค่าแล้วกด Run Simulation อีกครั้งเพื่อเปรียบเทียบ`;
  $('saveStatus').textContent=result.saved_to_database?'บันทึกใน PostgreSQL แล้ว':'คำนวณแล้ว • บันทึกประวัติไม่ได้';
  $('saveStatus').classList.toggle('saved',result.saved_to_database);
  await loadSimulationRuns();
 }catch(e){showError('คำนวณ Simulation ไม่สำเร็จ: '+e.message)}
 finally{btn.disabled=false;btn.textContent='▶ Run Simulation'}
}
async function loadSimulationRuns(){
 try{const data=await api('/api/simulation-runs');const rows=data.rows||[];$('simulationRuns').innerHTML=rows.length?rows.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString()}</td><td>${fmt(r.antibiotic,2)}</td><td>${fmt(r.nutrient,2)}</td><td>${(Number(r.final_resistant_fraction)*100).toFixed(2)}%</td></tr>`).join(''):'<tr><td colspan="4">ยังไม่มีข้อมูล</td></tr>'}
 catch(e){console.warn('Cannot load simulation history',e)}
}
function resetSimulation(){
 $('simAntibiotic').value='0.50';$('simNutrient').value='0.70';$('simInitialResistant').value='0.02';$('simSteps').value='50';updateSimulationLabels();
 $('simulationChart').innerHTML='<div class="empty-state">ปรับค่าแล้วกด Run Simulation เพื่อสร้างกราฟใหม่</div>';
 $('finalResistant').textContent='—';$('finalSusceptible').textContent='—';$('finalResistantPop').textContent='—';$('saveStatus').textContent='ยังไม่ได้จำลอง';$('saveStatus').classList.remove('saved');$('simulationMessage').textContent='คืนค่าพารามิเตอร์เริ่มต้นแล้ว';
}
async function init(){
 try{const h=await api('/api/health');$('dbStatus').textContent='PostgreSQL เชื่อมต่อแล้ว';const opts=await api('/api/options');fillSelect('dose',opts.doses);fillSelect('nutrient',opts.nutrients);await loadSummary();await loadCompare();await loadTable();await loadSimulationRuns()}
 catch(e){$('dbStatus').textContent='ยังเชื่อมฐานข้อมูลไม่ได้';$('dbStatus').classList.add('bad');showError('เชื่อมต่อฐานข้อมูลไม่สำเร็จ: '+e.message+' — ตรวจว่า PostgreSQL ทำงานอยู่, สร้างตารางแล้ว, ตั้งค่า .env และนำเข้า CSV แล้ว')}
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===b.dataset.page))}));
$('dose').addEventListener('change',()=>loadCompare().catch(e=>showError(e.message)));$('nutrient').addEventListener('change',()=>loadCompare().catch(e=>showError(e.message)));
['simAntibiotic','simNutrient','simInitialResistant','simSteps'].forEach(id=>$(id).addEventListener('input',updateSimulationLabels));
$('runSimulation').addEventListener('click',runSimulation);$('resetSimulation').addEventListener('click',resetSimulation);
updateSimulationLabels();init();
