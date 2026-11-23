/* Thrall Dressed · Guild Dashboard */
(() => {
  // ---------- Constants ----------
  const CLASS_COLORS = {
    'Death Knight': '#C41E3A', Druid: '#FF7C0A', Hunter: '#AAD372', Mage: '#3FC7EB', Paladin: '#F48CBA',
    Priest: '#FFFFFF', Rogue: '#FFF468', Shaman: '#0070DD', Warlock: '#8788EE', Warrior: '#C69B6D',
    Monk: '#00FF98', 'Demon Hunter': '#A330C9', Evoker: '#33937F',
  };
  const PROF_COLORS = {
    Mining: '#A96523', Enchanting: '#967208', Skinning: '#747830', Tailoring: '#448088', Blacksmithing: '#7C7297',
    Herbalism: '#D12E93', Leatherworking: '#C65310', Alchemy: '#AE34EF', Engineering: '#2D854A',
    'First Aid': '#CF4530', Cooking: '#947233', Fishing: '#5D76A8',
  };
  const PRIMARY = ['Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Herbalism', 'Leatherworking', 'Mining', 'Skinning', 'Tailoring'];
  const SECONDARY = ['Cooking', 'Fishing', 'First Aid'];
  const CRAFTS = ['Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Leatherworking', 'Tailoring'];
  const ARMORY_CHAR = 'https://worldofwarcraft.blizzard.com/en-us/forever/us/armory/character/';
  const LEVEL_BAR = '#d9bc7b';

  const $ = (id) => document.getElementById(id);
  const classColor = (c) => CLASS_COLORS[c] || '#888';
  const fmt = (n) => (n == null ? '—' : String(n));
  const slug = (name) => String(name).trim().toLowerCase().replace(/\s+/g, '-');

  // ---------- State ----------
  let rows = [];         // profession rows
  let achievements = [];
  let latest = null;     // ISO time of the latest refresh
  const state = { q: '', prof: '', kind: 'Primary', cls: '', level: null, sort: 'level', dir: -1 };

  // ---------- Data ----------
  async function loadData() {
    document.body.classList.add('gp-loading');
    try {
      const res = await fetch(`/api/data?t=${Date.now()}`);
      const data = await res.json();
      rows = (data.professions && data.professions.rows) || [];
      achievements = (data.achievements && data.achievements.rows) || [];
      latest = (data.professions && data.professions.updated) || rows.map((r) => r.updated).filter(Boolean).sort().pop() || null;
    } catch (e) {
      console.error(e);
    } finally {
      document.body.classList.remove('gp-loading');
    }
    renderAll();
  }

  function characters() {
    const by = new Map();
    for (const r of rows) if (!by.has(r.character)) by.set(r.character, { character: r.character, cls: r.cls, level: r.level });
    return [...by.values()];
  }

  // ---------- Header & tiles ----------
  function renderSummary() {
    const prim = rows.filter((r) => r.kind === 'Primary');
    const top = prim.reduce((a, r) => (!a || r.skill > a.skill ? r : a), null);
    const counts = CRAFTS.map((c) => ({ c, n: new Set(prim.filter((r) => r.profession === c).map((r) => r.character)).size }));
    const min = Math.min(...counts.map((x) => x.n));
    const chars = characters();
    $('lede-members').textContent = chars.length;
    $('lede-active').textContent = rows.length;
    $('lede-thin').textContent = `${counts.filter((x) => x.n === min).map((x) => x.c).join(', ')} (${min})`;
    $('t-members').textContent = chars.length;
    $('t-prim').textContent = prim.length;
    $('t-top').textContent = top ? top.skill : '—';
    $('t-top-who').textContent = top ? `${top.profession} · ${top.character}` : '—';
    $('t-capped').textContent = rows.filter((r) => r.skill >= r.max).length;
    $('updated').textContent = latest
      ? new Date(latest).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '—';
  }

  // ---------- Achievements ----------
  function renderAchievements() {
    const n = achievements.filter((a) => a.at === latest).length;
    const chip = $('ach-new');
    chip.hidden = !n;
    chip.textContent = n ? `${n} new` : '';
    const cls = {};
    for (const r of rows) cls[r.character] = r.cls;
    const list = $('ach-list');
    list.replaceChildren();
    const sorted = [...achievements].sort((x, y) =>
      d3.descending(x.at, y.at) || d3.descending(x.kind === 'level', y.kind === 'level') ||
      d3.descending(+x.milestone, +y.milestone) || d3.ascending(x.character, y.character));
    if (!sorted.length) {
      const li = document.createElement('li');
      li.textContent = 'No milestones yet. They appear here as members level up and train.';
      list.appendChild(li);
      return;
    }
    for (const a of sorted) {
      const li = document.createElement('li');
      if (a.at === latest) li.classList.add('is-new');
      const date = document.createElement('span');
      date.className = 'gp-ach-date';
      date.textContent = new Date(a.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const text = document.createElement('span');
      const who = document.createElement('b');
      who.className = 'gp-cls';
      who.textContent = a.character;
      who.style.color = classColor(cls[a.character]);
      text.append(who, document.createTextNode(a.kind === 'level'
        ? ` reached level ${a.milestone}!`
        : ` reached ${a.milestone} in ${String(a.profession).toLowerCase()}!`));
      li.append(date, text);
      list.appendChild(li);
    }
  }

  // ---------- Shared chart helpers ----------
  function tooltip(el) {
    const tip = d3.select(el).append('div').attr('class', 'gp-tip').style('display', 'none');
    return {
      show(ev, lines) {
        const [px, py] = d3.pointer(ev, el);
        tip.style('display', null).html('');
        tip.append('div').attr('class', 'gp-tip-h').text(lines[0]);
        lines.slice(1).forEach((l) => tip.append('div').text(l));
        const tw = tip.node().offsetWidth;
        const W = el.clientWidth;
        tip.style('left', Math.min(Math.max(0, px + 12), W - tw) + 'px').style('top', (py - 10) + 'px');
      },
      hide() { tip.style('display', 'none'); },
    };
  }
  function styleAxis(g) {
    g.attr('class', 'gp-axis').attr('font-size', null).attr('font-family', null);
  }

  // ---------- Classes pie ----------
  function renderClassPie() {
    const el = $('class-pie');
    el.replaceChildren();
    const counts = d3.rollups(characters(), (v) => v.length, (d) => d.cls)
      .map(([cls, n]) => ({ cls, n })).sort((a, b) => b.n - a.n || d3.ascending(a.cls, b.cls));
    if (!counts.length) return;
    const total = d3.sum(counts, (d) => d.n);
    const size = Math.min(260, Math.max(160, (el.clientWidth || 400) * 0.5));
    const wrap = d3.select(el).append('div').attr('class', 'gp-pie-wrap');
    const svg = wrap.append('svg').attr('width', size).attr('height', size).attr('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`);
    const arcs = d3.pie().value((d) => d.n).sort(null).padAngle(0.012)(counts);
    const arc = d3.arc().innerRadius(size * 0.3).outerRadius(size / 2 - 2);
    const tip = tooltip(el);
    svg.selectAll('path').data(arcs).join('path')
      .attr('d', arc).attr('fill', (d) => classColor(d.data.cls))
      .attr('stroke', '#21150e').attr('stroke-width', 1.5)
      .attr('opacity', (d) => (!state.cls || state.cls === d.data.cls ? 1 : 0.3))
      .style('cursor', 'pointer')
      .on('click', (ev, d) => pickClass(d.data.cls))
      .on('pointermove', (ev, d) => tip.show(ev, [d.data.cls, `${d.data.n} character${d.data.n === 1 ? '' : 's'} · ${d3.format('.0%')(d.data.n / total)}`]))
      .on('pointerleave', tip.hide);
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em').attr('class', 'gp-pie-total').attr('fill', '#efeee2').text(total);
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '1.3em').attr('fill', '#b8bbae').style('font-size', '12px').text('characters');
    const li = wrap.append('ul').attr('class', 'gp-legend').selectAll('li').data(counts).join('li')
      .style('opacity', (d) => (!state.cls || state.cls === d.cls ? 1 : 0.4))
      .on('click', (ev, d) => pickClass(d.cls));
    li.append('span').attr('class', 'gp-swatch').style('background', (d) => classColor(d.cls));
    li.append('span').attr('class', 'gp-legend-name').style('color', (d) => classColor(d.cls)).text((d) => d.cls);
    li.append('span').attr('class', 'gp-legend-val').text((d) => d.n);
  }

  // ---------- Level distribution ----------
  function renderLevels() {
    const el = $('level-chart');
    el.replaceChildren();
    const chars = characters().filter((c) => c.level);
    if (!chars.length) { $('avg-level').textContent = '—'; return; }
    const data = d3.rollups(chars, (v) => v.length, (d) => d.level).map(([level, n]) => ({ level, n })).sort((a, b) => a.level - b.level);
    const levels = chars.map((c) => c.level);
    const mean = d3.mean(levels), sd = d3.deviation(levels) || 0;
    const avg = Math.round(mean * 10) / 10;
    $('avg-level').textContent = avg;
    const W = el.clientWidth || 400, H = 280, m = { l: 30, r: 12, t: 22, b: 28 };
    const minL = Math.max(1, d3.min(levels) - 2), maxL = Math.min(60, d3.max(levels) + 2);
    const x = d3.scaleLinear([minL - 0.5, maxL + 0.5], [m.l, W - m.r]);
    const maxN = d3.max(data, (d) => d.n);
    const y = d3.scaleLinear([0, Math.max(2, maxN)], [H - m.b, m.t]).nice();
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('overflow', 'visible');
    svg.append('g').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(Math.min(maxN, 5)).tickFormat(d3.format('d')).tickSize(-(W - m.l - m.r)))
      .call(styleAxis).call((g) => g.select('.domain').remove());
    const span = maxL - minL, step = span > 40 ? 10 : span > 20 ? 5 : span > 10 ? 2 : 1;
    svg.append('g').attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).tickValues(d3.range(Math.ceil(minL / step) * step, maxL + 1, step)).tickFormat(d3.format('d')).tickSizeOuter(0))
      .call(styleAxis);
    const lo = Math.max(minL - 0.5, mean - sd), hi = Math.min(maxL + 0.5, mean + sd);
    svg.append('rect').attr('class', 'gp-band').attr('x', x(lo)).attr('y', m.t).attr('width', Math.max(0, x(hi) - x(lo))).attr('height', H - m.b - m.t);
    const bw = Math.max(2, Math.min(32, (x(1) - x(0)) * 0.8));
    const tip = tooltip(el);
    svg.append('g').selectAll('rect').data(data).join('rect')
      .attr('x', (d) => x(d.level) - bw / 2).attr('width', bw)
      .attr('y', (d) => y(d.n)).attr('height', (d) => y(0) - y(d.n)).attr('rx', 2)
      .attr('fill', LEVEL_BAR)
      .attr('opacity', (d) => (state.level == null || state.level === d.level ? 1 : 0.3))
      .attr('stroke', (d) => (state.level === d.level ? '#efeee2' : null)).attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (ev, d) => pickLevel(d.level))
      .on('pointermove', (ev, d) => tip.show(ev, [`Level ${d.level}`, `${d.n} character${d.n === 1 ? '' : 's'}`]))
      .on('pointerleave', tip.hide);
    svg.append('line').attr('class', 'gp-avg-line').attr('x1', x(mean)).attr('x2', x(mean)).attr('y1', m.t - 4).attr('y2', H - m.b);
    const lab = svg.append('text').attr('class', 'gp-avg-label').attr('y', m.t - 8).text(`Avg ${avg}`);
    const lw = lab.node().getComputedTextLength();
    lab.attr('x', Math.min(Math.max(x(mean) - lw / 2, m.l), W - m.r - lw));
  }

  // ---------- Profession coverage ----------
  function coverage(kind) {
    const names = kind === 'Primary' ? PRIMARY : SECONDARY;
    return names.map((p) => {
      const rs = rows.filter((r) => r.profession === p);
      const best = rs.reduce((a, r) => (!a || r.skill > a.skill ? r : a), null);
      return { profession: p, n: rs.length, best: best ? best.skill : 0, who: best ? best.character : '' };
    }).sort((a, b) => b.n - a.n || d3.ascending(a.profession, b.profession));
  }
  function renderCoverage(id, kind) {
    const el = $(id);
    el.replaceChildren();
    const data = coverage(kind);
    const W = el.clientWidth || 400, rowH = kind === 'Primary' ? 30 : 44, H = data.length * rowH + 24;
    el.style.minHeight = H + 'px';
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('overflow', 'visible');
    const probe = svg.append('text').style('font-size', '12px');
    let lw = 0;
    data.forEach((d) => { probe.text(d.profession); lw = Math.max(lw, probe.node().getComputedTextLength()); });
    probe.remove();
    const m = { l: lw + 12, r: 28, t: 4, b: 20 };
    const maxN = Math.max(1, d3.max(data, (d) => d.n));
    const x = d3.scaleLinear([0, maxN], [m.l, W - m.r]);
    const y = d3.scaleBand(data.map((d) => d.profession), [m.t, H - m.b]).padding(0.3);
    svg.append('g').attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(Math.min(maxN, 6)).tickFormat(d3.format('d')).tickSize(-(H - m.b - m.t)))
      .call(styleAxis).call((g) => g.select('.domain').remove());
    svg.append('g').selectAll('text').data(data).join('text')
      .attr('x', m.l - 8).attr('y', (d) => y(d.profession) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('fill', (d) => (d.n ? '#efeee2' : '#b8bbae')).style('font-size', '12px')
      .style('font-weight', (d) => (state.prof === d.profession ? 600 : null))
      .style('cursor', (d) => (d.n ? 'pointer' : 'default'))
      .on('click', (ev, d) => { if (d.n) pickProf(d.profession, kind); })
      .text((d) => d.profession);
    const tip = tooltip(el);
    const bh = Math.min(y.bandwidth(), 32);
    svg.append('g').selectAll('rect').data(data).join('rect')
      .attr('x', m.l).attr('y', (d) => y(d.profession)).attr('height', bh)
      .attr('width', (d) => Math.max(0, x(d.n) - m.l)).attr('rx', 3)
      .attr('fill', (d) => (d.n ? PROF_COLORS[d.profession] || '#888' : '#45322a'))
      .attr('opacity', (d) => (!state.prof || state.prof === d.profession ? 1 : 0.3))
      .attr('stroke', (d) => (state.prof === d.profession ? '#efeee2' : null)).attr('stroke-width', 1.5)
      .style('cursor', (d) => (d.n ? 'pointer' : 'default'))
      .on('click', (ev, d) => { if (d.n) pickProf(d.profession, kind); })
      .on('pointermove', (ev, d) => tip.show(ev, [d.profession, `${d.n} character${d.n === 1 ? '' : 's'}`, ...(d.n ? [`Best: ${d.best} (${d.who})`] : [])]))
      .on('pointerleave', tip.hide);
    svg.append('g').selectAll('text').data(data).join('text')
      .attr('x', (d) => x(d.n) + 6).attr('y', (d) => y(d.profession) + bh / 2).attr('dy', '0.35em')
      .attr('fill', '#b8bbae').style('font-size', '12px').text((d) => d.n);
  }

  // ---------- Filters ----------
  function toTable() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => $('roster').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
  }
  function pickClass(cls) { state.cls = state.cls === cls ? '' : cls; renderFiltered(); if (state.cls) toTable(); }
  function pickLevel(lvl) { state.level = state.level === lvl ? null : lvl; renderFiltered(); if (state.level != null) toTable(); }
  function pickProf(prof, kind) {
    state.prof = state.prof === prof ? '' : prof;
    if (state.prof && kind === 'Secondary' && state.kind === 'Primary') { state.kind = ''; $('show-sec').checked = true; }
    renderFiltered();
    if (state.prof) toTable();
  }

  function renderChips() {
    const box = $('chips');
    box.replaceChildren();
    const chip = (label, clear) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gp-filter-chip';
      b.setAttribute('aria-label', `Remove filter: ${label}`);
      const t = document.createElement('span'); t.textContent = label;
      const x = document.createElement('span'); x.className = 'gp-filter-x'; x.setAttribute('aria-hidden', 'true'); x.textContent = '×';
      b.append(t, x);
      b.onclick = clear;
      box.appendChild(b);
    };
    if (state.cls) chip(`Class: ${state.cls}`, () => { state.cls = ''; renderFiltered(); });
    if (state.level != null) chip(`Level: ${state.level}`, () => { state.level = null; renderFiltered(); });
    box.hidden = !box.childNodes.length;
  }

  function renderProfSelect() {
    const sel = $('prof-select');
    const names = [...new Set(rows.filter((r) => !state.kind || r.kind === state.kind).map((r) => r.profession))].sort();
    if (state.prof && !names.includes(state.prof)) state.prof = '';
    sel.replaceChildren(new Option('All professions', ''), ...names.map((n) => new Option(n, n)));
    sel.value = state.prof;
  }

  // ---------- Table ----------
  function renderTable() {
    const tb = $('table-body');
    tb.replaceChildren();
    const s = state;
    const list = rows.filter((r) =>
      (!s.prof || r.profession === s.prof) && (!s.kind || r.kind === s.kind) &&
      (!s.cls || r.cls === s.cls) && (s.level == null || r.level === s.level) &&
      (!s.q || `${r.character} ${r.profession} ${r.cls}`.toLowerCase().includes(s.q)));
    const num = ['skill', 'level', 'max'].includes(s.sort);
    list.sort((a, b) => (num ? a[s.sort] - b[s.sort] : d3.ascending(a[s.sort], b[s.sort])) * s.dir || d3.ascending(a.character, b.character) || d3.ascending(a.profession, b.profession));
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan = 7; td.className = 'gp-empty'; td.textContent = 'No characters match these filters.';
      tr.appendChild(td); tb.appendChild(tr);
      return;
    }
    for (const r of list) {
      const tr = document.createElement('tr');
      const td = (text, cls) => { const c = document.createElement('td'); c.textContent = text; if (cls) c.className = cls; tr.appendChild(c); return c; };
      const color = classColor(r.cls);
      const nameTd = td('', 'gp-cls');
      const a = document.createElement('a');
      a.className = 'gp-link'; a.href = ARMORY_CHAR + encodeURIComponent(slug(r.character));
      a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = r.character; a.style.color = color;
      nameTd.appendChild(a);
      td(r.cls, 'gp-hide-narrow gp-cls').style.color = color;
      td(r.level, 'gp-hide-narrow');
      td(r.profession);
      td(r.kind, 'gp-hide-narrow gp-muted');
      const sc = td('');
      const wrap = document.createElement('div'); wrap.className = 'gp-bar';
      const n = document.createElement('span'); n.textContent = r.skill; n.style.minWidth = '2.2em';
      if (r.skill >= r.max) { n.style.color = 'var(--warn)'; n.style.fontWeight = '600'; }
      const track = document.createElement('div'); track.className = 'gp-bar-track';
      const fill = document.createElement('div'); fill.className = 'gp-bar-fill';
      fill.style.width = `${Math.min(100, (r.skill / 300) * 100)}%`;
      fill.style.background = PROF_COLORS[r.profession] || '#888';
      track.appendChild(fill); wrap.append(n, track); sc.appendChild(wrap);
      td(r.max, 'gp-muted');
      tb.appendChild(tr);
    }
  }

  // ---------- Render ----------
  function renderFiltered() {
    renderChips();
    renderProfSelect();
    renderClassPie();
    renderLevels();
    renderCoverage('cov-prim', 'Primary');
    renderCoverage('cov-sec', 'Secondary');
    renderTable();
  }
  function renderAll() {
    renderSummary();
    renderAchievements();
    renderFiltered();
  }

  // ---------- Controls ----------
  function wire() {
    $('search').addEventListener('input', (e) => { state.q = e.target.value.toLowerCase(); renderTable(); });
    $('prof-select').addEventListener('change', (e) => { state.prof = e.target.value; renderFiltered(); });
    $('show-sec').addEventListener('change', (e) => { state.kind = e.target.checked ? '' : 'Primary'; renderFiltered(); });
    document.querySelectorAll('.gp-table th button[data-sort]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.sort;
      state.dir = state.sort === k ? -state.dir : (['skill', 'level', 'max'].includes(k) ? -1 : 1);
      state.sort = k;
      document.querySelectorAll('.gp-table th').forEach((th) => th.removeAttribute('aria-sort'));
      b.parentElement.setAttribute('aria-sort', state.dir > 0 ? 'ascending' : 'descending');
      renderTable();
    }));
    $('refresh-btn').addEventListener('click', refresh);
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderFiltered, 150); });
  }

  async function refresh() {
    const btn = $('refresh-btn'), msg = $('refresh-msg');
    btn.disabled = true; btn.classList.add('gp-spin');
    msg.hidden = false; msg.textContent = 'Reading the Armory… this takes about 20 seconds.';
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) {
        const n = (out.newAchievements || []).length;
        msg.textContent = n ? `Updated: ${n} new achievement${n === 1 ? '' : 's'}!` : 'Updated: no new achievements.';
        await loadData();
      } else {
        msg.textContent = out.message || 'Refresh failed. Showing the last saved data.';
      }
    } catch {
      msg.textContent = 'Refresh failed. Showing the last saved data.';
    } finally {
      btn.disabled = false; btn.classList.remove('gp-spin');
      setTimeout(() => { msg.hidden = true; }, 8000);
    }
  }

  document.addEventListener('DOMContentLoaded', () => { wire(); loadData(); });
})();
