/* Pure data and recommendation logic, shared by the browser and Node checks. */
(function (root) {
  'use strict';
  const positions = ['QB', 'RB', 'WR', 'TE'];
  const required = ['player', 'position', 'posteam', 'season', 'cap_pct', 'rookie_deal', 'war', 'rate_win', 'p_keep'];
  const aliases = { team: 'posteam', cap_share_pct: 'cap_pct', probability_positive_next_season: 'p_keep', 'cap_hit_$M': 'cap_number', 'salary_$M': 'cap_number' };
  function normalizeRows(input) {
    if (!Array.isArray(input) || !input.length) throw new Error('Provide at least one scored player.');
    if (input.length > 20000) throw new Error('This dashboard supports up to 20,000 player-seasons.');
    const keys = new Set();
    return input.map((raw, i) => {
      const row = { ...raw };
      for (const [alias, field] of Object.entries(aliases)) if (!(field in row) && alias in row) row[field] = row[alias];
      for (const f of required) if (!(f in row)) throw new Error(`Row ${i + 1}: missing ${f}. Use the updated notebook export cell.`);
      const p = {};
      for (const f of ['player', 'posteam', 'position']) {
        if (typeof row[f] !== 'string' || !row[f].trim()) throw new Error(`Row ${i + 1}: provide ${f}.`);
        p[f] = row[f].trim();
      }
      p.position = p.position.toUpperCase();
      if (!positions.includes(p.position)) throw new Error(`Row ${i + 1}: position must be QB, RB, WR, or TE.`);
      if (p.player.length > 100 || p.posteam.length > 30) throw new Error(`Row ${i + 1}: player or team name is too long.`);
      for (const f of required.slice(3)) {
        if (row[f] === null || String(row[f]).trim() === '' || !Number.isFinite(Number(row[f]))) throw new Error(`Row ${i + 1}: ${f} must be a finite number.`);
        p[f] = Number(row[f]);
      }
      if (p.p_keep < 0 || p.p_keep > 1) throw new Error(`Row ${i + 1}: p_keep must be between 0 and 1.`);
      if (p.cap_pct < 0 || p.cap_pct > 100) throw new Error(`Row ${i + 1}: cap_pct must use percentage points between 0 and 100.`);
      if (![0, 1].includes(p.rookie_deal)) throw new Error(`Row ${i + 1}: rookie_deal must be 0 or 1.`);
      if (!Number.isInteger(p.season) || p.season < 1900 || p.season > 2100) throw new Error(`Row ${i + 1}: season must be a four-digit year.`);
      p.cap_number = null;
      if (row.cap_number !== undefined && row.cap_number !== null && String(row.cap_number).trim() !== '') {
        p.cap_number = Number(row.cap_number);
        if (!Number.isFinite(p.cap_number) || p.cap_number < 0) throw new Error(`Row ${i + 1}: cap_number must be a nonnegative dollar cap hit in millions.`);
      }
      if (row.gsis_id) p.gsis_id = String(row.gsis_id).slice(0, 40);
      if (row.plays !== undefined && row.plays !== null && row.plays !== '') {
        p.plays = Number(row.plays);
        if (!Number.isInteger(p.plays) || p.plays < 0) throw new Error(`Row ${i + 1}: plays must be a nonnegative integer.`);
      }
      const key = `${p.gsis_id || p.player.toLowerCase()}|${p.position}|${p.season}`;
      if (keys.has(key)) throw new Error(`Row ${i + 1}: duplicate player-position-season.`);
      keys.add(key);
      return p;
    });
  }
  function parseCSV(text) {
    const records = []; let row = [], cell = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
      else if (c === '"') { if (cell.trim()) throw new Error('Invalid CSV quoting. Please re-export.'); quoted = true; }
      else if (c === ',') { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(Boolean)) records.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (quoted) throw new Error('Unfinished quoted CSV field. Please re-export.');
    row.push(cell.trim()); if (row.some(Boolean)) records.push(row);
    if (records.length < 2) throw new Error('The CSV needs a header and at least one player.');
    const headers = records.shift();
    if (new Set(headers.map(h => aliases[h] || h)).size !== headers.length) throw new Error('The CSV contains duplicate or overlapping column names.');
    return normalizeRows(records.map((r, i) => {
      if (r.length !== headers.length) throw new Error(`CSV row ${i + 2}: column count does not match the header.`);
      return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
    }));
  }
  function recommend(rows, options) {
    const { mode = 'score', position = 'QB', baselineId, budgetUnit = 'none', budgetLimit, limit = 5, higherOnly = true } = options;
    if (!['position', 'score', 'war'].includes(mode)) throw new Error('Choose a supported recommendation mode.');
    if (!['none', 'cap_pct', 'cap_number'].includes(budgetUnit)) throw new Error('Choose a supported budget unit.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Choose between 1 and 50 results.');
    const season = Math.max(...rows.map(p => p.season));
    const latest = rows.filter(p => p.season === season);
    const baseline = mode === 'position' ? null : latest.find(p => p._id === baselineId);
    if (mode !== 'position' && !baseline) throw new Error('Choose a baseline player from the latest loaded season.');
    const pos = baseline ? baseline.position : position;
    if (!positions.includes(pos)) throw new Error('Choose QB, RB, WR, or TE.');
    let pool = latest.filter(p => p.position === pos && (!baseline || p._id !== baseline._id));
    const poolSize = pool.length;
    const missingCost = budgetUnit === 'cap_number' ? pool.filter(p => !Number.isFinite(p.cap_number)).length : 0;
    if (budgetUnit !== 'none') {
      if (budgetLimit === '' || budgetLimit === null || !Number.isFinite(Number(budgetLimit)) || Number(budgetLimit) < 0) throw new Error('Enter a budget of zero or more, or choose No budget limit.');
      if (budgetUnit === 'cap_pct' && Number(budgetLimit) > 100) throw new Error('Cap share cannot exceed 100%.');
      pool = pool.filter(p => Number.isFinite(p[budgetUnit]) && p[budgetUnit] <= Number(budgetLimit));
    }
    const withinBudget = pool.length;
    if (mode === 'score' && higherOnly) pool = pool.filter(p => p.p_keep > baseline.p_keep);
    const metric = mode === 'war' ? 'war' : 'p_keep';
    pool.sort((a, b) => b[metric] - a[metric] || a.player.localeCompare(b.player));
    return { rows: pool.slice(0, limit), eligibleCount: pool.length, poolSize, withinBudget, missingCost, baseline, position: pos, season, metric };
  }
  const api = { normalizeRows, parseCSV, recommend };
  root.RosterEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
