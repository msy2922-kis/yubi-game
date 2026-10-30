// ===== 순수 게임 로직 (DOM 의존 없음): 능력치 공식 · 이동 · 공격 범위 · 피해 · 책략 · 경험치 · AI =====
// 공식 출처: docs/research_generals_formulas.md (PC판 메모리 해석)
(function (root) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const key = (x, y) => x + ',' + y;
  const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  const corr = (v) => Math.floor(4000 / (140 - v));
  const enemiesOf = (side) => (side === 'e' ? ['p', 'n'] : ['e']);
  const isFoe = (a, b) => enemiesOf(a.side).includes(b.side);

  // ---------- 능력치 ----------
  function bestItem(u, type, field) {
    let b = 0;
    for (const it of u.items || []) { const d = ITEMS[it]; if (d && d.type === type && d[field] > b) b = d[field]; }
    return b;
  }
  function stats(u) {
    const c = CLASSES[u.cls];
    const atk = Math.floor(((corr(u.mu) + c.atk * 2 + u.morale) * (u.lv + 10) / 10) * (100 + bestItem(u, 'weapon', 'atk')) / 100);
    const def = Math.floor(((corr(u.tong) + c.def * 2 + u.morale) * (u.lv + 10) / 10) * (100 + bestItem(u, 'book', 'def')) / 100);
    const maxhp = c.hp0 + c.hpLv * (u.lv - 1);
    const mov = c.mov + bestItem(u, 'horse', 'mov');
    const maxmp = Math.min(255, Math.floor((u.lv + 10) * u.chi / 40));
    const tac = Math.floor(u.chi * u.lv / 50 + u.chi);
    return { atk, def, maxhp, mov, maxmp, tac };
  }
  function maxHp(u) { const c = CLASSES[u.cls]; return c.hp0 + c.hpLv * (u.lv - 1); }
  function maxMp(u) { return Math.min(255, Math.floor((u.lv + 10) * u.chi / 40)); }

  // ---------- 지형 · 이동 ----------
  function tileAt(map, x, y) {
    if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return null;
    return map[y][x];
  }
  function unitAt(units, x, y) { return units.find((u) => u.alive && u.x === x && u.y === y) || null; }
  function moveCost(u, ch) {
    const t = TERRAIN[ch], c = CLASSES[u.cls];
    if (!t || t.block) return Infinity;
    if (t.mountain && !c.mountain) return Infinity;
    if (t.noCav && c.cav) return Infinity;
    let cost = t.cost;
    if (t.rough && c.rough) cost = 2;
    if (t.cavRough && c.cav) cost = 2;
    return cost;
  }
  function computeReach(map, units, u) {
    const mov = stats(u).mov;
    const start = key(u.x, u.y);
    const best = new Map([[start, { cost: 0, from: null, x: u.x, y: u.y }]]);
    const open = [[0, u.x, u.y]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [c, x, y] = open.shift();
      if (c > best.get(key(x, y)).cost) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        const ch = tileAt(map, nx, ny);
        if (!ch) continue;
        const mc = moveCost(u, ch);
        if (!isFinite(mc)) continue;
        const occ = unitAt(units, nx, ny);
        if (occ && isFoe(u, occ)) continue;
        const nc = c + mc;
        if (nc > mov) continue;
        const k = key(nx, ny);
        if (!best.has(k) || nc < best.get(k).cost) { best.set(k, { cost: nc, from: key(x, y), x: nx, y: ny }); open.push([nc, nx, ny]); }
      }
    }
    for (const [k, v] of best) if (k !== start && unitAt(units, v.x, v.y)) v.blocked = true;
    return best;
  }
  function pathTo(reach, x, y) {
    const out = []; let k = key(x, y);
    while (k) { const n = reach.get(k); out.unshift([n.x, n.y]); k = n.from; }
    return out;
  }

  // ---------- 공격 범위 ----------
  const RANGE_CACHE = {};
  function rangeOffsets(rng) {
    if (RANGE_CACHE[rng]) return RANGE_CACHE[rng];
    let out = [];
    const ring8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    if (rng === 'a4') out = DIRS.slice();
    else if (rng === 'a8') out = ring8;
    else if (rng === 'bow') out = [[1, 1], [1, -1], [-1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
    else if (rng === 'xbow' || rng === 'cata') {
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        if (!dx && !dy) continue;
        if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
        if (Math.abs(dx) + Math.abs(dy) === 1) continue;
        out.push([dx, dy]);
      }
      if (rng === 'cata') out.push([3, 0], [-3, 0], [0, 3], [0, -3]);
    }
    RANGE_CACHE[rng] = out; return out;
  }
  function inRange(u, x, y, t) {
    const dx = t.x - x, dy = t.y - y;
    return rangeOffsets(CLASSES[u.cls].rng).some(([a, b]) => a === dx && b === dy);
  }
  function targetsFrom(units, u, x, y) { return units.filter((t) => t.alive && isFoe(u, t) && inRange(u, x, y, t)); }
  function attackOptions(map, units, u, reach) {
    const opts = new Map();
    for (const v of reach.values()) {
      if (v.blocked) continue;
      for (const t of targetsFrom(units, u, v.x, v.y)) {
        if (!opts.has(t.id)) opts.set(t.id, []);
        opts.get(t.id).push({ x: v.x, y: v.y, cost: v.cost, def: TERRAIN[tileAt(map, v.x, v.y)].def });
      }
    }
    return opts;
  }
  function bestSpot(spots, cur) {
    let b = null;
    for (const s of spots) {
      const sc = (s.x === cur.x && s.y === cur.y ? 50 : 0) + s.def * 2 - s.cost;
      if (!b || sc > b.sc) b = { ...s, sc };
    }
    return b;
  }

  // ---------- 물리 피해 ----------
  function classMult(a, d) {
    const al = CLASSES[a.cls].line, dl = CLASSES[d.cls].line;
    if (ADV[al] === dl) return 0.75;   // 공격측 유리: 방어력 ×0.75
    if (ADV[dl] === al) return 1.25;   // 공격측 불리
    return 1;
  }
  function calcDmg(map, a, d, opt = {}) {
    const pos = opt.dpos || d;
    const terr = TERRAIN[tileAt(map, pos.x, pos.y)].def;
    let dmg = (stats(a).atk - stats(d).def * classMult(a, d) / 2) * (100 - terr) / 100;
    if (opt.counter) dmg /= 2;
    return Math.max(1, Math.floor(dmg));
  }
  function moraleLoss(dmg, d) { return Math.max(1, Math.floor(dmg / (d.lv + 5) / 3)); }
  function counterChance(d, a) {
    const dc = CLASSES[d.cls], ac = CLASSES[a.cls];
    if (!dc.counter) return 0;
    if (!(ac.line === 'bandit' || ac.cav || ['monk', 'tribe', 'beast'].includes(a.cls))) return 0;
    if (!inRange(d, d.x, d.y, a)) return 0;
    return d.mu / 150;
  }
  // ---------- 경험치 ----------
  function xpForHit(a, d) { return a.lv <= d.lv ? Math.min(16, (d.lv - a.lv + 3) * 2) : 4; }
  function xpForKill(a, d) { return d.boss ? 48 : a.lv < d.lv ? 32 : Math.floor(64 / (a.lv - d.lv + 2)); }

  // ---------- 책략 ----------
  const TRANGE = {};
  function tacticOffsets(rng) {
    if (TRANGE[rng]) return TRANGE[rng];
    const out = [];
    const r = rng === 'l' ? 2 : 1;
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (!dx && !dy) continue;
      if (rng === 'l' && Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
      out.push([dx, dy]);
    }
    if (rng === 'm') out.push([2, 0], [-2, 0], [0, 2], [0, -2]);
    TRANGE[rng] = out; return out;
  }
  function learned(u) {
    const list = (LEARN[CLASSES[u.cls].tac] || []).filter(([, lv, tier]) => u.lv >= lv && (!tier || CLASSES[u.cls].tier >= tier)).map(([n]) => n);
    if (u.hero === 'liubei') for (const [n, lv] of LIUBEI_TACTICS) if (u.lv >= lv) list.push(n);
    return [...new Set(list)];
  }
  const isAttackTac = (t) => ['fire', 'water', 'earth'].includes(t.type);
  const isHostileTac = (t) => isAttackTac(t) || t.type === 'morale' || t.type === 'confuse';
  // 책략을 그 칸의 대상에게 쓸 수 있는가 (지형·날씨)
  function tacticTileOk(map, tac, x, y, weather) {
    const ch = tileAt(map, x, y); if (!ch) return false;
    if (!isAttackTac(tac)) return true;
    const t = TERRAIN[ch];
    if (!t.tactic) return false;
    if (tac.type === 'fire' && weather === 'rain') return false;
    return t.tactic.split(' ').includes(tac.type);
  }
  // 사용 가능한 목표 칸 목록 [{x,y,units:[...]}]
  function tacticTargets(map, units, u, name, weather) {
    const tac = TACTICS[name];
    const out = [];
    for (const [dx, dy] of tacticOffsets(tac.rng)) {
      const x = u.x + dx, y = u.y + dy;
      if (!tileAt(map, x, y)) continue;
      const cells = tac.cross ? [[x, y], ...DIRS.map(([a, b]) => [x + a, y + b])] : [[x, y]];
      const affected = [];
      for (const [cx, cy] of cells) {
        const t = unitAt(units, cx, cy);
        if (!t) continue;
        if (isHostileTac(tac) ? !isFoe(u, t) : isFoe(u, t)) continue;
        if (!tacticTileOk(map, tac, cx, cy, weather)) continue;
        affected.push(t);
      }
      if (affected.length) out.push({ x, y, units: affected });
    }
    return out;
  }
  // 책략 결과 계산 (상태는 변경하지 않음)
  function tacticResolve(map, u, name, targets, weather) {
    const tac = TACTICS[name], su = stats(u);
    const res = [];
    for (const t of targets) {
      const st = stats(t), r = { target: t, ok: true };
      if (isHostileTac(tac)) {
        const roll = Math.random() * (u.chi * u.lv / 100 + u.chi);
        let evade = st.tac / 4; if (CLASSES[t.cls].support) evade *= 2;
        r.ok = roll > evade;
      }
      if (!r.ok) { res.push(r); continue; }
      if (isAttackTac(tac)) {
        let dmg = su.tac * 2 - st.tac + tac.pow;
        dmg += Math.random() * dmg / 50;
        const ch = tileAt(map, t.x, t.y);
        if (tac.type === 'fire' && TERRAIN[ch].fireBonus) dmg *= 1.25;
        if (tac.type === 'water' && weather === 'rain') dmg *= 1.25;
        if (CLASSES[t.cls].support) dmg /= 2;
        r.dmg = Math.max(1, Math.floor(dmg));
      } else if (tac.type === 'morale') r.morale = -tac.pow;
      else if (tac.type === 'confuse') r.confuse = true;
      else if (tac.type === 'heal') r.heal = tac.pow + Math.floor(u.chi * u.lv / 20);
      else if (tac.type === 'cheer') r.morale = tac.pow;
      else { r.heal = tac.pow + Math.floor(u.chi * u.lv / 20); r.morale = tac.morale; }
      res.push(r);
    }
    return res;
  }

  // ---------- 목표까지의 이동비용 필드 ----------
  function distField(map, unit, tx, ty) {
    const rows = map.length, cols = map[0].length;
    const f = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
    f[ty][tx] = 0;
    const open = [[0, tx, ty]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [c, x, y] = open.shift();
      if (c > f[y][x]) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        const ch = tileAt(map, nx, ny);
        if (!ch) continue;
        const mc = moveCost(unit, ch);
        if (!isFinite(mc)) continue;
        const nc = c + mc;
        if (nc < f[ny][nx]) { f[ny][nx] = nc; open.push([nc, nx, ny]); }
      }
    }
    return f;
  }

  // ---------- AI (적군 · NPC) ----------
  // 반환: {type:'stay'} | {type:'move',x,y,reach} | {type:'attack',x,y,target,reach} | {type:'tactic',x,y,name,cell,reach}
  function planUnit(map, units, e, weather) {
    const foes = units.filter((u) => u.alive && isFoe(e, u));
    if (!foes.length) return { type: 'stay' };
    if (e.ai === 'passive') {
      if (!foes.some((p) => dist(p.x, p.y, e.x, e.y) <= (e.aggro || 4))) {
        const t = targetsFrom(units, e, e.x, e.y);   // 범위 안이면 그 자리에서 공격
        if (t.length) return { type: 'attack', x: e.x, y: e.y, target: pickTarget(map, e, t, e.x, e.y), reach: null };
        return { type: 'stay' };
      }
      e.ai = 'active';
    }
    const reach = e.ai === 'fixed' ? new Map([[key(e.x, e.y), { cost: 0, from: null, x: e.x, y: e.y }]]) : computeReach(map, units, e);
    const st = stats(e);
    let best = null;
    for (const v of reach.values()) {
      if (v.blocked) continue;
      const tdef = TERRAIN[tileAt(map, v.x, v.y)].def;
      for (const p of foes) {
        if (!inRange(e, v.x, v.y, p)) continue;
        const dmg = calcDmg(map, e, p);
        const score = dmg + (dmg >= p.hp ? 300 : 0) + tdef * 3 - v.cost * 0.5 + (p.hero === 'liubei' ? dmg * 0.2 : 0);
        if (!best || score > best.score) best = { type: 'attack', x: v.x, y: v.y, target: p, score, reach };
      }
    }
    // 공격 책략 (잡병 포함, 책략치가 있을 때)
    const tacs = learned(e).filter((n) => isAttackTac(TACTICS[n]) && TACTICS[n].mp <= e.mp && !TACTICS[n].cross);
    if (tacs.length) {
      const saved = { x: e.x, y: e.y };
      for (const v of reach.values()) {
        if (v.blocked) continue;
        e.x = v.x; e.y = v.y;
        for (const n of tacs) {
          const tac = TACTICS[n];
          for (const tg of tacticTargets(map, units, e, n, weather)) {
            const t = tg.units[0], tt = stats(t);
            const prob = Math.max(0.05, Math.min(1, 1 - (tt.tac / 4 * (CLASSES[t.cls].support ? 2 : 1)) / (e.chi * e.lv / 100 + e.chi)));
            const dmg = Math.max(1, st.tac * 2 - tt.tac + tac.pow) * prob;
            const score = dmg + (dmg >= t.hp ? 200 : 0) + TERRAIN[tileAt(map, v.x, v.y)].def * 3 - v.cost * 0.5 - tac.mp * 2;
            if (!best || score > best.score) best = { type: 'tactic', x: v.x, y: v.y, name: n, cell: tg, score, reach };
          }
        }
      }
      e.x = saved.x; e.y = saved.y;
    }
    // 지원 책략 (수송대·군악대·주술사): 병력 60% 미만 아군 회복
    if (CLASSES[e.cls].support) {
      const heals = learned(e).filter((n) => ['heal', 'cure'].includes(TACTICS[n].type) && TACTICS[n].mp <= e.mp && !TACTICS[n].cross);
      for (const n of heals) for (const tg of tacticTargets(map, units, e, n, weather)) {
        const t = tg.units[0];
        if (t !== e && t.hp < maxHp(t) * 0.6) { const score = 150 + (maxHp(t) - t.hp) / 10; if (!best || score > best.score) best = { type: 'tactic', x: e.x, y: e.y, name: n, cell: tg, score, reach }; }
      }
    }
    if (best) return best;
    if (e.ai === 'fixed') return { type: 'stay' };

    // 병력 40% 미만이면 회복 지형으로
    if (e.hp < maxHp(e) * 0.4) {
      let hb = null;
      for (const v of reach.values()) { if (v.blocked) continue; const t = TERRAIN[tileAt(map, v.x, v.y)]; if (t.heal && (!hb || v.cost < hb.cost)) hb = v; }
      if (hb) return hb.x === e.x && hb.y === e.y ? { type: 'stay' } : { type: 'move', x: hb.x, y: hb.y, reach };
    }
    let tp = null, td = Infinity;
    for (const p of foes) { const d = dist(e.x, e.y, p.x, p.y); if (d < td) { td = d; tp = p; } }
    const field = distField(map, e, tp.x, tp.y);
    let bt = null;
    for (const v of reach.values()) {
      if (v.blocked) continue;
      const d = field[v.y][v.x];
      if (!isFinite(d)) continue;
      const sc = -d + TERRAIN[tileAt(map, v.x, v.y)].def * 0.05;
      if (!bt || sc > bt.sc) bt = { x: v.x, y: v.y, sc };
    }
    if (!bt || (bt.x === e.x && bt.y === e.y)) return { type: 'stay' };
    return { type: 'move', x: bt.x, y: bt.y, reach };
  }
  function pickTarget(map, e, list, x, y) {
    let b = null, bs = -1;
    for (const p of list) { const d = calcDmg(map, e, p); const s = d + (d >= p.hp ? 300 : 0); if (s > bs) { bs = s; b = p; } }
    return b;
  }

  root.Logic = { key, dist, corr, isFoe, enemiesOf, stats, maxHp, maxMp, tileAt, unitAt, moveCost, computeReach, pathTo, rangeOffsets, inRange, targetsFrom,
    attackOptions, bestSpot, classMult, calcDmg, moraleLoss, counterChance, xpForHit, xpForKill,
    tacticOffsets, learned, isAttackTac, isHostileTac, tacticTileOk, tacticTargets, tacticResolve, distField, planUnit };
})(typeof window !== 'undefined' ? window : globalThis);
