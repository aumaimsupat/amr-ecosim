const $=id=>document.getElementById(id);
const fmt=(v,n=3)=>v===null||v===undefined?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:n});
async function api(url){const r=await fetch(url);const j=await r.json();if(!r.ok)throw new Error(j.message||j.error||'API request failed');return j}
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
async function loadSummary(){const s=await api('/api/summary');$('rowCount').textContent=fmt(s.row_count,0);$('overallMean').textContent=fmt(s.mean_surv_frac,4);$('doseLevels').textContent=fmt(s.dose_levels,0);$('timeRange').textContent=`${s.min_time}–${s.max_time}`;barChart('doseChart',await api('/api/dose-summary'))}
async function loadCompare(){clearError();const d=$('dose').value,n=$('nutrient').value;if(d===''||n==='')return;const data=await api(`/api/compare?dose=${encodeURIComponent(d)}&nutrient=${encodeURIComponent(n)}`);const s=data.stats;$('filteredCount').textContent=fmt(s.sample_count,0);$('filteredMean').textContent=fmt(s.mean_surv_frac,4);$('filteredMin').textContent=fmt(s.min_surv_frac,4);$('filteredMax').textContent=fmt(s.max_surv_frac,4);lineChart('timelineChart',data.timeline);$('filteredRows').innerHTML=data.rows.map(r=>`<tr><td>${r.population}</td><td>${r.time}</td><td>${fmt(r.surv_frac,5)}</td></tr>`).join('')}
async function loadTable(){const d=await api('/api/data?limit=50');$('allRows').innerHTML=d.rows.map(r=>`<tr><td>${r.ab_conc}</td><td>${r.nutrient_conc}</td><td>${r.population}</td><td>${r.time}</td><td>${r.surv_frac}</td></tr>`).join('')}
async function init(){try{const h=await api('/api/health');$('dbStatus').textContent='PostgreSQL เชื่อมต่อแล้ว';const opts=await api('/api/options');fillSelect('dose',opts.doses);fillSelect('nutrient',opts.nutrients);await loadSummary();await loadCompare();await loadTable()}catch(e){$('dbStatus').textContent='ยังเชื่อมฐานข้อมูลไม่ได้';$('dbStatus').classList.add('bad');showError('เชื่อมต่อฐานข้อมูลไม่สำเร็จ: '+e.message+' — ตรวจว่า PostgreSQL ทำงานอยู่, สร้างตารางแล้ว, ตั้งค่า .env และนำเข้า CSV แล้ว')}
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===b.dataset.page))}));
$('dose').addEventListener('change',()=>loadCompare().catch(e=>showError(e.message)));$('nutrient').addEventListener('change',()=>loadCompare().catch(e=>showError(e.message)));
init();
