'use strict';
const recState = { mode: 'score', position: 'QB', baselineId: '', budgetUnit: 'cap_pct', budgetLimit: '5', limit: 5, higherOnly: true, search: '', result: null };
function capMoney(p) { return Number.isFinite(p.cap_number) ? `$${fmt(p.cap_number,2)}M` : 'Not exported'; }
function syncRecommender() {
  const latest = Math.max(...state.data.map(p=>p.season));
  const players = state.data.filter(p=>p.season===latest).sort((a,b)=>a.player.localeCompare(b.player));
  if (!players.some(p=>p._id===recState.baselineId)) recState.baselineId = (players.find(p=>p.player==='Cooper Rush') || players[0])?._id || '';
  const selected=players.find(p=>p._id===recState.baselineId);
  const matches=players.filter(p=>p.player.toLowerCase().includes(recState.search.toLowerCase()) || p.posteam.toLowerCase().includes(recState.search.toLowerCase()));
  const options=[...matches];if(selected&&!options.includes(selected))options.unshift(selected);
  $('baselinePlayer').innerHTML=options.map(p=>`<option value="${p._id}">${esc(p.player)} · ${p.position} · ${esc(p.posteam)}</option>`).join('');
  $('baselinePlayer').value=recState.baselineId;
  $('baselineSearchCount').textContent=`${matches.length} matching players in ${latest}`;
  $('recSeasonLabel').textContent=`${latest} feature season`;
  if (state.view==='recommend') renderRecommender();
}
function renderRecommender() {
  document.querySelectorAll('[data-rec-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.recMode===recState.mode);b.setAttribute('aria-pressed',b.dataset.recMode===recState.mode);});
  const isPosition=recState.mode==='position';
  $('recPositionField').classList.toggle('hidden',!isPosition);
  $('baselineFields').classList.toggle('hidden',isPosition);
  $('higherOnlyField').classList.toggle('hidden',recState.mode!=='score');
  $('budgetField').classList.toggle('hidden',recState.budgetUnit==='none');
  $('budgetValue').disabled=recState.budgetUnit==='none';
  $('budgetLabel').textContent=recState.budgetUnit==='cap_number'?'Maximum cap hit ($M)':'Maximum cap share (%)';
  $('budgetValue').max=recState.budgetUnit==='cap_pct'?'100':'';
  const captions={position:'Find the highest value scores at one position.',score:'Compare same-position options with a selected player.',war:'Find the most production above replacement within your budget.'};
  $('recModeCaption').textContent=captions[recState.mode];
  let result;
  try{result=RosterEngine.recommend(state.data,recState);$('recFormError').textContent='';}
  catch(e){recState.result=null;$('recFormError').textContent=e.message;$('recCoverage').textContent='';$('recResults').innerHTML='<div class="rec-empty">Adjust the selections to see recommendations.</div>';$('baselineCard').innerHTML='';$('recExport').disabled=true;if(state.view==='recommend')$('exportBtn').disabled=true;return;}
  recState.result=result;$('recExport').disabled=!result.rows.length;if(state.view==='recommend')$('exportBtn').disabled=!result.rows.length;
  $('recCoverage').innerHTML=`<strong>${result.poolSize} same-position ${result.baseline?'alternatives':'players'} loaded</strong><span>${result.withinBudget} within the selected budget · ${result.eligibleCount} eligible</span>${result.missingCost?`<p>${result.missingCost} players excluded because their dollar cap hit was not saved in the notebook output. Import the full export to include them, or use cap share.</p>`:''}${state.source==='snapshot'?'<p>This is a selected notebook excerpt, not a league-wide candidate pool.</p>':''}`;
  const p=result.baseline;
  $('baselineCard').innerHTML=p?`<div class="baseline-label">YOUR COMPARISON PLAYER</div><div class="baseline-identity"><span class="player-initials">${esc(initials(p))}</span><div><h2><button class="baseline-name" data-detail="${p._id}">${esc(p.player)}</button></h2><p>${p.position} · ${esc(p.posteam)} · ${p.season}</p></div></div><div class="baseline-stats"><div><span>Value score</span><b>${pct(p.p_keep)}</b></div><div><span>WAR</span><b>${fmt(p.war,3)}</b></div><div><span>Cap share</span><b>${fmt(p.cap_pct,1)}%</b></div><div><span>Cap hit</span><b>${capMoney(p)}</b></div></div><p class="rec-subtle">The budget applies to alternatives. Your comparison player can be above the budget.</p>`:`<div class="baseline-label">POSITION SHORTLIST</div><h2 class="position-big">${result.position}</h2><p>Qualified players from the latest loaded season, ranked by their next-season value score.</p><p class="rec-subtle">A budget filters recorded costs. It does not change the model’s score or simulate a new contract.</p>`;
  if(!result.rows.length){$('recResults').innerHTML=`<div class="rec-empty"><span class="empty-symbol">∅</span><h2>${isPosition?'No matching players':'No matching alternatives'}</h2><p>${result.missingCost===result.poolSize&&result.poolSize?'Dollar cap hits are missing for this position. Import the full export or switch to cap share.':recState.mode==='score'&&recState.higherOnly?'No loaded same-position player within this budget has a higher value score. Increase the budget or turn off “Higher scores only.”':'No loaded players meet this budget. Increase it or choose No budget limit.'}</p><button class="button secondary" id="clearRecBudget">Remove budget limit</button></div>`;return;}
  const metricLabel=result.metric==='war'?'WAR':'Value score';
  const items=p?[{...p,isBaseline:true},...result.rows]:result.rows;
  const values=items.map(p=>p[result.metric]);
  const min=result.metric==='war'?Math.min(0,...values):0;
  const max=result.metric==='war'?Math.max(.1,...values):1;
  const span=max-min||1;
  const zero=(0-min)/span*100;
  $('recResults').innerHTML=`<div class="rec-result-heading"><div><h2>${isPosition?`Top ${result.rows.length} ${result.position} value scores`:`${result.rows.length} ${result.position} alternatives`}</h2><p>Sorted by ${metricLabel.toLowerCase()} · ${result.season} results</p></div><span class="chip">${result.metric==='war'?'PRODUCTION':'NEXT-SEASON VALUE'}</span></div><div class="recommendation-bars" aria-label="${metricLabel} comparison chart">${items.map(row=>{const value=row[result.metric],start=(Math.min(0,value)-min)/span*100,width=Math.abs(value)/span*100;const delta=p?value-p[result.metric]:null;return `<div class="rec-chart-row ${row.isBaseline?'is-baseline':''}"><div class="rec-chart-name"><button data-detail="${row._id}">${esc(row.player)}</button><small>${esc(row.posteam)} · ${Number.isFinite(row.cap_number)?capMoney(row):`${fmt(row.cap_pct,1)}% cap`}${row.isBaseline?' · BASELINE':''}</small></div><div class="rec-bar-rail"><i class="zero-line" style="left:${zero}%"></i><span class="rec-bar ${value<0?'negative':''}" style="left:${start}%;width:${width}%"></span></div><div class="rec-chart-value"><b>${result.metric==='war'?fmt(value,3):pct(value)}</b>${!row.isBaseline&&p?`<small class="${delta>0?'positive':delta<0?'negative-text':''}">${delta>0?'+':''}${fmt(delta*(result.metric==='war'?1:100),result.metric==='war'?3:1)} ${result.metric==='war'?'WAR':'pp'}</small>`:''}</div></div>`;}).join('')}</div><div class="rec-chart-key">${p?'<span><i class="key-baseline"></i>Comparison player</span>':''}<span><i class="key-alternative"></i>Alternatives</span><span>${p?'Change is relative to the comparison player.':'Ranks apply to loaded players only.'}</span></div><div class="table-scroll"><table class="rec-table"><thead><tr><th>PLAYER</th><th>CAP HIT ($M)</th><th>CAP SHARE</th><th>WAR</th><th>VALUE SCORE</th>${p?`<th>${result.metric==='war'?'WAR CHANGE':'SCORE CHANGE'}</th>`:''}<th>COMPARE</th></tr></thead><tbody>${result.rows.map(row=>{const delta=p?row[result.metric]-p[result.metric]:null;return `<tr><td><button class="player-name" data-detail="${row._id}">${esc(row.player)}</button><div class="player-meta">${esc(row.posteam)} · ${row.position}</div></td><td>${capMoney(row)}</td><td>${fmt(row.cap_pct,1)}%</td><td>${fmt(row.war,3)}</td><td>${pct(row.p_keep)}</td>${p?`<td class="${delta>0?'positive':delta<0?'negative-text':''}">${delta>0?'+':''}${fmt(delta*(result.metric==='war'?1:100),result.metric==='war'?3:1)} ${result.metric==='war'?'':'pp'}</td>`:''}<td><button class="button secondary small-button" data-compare="${row._id}">${state.selected.has(row._id)?'Remove':'Add'}</button></td></tr>`;}).join('')}</tbody></table></div>`;
}
function exportRecommendations() {
  const r=recState.result;if(!r?.rows.length)return;
  const fields=['player','position','posteam','season','cap_number','cap_pct','rookie_deal','war','rate_win','p_keep'];
  if(r.baseline)fields.push('baseline_player',r.metric==='war'?'war_change':'score_change_pp');
  const rows=r.rows.map(p=>({...p,baseline_player:r.baseline?.player,war_change:r.baseline?p.war-r.baseline.war:null,score_change_pp:r.baseline?(p.p_keep-r.baseline.p_keep)*100:null}));
  downloadCSV(rows,fields,`roster_recommendations_${r.position}_${r.season}.csv`);
  toast(`Exported ${rows.length} recommendations.`);
}
document.querySelectorAll('[data-rec-mode]').forEach(b=>b.addEventListener('click',()=>{recState.mode=b.dataset.recMode;renderRecommender();}));
$('recPosition').addEventListener('change',e=>{recState.position=e.target.value;renderRecommender();});
$('baselinePlayer').addEventListener('change',e=>{recState.baselineId=e.target.value;renderRecommender();});
$('baselineSearch').addEventListener('input',e=>{recState.search=e.target.value;syncRecommender();});
$('budgetUnit').addEventListener('change',e=>{recState.budgetUnit=e.target.value;recState.budgetLimit=e.target.value==='cap_number'?'10':'5';$('budgetValue').value=recState.budgetLimit;renderRecommender();});
$('budgetValue').addEventListener('input',e=>{recState.budgetLimit=e.target.value;renderRecommender();});
$('recLimit').addEventListener('change',e=>{recState.limit=+e.target.value;renderRecommender();});
$('higherOnly').addEventListener('change',e=>{recState.higherOnly=e.target.checked;renderRecommender();});
$('recExport').addEventListener('click',exportRecommendations);
document.addEventListener('click',e=>{
  if(e.target.closest('#clearRecBudget')){recState.budgetUnit='none';$('budgetUnit').value='none';renderRecommender();}
  const recommend=e.target.closest('[data-recommend]');if(recommend){recState.mode='score';recState.baselineId=recommend.dataset.recommend;recState.search='';$('baselineSearch').value='';$('detailDialog').close();location.hash='recommend';syncRecommender();}
});
