'use strict';
const $ = id => document.getElementById(id);
const COLORS = { QB: '#176b52', RB: '#d59538', WR: '#647ab5', TE: '#a17a95' };
const POSITIONS = Object.keys(COLORS);
const state = { data: [], sample: [], source: 'snapshot', position: 'ALL', team: 'ALL', season: '2024', search: '', sort: 'p_keep', selected: new Set(), view: 'overview' };
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, places=2) => Number(n).toFixed(places);
const pct = n => `${(n * 100).toFixed(1)}%`;
const initials = p => p.player.split(' ').map(s => s[0]).filter(Boolean).slice(0,2).join('');
const tier = p => p.p_keep >= .6 ? ['high','High score'] : p.p_keep >= .4 ? ['monitor','Monitor'] : ['review','Review'];
const badge = p => `<span class="tier ${tier(p)[0]}">${tier(p)[1]}</span>`;
function toast(message) { $('toast').textContent = message; $('toast').classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(()=>$('toast').classList.add('hidden'), 3500); }
function filtered() {
  const rows = state.data.filter(p => (state.position === 'ALL' || p.position === state.position) && (state.team === 'ALL' || p.posteam === state.team) && String(p.season) === state.season && p.player.toLowerCase().includes(state.search.toLowerCase()));
  return rows.sort((a,b)=> state.sort === 'player' ? a.player.localeCompare(b.player) : state.sort === 'cap_pct' ? a.cap_pct-b.cap_pct || b.p_keep-a.p_keep : b[state.sort]-a[state.sort] || a.player.localeCompare(b.player));
}
function setOptions() {
  const seasons = [...new Set(state.data.map(p=>p.season))].sort((a,b)=>b-a);
  if (!seasons.includes(+state.season)) state.season = String(seasons[0]);
  $('season').innerHTML = seasons.map(s=>`<option value="${s}">${s} season</option>`).join(''); $('season').value = state.season;
  updateTeams();
}
function updateTeams() {
  const teams = [...new Set(state.data.filter(p=>String(p.season)===state.season).map(p=>p.posteam))].sort();
  if(!teams.includes(state.team)) state.team = 'ALL';
  $('team').innerHTML = '<option value="ALL">All teams</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join(''); $('team').value = state.team;
}
function render() {
  const rows = filtered(), n = rows.length;
  $('navCount').textContent = state.data.length;
  $('countMetric').textContent = n.toLocaleString();
  $('countSub').textContent = n ? `Across ${new Set(rows.map(p=>p.position)).size} offensive position${new Set(rows.map(p=>p.position)).size===1?'':'s'}` : 'No matching players';
  $('warMetric').textContent = n ? fmt(rows.reduce((a,p)=>a+p.war,0)/n) : '—';
  $('capMetric').innerHTML = n ? `${fmt(rows.reduce((a,p)=>a+p.cap_pct,0)/n,1)}<span>%</span>` : '—';
  $('highMetric').textContent = rows.filter(p=>p.p_keep>=.6).length;
  $('tableCount').textContent = n;
  $('resultsLabel').textContent = `${n} of ${state.data.filter(p=>String(p.season)===state.season).length} loaded player-seasons · ${state.season}`;
  $('dataNote').innerHTML = `<span class="note-icon">i</span><span><strong>${esc(state.season)} ${state.source==='snapshot'?'notebook snapshot':'imported results'}</strong> · ${state.source==='snapshot'?'40 selected player-seasons, not the full league.':'Showing your uploaded model output.'} Scores refer to next-season surplus value.</span><a href="#methods">About the data →</a>`;
  document.querySelectorAll('[data-pos]').forEach(b=> { b.classList.toggle('selected', b.dataset.pos===state.position); b.setAttribute('aria-pressed',b.dataset.pos===state.position); });
  $('playerRows').innerHTML = n ? rows.map(p=>`<tr><td class="checkcell"><input type="checkbox" data-compare="${p._id}" aria-label="Compare ${esc(p.player)} ${p.season}" ${state.selected.has(p._id)?'checked':''}></td><td><button class="player-name" data-detail="${p._id}">${esc(p.player)}</button><div class="player-meta">${esc(p.posteam)} · ${p.season}${p.rookie_deal ? '<span class="rookie-tag">ROOKIE DEAL*</span>' : ''}</div></td><td><span class="pos-tag">${p.position}</span></td><td class="war-cell ${p.war<0?'negative':''}">${p.war>0?'+':''}${fmt(p.war)}</td><td>${fmt(p.cap_pct,1)}%</td><td>${fmt(p.rate_win,3)}</td><td><div class="score-cell"><span class="score-value">${pct(p.p_keep)}</span><div class="score-track"><div class="score-fill" style="width:${p.p_keep*100}%"></div></div></div></td><td>${badge(p)}</td><td><button data-detail="${p._id}" class="row-arrow" aria-label="View ${esc(p.player)} details">→</button></td></tr>`).join('') : '<tr><td colspan="9" class="empty">No players match these filters. Try another team, position, or search.</td></tr>';
  const top = [...rows].sort((a,b)=>b.p_keep-a.p_keep).slice(0,4);
  $('shortlist').innerHTML = top.length ? top.map((p,i)=>`<button class="short-row" data-detail="${p._id}"><span class="rank">0${i+1}</span><span class="player-initials">${esc(initials(p))}</span><span class="short-info"><strong>${esc(p.player)}</strong><small>${p.position} · ${esc(p.posteam)} · ${fmt(p.cap_pct,1)}% cap</small></span><span class="short-score">${pct(p.p_keep)}<small>VALUE SCORE</small></span></button>`).join('') : '<p class="empty">No matching players.</p>';
  renderChart(rows); renderCompareBar();
}
function renderChart(rows) {
  if(!rows.length) { $('scatter').innerHTML = '<p class="empty">No matching players to plot.</p>'; return; }
  const w=700,h=290,left=58,right=20,top=20,bottom=47,iw=w-left-right,ih=h-top-bottom;
  const xmax=Math.max(2,Math.ceil(Math.max(...rows.map(p=>p.cap_pct))/2)*2), ymin=Math.min(-.5,Math.floor(Math.min(...rows.map(p=>p.war))*2)/2), ymax=Math.max(1,Math.ceil(Math.max(...rows.map(p=>p.war))*2)/2);
  const x=v=>left+v/xmax*iw, y=v=>top+(ymax-v)/(ymax-ymin)*ih;
  let grid='';
  for(let i=0;i<=4;i++){const v=ymin+(ymax-ymin)*i/4;grid+=`<line x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}" stroke="#e9eee3" stroke-dasharray="3 4"/><text x="${left-12}" y="${y(v)+3}" text-anchor="end">${v.toFixed(1)}</text>`;}
  for(let i=0;i<=5;i++){const v=xmax*i/5;grid+=`<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${h-bottom}" stroke="#f1f4ec"/><text x="${x(v)}" y="${h-bottom+20}" text-anchor="middle">${v.toFixed(1)}%</text>`;}
  const maxScore=[...rows].sort((a,b)=>b.p_keep-a.p_keep)[0];
  $('scatter').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="Scatter plot of ${rows.length} filtered players: cap share on the horizontal axis and WAR on the vertical axis."><rect x="${left}" y="${top}" width="${iw}" height="${ih}" fill="#fcfdf9"/>${grid}<line x1="${left}" x2="${w-right}" y1="${y(0)}" y2="${y(0)}" stroke="#bcc9ae" stroke-dasharray="5 4"/><text class="chart-label" x="18" y="${top+ih/2}" transform="rotate(-90 18 ${top+ih/2})" text-anchor="middle">WINS ABOVE REPLACEMENT</text><text class="chart-label" x="${left+iw/2}" y="${h-7}" text-anchor="middle">SALARY CAP SHARE (%)</text>${rows.map(p=>`<circle class="dot" cx="${x(p.cap_pct)}" cy="${y(p.war)}" r="5.5" fill="${COLORS[p.position]}" tabindex="0" role="button" data-detail="${p._id}" aria-label="${esc(p.player)}: ${fmt(p.war)} WAR, ${fmt(p.cap_pct,1)}% cap share, value score ${pct(p.p_keep)}"><title>${esc(p.player)} · ${p.position} / ${esc(p.posteam)}\nWAR ${fmt(p.war)} · Cap ${fmt(p.cap_pct,1)}% · Score ${pct(p.p_keep)}</title></circle>`).join('')}<text x="${x(maxScore.cap_pct)+(x(maxScore.cap_pct)>w-145?-9:9)}" y="${y(maxScore.war)-12}" text-anchor="${x(maxScore.cap_pct)>w-145?'end':'start'}" class="chart-label">${esc(maxScore.player)}</text></svg>`;
}
function renderCompareBar() {
  const selected=state.data.filter(p=>state.selected.has(p._id));
  $('compareBar').classList.toggle('hidden',!selected.length); document.body.classList.toggle('has-comparison',!!selected.length);
  $('selectedCount').textContent=`${selected.length}/3 selected`;
  $('selectedNames').textContent=selected.map(p=>`${p.player} (${p.season})`).join(' · ');
}
function toggleCompare(id) {
  if(state.selected.has(id)) state.selected.delete(id);
  else if(state.selected.size<3) state.selected.add(id);
  else toast('Select up to 3 players. Clear one before adding another.');
  render();
}
function detail(id) {
  const p=state.data.find(p=>p._id===id); if(!p) return;
  const positionPeers = state.data.filter(x=>x.position===p.position && x.season===p.season).sort((a,b)=>b.p_keep-a.p_keep);
  const rank=positionPeers.findIndex(x=>x._id===p._id)+1;
  $('detailContent').innerHTML=`<div class="eyebrow">PLAYER PROFILE / ${p.season}</div><div class="dialog-identity"><span class="player-initials">${esc(initials(p))}</span><div><h2>${esc(p.player)}</h2><p>${p.position} · ${esc(p.posteam)} · ${p.rookie_deal?'Rookie-deal proxy':'Outside rookie-deal proxy'}</p></div></div><div class="detail-score"><div class="eyebrow">NEXT-SEASON VALUE SCORE</div><div class="score-big">${pct(p.p_keep)}</div><p>Model output for positive surplus next season</p><div class="score-track"><div class="score-fill" style="width:${p.p_keep*100}%"></div></div></div><div class="detail-grid"><div class="detail-stat"><span>WINS ABOVE REPLACEMENT</span><b>${fmt(p.war,3)}</b></div><div class="detail-stat"><span>CAP SHARE</span><b>${fmt(p.cap_pct,1)}%</b></div><div class="detail-stat"><span>3-YR SHRUNK RATE</span><b>${fmt(p.rate_win,3)}</b></div><div class="detail-stat"><span>SCORE RANK · LOADED ${p.position}s</span><b>${rank}<small> / ${positionPeers.length}</small></b></div></div><p class="detail-note">${badge(p)}<br>Rank is among loaded same-position, same-season players only. The score uses ${p.season} cap share and is not a calibrated probability. Future contract changes are not included.</p><button data-compare="${p._id}" class="button primary">${state.selected.has(p._id)?'Remove from':'Add to'} comparison</button>`;
  $('detailDialog').showModal();
}
function showCompare() {
  const rows=state.data.filter(p=>state.selected.has(p._id)); if(!rows.length) return;
  $('compareContent').innerHTML=`<div class="comparison-grid" style="--n:${rows.length}">${rows.map(p=>`<article class="compare-card"><span class="pos-tag">${p.position}</span><h3>${esc(p.player)}</h3><small>${esc(p.posteam)} · ${p.season}</small><div class="detail-stat"><span>VALUE SCORE</span><b style="color:var(--green)">${pct(p.p_keep)}</b></div><div class="detail-stat"><span>WAR</span><b>${fmt(p.war,3)}</b></div><div class="detail-stat"><span>CAP SHARE</span><b>${fmt(p.cap_pct,1)}%</b></div><div class="detail-stat"><span>3-YR SHRUNK RATE</span><b>${fmt(p.rate_win,3)}</b></div><div class="detail-stat"><span>ROOKIE-DEAL PROXY</span><b>${p.rookie_deal?'Yes':'No'}</b></div><div class="detail-stat">${badge(p)}</div></article>`).join('')}</div>`;
  $('compareDialog').showModal();
}
function setView() {
  const requested=location.hash.slice(1)||'overview'; state.view=['overview','players','model','methods'].includes(requested)?requested:'overview';
  const labels={overview:['Overview','Find value. Build better.','A clearer view of player production and the price paid for it.'],players:['Player explorer','Explore the value board.','Find the players behind the numbers. Filter, inspect, and compare.'],model:['Model report','Know the model.','Performance, uncertainty, and the boundaries of the prediction.'],methods:['Methodology','The logic behind the lab.','How your notebook turns play-by-play data into a player value signal.']};
  const l=labels[state.view]; $('breadcrumb').textContent=l[0]; $('pageTitle').textContent=l[1]; $('pageDescription').textContent=l[2]; document.body.dataset.view=state.view;
  $('dataViews').classList.toggle('hidden',!['overview','players'].includes(state.view)); $('modelView').classList.toggle('hidden',state.view!=='model'); $('methodsView').classList.toggle('hidden',state.view!=='methods');
  document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===state.view); if(a.dataset.view===state.view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  window.scrollTo({top:0});
}
function resetFilters(){ state.position='ALL';state.team='ALL';state.search='';state.sort='p_keep';$('search').value='';$('sort').value='p_keep';updateTeams();render(); }
function parseCSV(text) {
  const records=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"' && text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"'){if(cell.trim())throw new Error('Invalid CSV quoting. Please use the notebook export cell.');quoted=true;}
    else if(c===','){row.push(cell.trim());cell='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))records.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('A quoted CSV field is unfinished. Please re-export the file.');
  row.push(cell.trim());if(row.some(Boolean))records.push(row);
  if(records.length<2)throw new Error('The CSV must contain a header and at least one player row.');
  const headers=records.shift();
  if(new Set(headers).size!==headers.length)throw new Error('The CSV contains duplicate column names.');
  const fields=['player','position','posteam','season','cap_pct','rookie_deal','war','rate_win','p_keep'];
  const missing=fields.filter(f=>!headers.includes(f));if(missing.length)throw new Error(`Missing columns: ${missing.join(', ')}. Use the notebook export cell.`);
  const keys=new Set();
  return records.map((r,i)=>{
    if(r.length!==headers.length)throw new Error(`Row ${i+2}: column count does not match the header.`);
    const p=Object.fromEntries(headers.map((h,j)=>[h,r[j]]));
    for(const f of fields.slice(3)){if(p[f]===''||!Number.isFinite(Number(p[f])))throw new Error(`Row ${i+2}: ${f} must be a finite number.`);p[f]=Number(p[f]);}
    p.position=p.position.toUpperCase();
    if(!p.player||!p.posteam||p.player.length>100||p.posteam.length>30)throw new Error(`Row ${i+2}: provide a player name and team.`);
    if(!POSITIONS.includes(p.position))throw new Error(`Row ${i+2}: position must be QB, RB, WR, or TE.`);
    if(p.p_keep<0||p.p_keep>1)throw new Error(`Row ${i+2}: p_keep must be between 0 and 1.`);
    if(p.cap_pct<0||p.cap_pct>100)throw new Error(`Row ${i+2}: cap_pct must use percentage points between 0 and 100.`);
    if(![0,1].includes(p.rookie_deal))throw new Error(`Row ${i+2}: rookie_deal must be 0 or 1.`);
    if(!Number.isInteger(p.season)||p.season<1900||p.season>2100)throw new Error(`Row ${i+2}: season must be a four-digit year.`);
    const key=`${p.player.toLowerCase()}|${p.position}|${p.season}`;
    if(keys.has(key))throw new Error(`Row ${i+2}: duplicate player-position-season. Export one row per player-season.`); keys.add(key);
    return Object.fromEntries(fields.map(f=>[f,p[f]]));
  });
}
function loadRows(rows, source) {state.data=rows.map((p,i)=>({...p,_id:String(i)}));state.source=source;state.season=String(Math.max(...rows.map(p=>p.season)));state.selected.clear();setOptions();resetFilters();}
async function importFile(file) {
  if(!file)return;
  try{if(file.size>5*1024*1024)throw new Error('Choose a CSV smaller than 5 MB.');const rows=parseCSV(await file.text());if(rows.length>20000)throw new Error('This dashboard supports up to 20,000 player-seasons.');loadRows(rows,'import');$('importDialog').close();toast(`Imported ${rows.length} player-seasons.`);}
  catch(e){$('importError').textContent=e.message;}
  finally{$('csvInput').value='';}
}
function exportView(){const rows=filtered();if(!rows.length){toast('No matching players to export.');return;}const fields=['player','position','posteam','season','cap_pct','rookie_deal','war','rate_win','p_keep'];const quote=v=>`"${String(v).replace(/"/g,'""')}"`;const csv=[fields.join(','),...rows.map(p=>fields.map(f=>quote(p[f])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`roster_view_${state.season}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Exported ${rows.length} player-seasons.`);}
document.addEventListener('click',e=>{
  const detailBtn=e.target.closest('[data-detail]'); if(detailBtn){detail(detailBtn.dataset.detail);return;}
  const compare=e.target.closest('[data-compare]'); if(compare){toggleCompare(compare.dataset.compare);if(compare.tagName==='BUTTON'){$('detailDialog').close();}return;}
  const pos=e.target.closest('[data-pos]');if(pos){state.position=pos.dataset.pos;render();}
  const close=e.target.closest('.dialog-close');if(close)close.closest('dialog').close();
});
document.addEventListener('keydown',e=>{const el=e.target.closest?.('circle[data-detail]');if(el&&['Enter',' '].includes(e.key)){e.preventDefault();detail(el.dataset.detail);}});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('season').addEventListener('change',e=>{state.season=e.target.value;updateTeams();render();});
$('team').addEventListener('change',e=>{state.team=e.target.value;render();});
$('search').addEventListener('input',e=>{state.search=e.target.value;render();});
$('sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
$('resetBtn').addEventListener('click',resetFilters);
$('importBtn').addEventListener('click',()=>{$('importError').textContent='';$('importDialog').showModal();});
$('exportBtn').addEventListener('click',exportView);
$('csvInput').addEventListener('change',e=>importFile(e.target.files[0]));
$('sampleBtn').addEventListener('click',()=>{loadRows(state.sample,'snapshot');$('importDialog').close();toast('Restored the 40-player notebook snapshot.');});
$('clearCompare').addEventListener('click',()=>{state.selected.clear();render();});
$('compareBtn').addEventListener('click',showCompare);
window.addEventListener('hashchange',setView);
fetch('data.json').then(r=>{if(!r.ok)throw new Error('Data could not be loaded.');return r.json();}).then(data=>{state.sample=data;loadRows(data,'snapshot');setView();}).catch(e=>{$('dataNote').textContent=`${e.message} Try reloading the page.`;});
