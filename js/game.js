// ===== UI · 렌더링 · 턴 진행 · 진영(출격/상점) =====
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#map');
  const ctx = canvas.getContext('2d');
  const wrap = $('#mapwrap');
  const L = Logic;
  const SAVE_KEY = 'yubi-save-v2';          // 구버전 단일 세이브 (슬롯 0으로 승계)
  const ACC_KEY = 'yubi-account-v1';       // {id, token} 로그인 세션
  const API_URL = 'https://yubi-game-api-msy2922.vercel.app';
  const SLOTS = 3;
  const ACC = { id: null, token: null, slot: null, guest: false };
  const SET_KEY = 'yubi-settings-v1';
  const settings = Object.assign({ battleAnim: true, zoom: false }, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
  function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) { /* 저장 불가 */ } }
  function updateAnimBtn() { const b = $('#btnAnim'); if (b) b.textContent = `전투 장면: ${settings.battleAnim ? '켜짐' : '꺼짐'}`; }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const show = (s) => $(s).classList.remove('hidden');
  const hide = (s) => $(s).classList.add('hidden');
  const rnd = (n) => Math.floor(Math.random() * n);
  const WEATHER = { sun: '맑음 ☀', cloud: '흐림 ☁', rain: '비 ☔' };

  let TS = 32, dpr = 1, nextId = 1, toastTimer = null;
  const IMG = {};
  for (const name of IMAGE_LIST) { const im = new Image(); im.onload = () => { IMG[name] = im; }; im.src = 'img/' + name + '.png'; }

  // ---------- 진행 상태 (저장 대상) ----------
  const P = { roster: {}, gold: 0, stageId: null, flags: {}, order: [] };
  // ---------- 전투 상태 ----------
  const G = {
    stage: null, map: null, units: [], turn: 1, phase: 'player', state: 'idle', busy: false, weather: 'sun', fx: [],
    sel: null, reach: null, atkOpts: null, origin: null, moveTargets: [], tacName: null, tacItem: null, tacCells: null,
    inspect: null, floats: [], shot: null, dialog: null, acting: null, toast: '', taken: new Set(), spawned: new Set(), winMsg: '',
  };

  // ---------- 장수 · 부대 생성 ----------
  function newHeroRecord(id) {
    const h = HEROES[id];
    return { lv: h.lv, xp: 0, cls: h.cls, items: (h.items || []).slice() };
  }
  function makePlayerUnit(id) {
    const h = HEROES[id], r = P.roster[id];
    const u = { id: nextId++, hero: id, name: h.name, ch: h.ch, cls: r.cls, side: 'p', lv: r.lv, xp: r.xp, items: r.items,
      mu: h.mu, chi: h.chi, tong: h.tong, morale: 100, portrait: h.portrait, lord: !!h.lord, alive: true, acted: false, confused: false };
    u.hp = L.maxHp(u); u.mp = L.maxMp(u);
    return u;
  }
  function makeUnit(spec, side) {
    const c = CLASSES[spec.cls];
    const st = GENERALS[spec.name] || TROOP_STATS[c.tier] || TROOP_STATS[1];
    const named = !!GENERALS[spec.name];
    const u = { id: nextId++, name: spec.name, ch: spec.name[0], cls: spec.cls, side, lv: spec.lv, xp: 0, items: (spec.items || []).slice(),
      mu: st[0], chi: st[1], tong: st[2], morale: side === 'e' ? (named ? 85 : 70) : 100, x: spec.x, y: spec.y, boss: !!spec.boss,
      portrait: PORTRAITS[spec.name], ai: spec.ai || 'active', aggro: spec.aggro || 4, named, alive: true, acted: false, confused: false };
    u.hp = L.maxHp(u); u.mp = L.maxMp(u);
    return u;
  }

  // ---------- 저장 ----------
  // 슬롯 저장: 로컬(기기)에는 항상, 로그인 상태면 서버에도 올린다
  const slotKey = (slot) => `yubi-slot-${ACC.id ? 'u:' + ACC.id.toLowerCase() : 'local'}-${slot}`;
  function saveMeta() { const st = STAGES[P.stageId] || {}; return { stageId: P.stageId, title: st.title || '', chapter: st.chapter || '', gold: P.gold, heroes: P.order.length, lv: P.roster.liubei ? P.roster.liubei.lv : 1, updated: Date.now() }; }
  let pushTimer = null;
  function saveGame() {
    if (ACC.slot === null) return;
    const payload = { meta: saveMeta(), data: P };
    try { localStorage.setItem(slotKey(ACC.slot), JSON.stringify(payload)); } catch (e) { /* 저장 불가 */ }
    if (ACC.id && ACC.token) { clearTimeout(pushTimer); pushTimer = setTimeout(() => pushSave(payload), 800); }
  }
  async function pushSave(payload) {
    try { const r = await api('saves', { op: 'save', slot: ACC.slot, meta: payload.meta, data: payload.data }); if (r.error) throw new Error(r.error); }
    catch (e) { toast('서버 저장 실패 — 이 기기에만 저장됨'); }
  }
  function localSlot(slot) { try { return JSON.parse(localStorage.getItem(slotKey(slot))); } catch (e) { return null; } }
  async function api(path, body) {
    const r = await fetch(`${API_URL}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ id: ACC.id, token: ACC.token }, body)) });
    let j; try { j = await r.json(); } catch (e) { j = { error: `서버 응답 오류 (${r.status})` }; }
    if (j && j.error && typeof j.error !== 'string') j.error = j.error.message || `서버 오류 (${r.status})`;
    return j;
  }
  function saveAccount() { try { if (ACC.id) localStorage.setItem(ACC_KEY, JSON.stringify({ id: ACC.id, token: ACC.token })); else localStorage.removeItem(ACC_KEY); } catch (e) { /* 무시 */ } }
  function loadAccount() { try { const a = JSON.parse(localStorage.getItem(ACC_KEY)); if (a && a.id && a.token) { ACC.id = a.id; ACC.token = a.token; } } catch (e) { /* 무시 */ } }
  // 구버전 단일 세이브 → 로컬 슬롯 0
  (() => { try { const old = localStorage.getItem(SAVE_KEY); if (old && !localStorage.getItem('yubi-slot-local-0')) { const d = JSON.parse(old); localStorage.setItem('yubi-slot-local-0', JSON.stringify({ meta: { stageId: d.stageId, title: (STAGES[d.stageId] || {}).title || '', chapter: (STAGES[d.stageId] || {}).chapter || '', gold: d.gold, heroes: (d.order || []).length, updated: Date.now() }, data: d })); } } catch (e) { /* 무시 */ } })();
  function newGame() {
    Object.assign(P, { roster: {}, gold: 300, stageId: FIRST_STAGE, flags: {}, order: ['liubei', 'guanyu', 'zhangfei'] });
    for (const id of P.order) P.roster[id] = newHeroRecord(id);
    saveGame();
    Story.play(OPENING).then(() => gotoStage(FIRST_STAGE));
  }
  function addHero(id) {
    if (P.roster[id]) return;
    P.roster[id] = newHeroRecord(id); P.order.push(id);
  }

  // ---------- 스테이지 진행 ----------
  const artShown = new Set();   // 이번 세션에서 이미 보여 준 장 삽화
  function gotoStage(id) {
    const s = STAGES[id];
    P.stageId = id; saveGame();
    hide('#title'); hide('#result'); hide('#menu'); hide('#camp');
    if (!s) { showTitle(); return; }
    if (s.art && !artShown.has(id)) {
      artShown.add(id);
      Story.play({ scenes: [{ img: `img/story/${s.art}.jpg`, audio: `img/story/${s.art}.mp3`, title: `${s.chapter ? s.chapter + ' — ' : ''}${s.title}`, text: STAGE_ART_TEXT[s.art] || '' }] }).then(() => gotoStage(id));
      return;
    }
    if (s.event) {
      G.map = null; $('#stageName').textContent = s.title; $('#turnInfo').textContent = '';
      showDialog(s.intro, () => {
        if (s.giveItem) giveItem(s.giveItem.hero, s.giveItem.item);
        for (const h of s.join || []) addHero(h);
        resolveNext(s);
      });
      return;
    }
    openCamp(s);
  }
  function resolveNext(s) {
    const n = s.next;
    if (!n) { saveGame(); showResult(true); return; }
    if (typeof n === 'string') { gotoStage(n); return; }
    $('#choiceText').textContent = n.text;
    const box = $('#choiceBtns'); box.innerHTML = '';
    n.options.forEach((o) => {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = o.label;
      b.onclick = () => { hide('#choice'); gotoStage(o.next); };
      box.appendChild(b);
    });
    show('#choice');
  }
  function giveItem(heroId, item) {
    const r = P.roster[heroId]; if (!r) return;
    if (r.items.length >= 8) { toast(`${HEROES[heroId].name}의 소지품이 가득 차 ${item}을(를) 놓쳤습니다`); return; }
    r.items.push(item); toast(`${HEROES[heroId].name}이(가) ${item} 획득!`);
  }

  // ---------- 진영 (출격 · 상점 · 장수) ----------
  const camp = { stage: null, tab: 'deploy', sel: [], pickCb: null };
  function openCamp(s) {
    camp.stage = s; camp.tab = 'deploy';
    const fixed = (s.deploy.fixed || []).filter((h) => P.roster[h]);
    camp.sel = fixed.slice();
    for (const id of P.order) if (camp.sel.length < s.deploy.max && !camp.sel.includes(id)) camp.sel.push(id);
    $('#campTitle').textContent = `${s.chapter} — ${s.title}`;
    G.map = null; $('#stageName').textContent = s.title; $('#turnInfo').textContent = '';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); $('#panelBody').innerHTML = ''; $('#panelBtns').innerHTML = '';
    renderCamp(); show('#camp');
  }
  function heroLine(id, extra = '') {
    const r = P.roster[id], h = HEROES[id];
    const u = { ...h, ...r, hero: id, morale: 100 }; const st = L.stats(u);
    return `<span class="nm">${h.name}</span><span class="ds">Lv${r.lv} ${CLASSES[r.cls].name} · 무${h.mu} 지${h.chi} 통${h.tong} · 공${st.atk} 방${st.def} 병력${st.maxhp}${extra}</span>`;
  }
  function renderCamp() {
    const s = camp.stage, body = $('#campBody');
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === camp.tab));
    $('#campGold').textContent = `금 ${P.gold}`;
    $('#btnSortie').classList.toggle('hidden', camp.tab !== 'deploy');
    if (camp.tab === 'deploy') {
      const fixed = s.deploy.fixed || [];
      let html = `<p class="sub">출격 ${camp.sel.length}/${s.deploy.max}명 · 터치해서 고르세요. 제한 ${s.turns}턴.</p><div class="list">`;
      for (const id of P.order) {
        const on = camp.sel.includes(id), lock = fixed.includes(id);
        html += `<div class="item ${on ? 'sel' : ''}" data-dep="${id}">${on ? '✅' : '⬜'} ${heroLine(id, lock ? ' · 필수' : '')}</div>`;
      }
      body.innerHTML = html + '</div>';
    } else if (camp.tab === 'shop') {
      const list = SHOP_BASIC.concat(s.shop || []);
      let html = `<p class="sub">아이템을 고르면 받을 장수를 묻습니다. 한 장수는 8개까지.</p><div class="list">`;
      for (const it of list) { const d = ITEMS[it]; html += `<div class="item ${P.gold < d.price ? 'off' : ''}" data-buy="${it}"><span class="nm">${it}</span><span class="ds">${d.desc}</span><span class="pr">금 ${d.price}</span></div>`; }
      body.innerHTML = html + '</div>';
    } else {
      let html = '<div class="list">';
      for (const id of P.order) {
        const r = P.roster[id];
        html += `<div class="item" style="flex-wrap:wrap">${heroLine(id)}<div style="width:100%;display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">`;
        if (!r.items.length) html += `<small class="sub">소지품 없음</small>`;
        for (let i = 0; i < r.items.length; i++) { const d = ITEMS[r.items[i]]; html += `<button class="btn gray" style="flex:0 0 auto;min-height:32px;font-size:12px" data-inv="${id}:${i}">${r.items[i]}${d.type === 'weapon' ? ' ⚔' : d.type === 'book' ? ' 📘' : d.type === 'horse' ? ' 🐎' : d.type === 'promo' || d.type === 'job' ? ' ⬆' : ''}</button>`; }
        html += '</div></div>';
      }
      body.innerHTML = html + '</div>';
    }
  }
  $('#campBody').addEventListener('click', (e) => {
    const dep = e.target.closest('[data-dep]'), buy = e.target.closest('[data-buy]'), inv = e.target.closest('[data-inv]');
    const s = camp.stage;
    if (dep) {
      const id = dep.dataset.dep;
      if ((s.deploy.fixed || []).includes(id)) { toast('이 장수는 반드시 출격합니다'); return; }
      if (camp.sel.includes(id)) camp.sel = camp.sel.filter((x) => x !== id);
      else if (camp.sel.length >= s.deploy.max) toast(`최대 ${s.deploy.max}명까지 출격할 수 있습니다`);
      else camp.sel.push(id);
      renderCamp();
    } else if (buy) {
      const it = buy.dataset.buy, d = ITEMS[it];
      if (P.gold < d.price) { toast('금이 부족합니다'); return; }
      pickHero(`${it}을(를) 누가 받을까요?`, (id) => {
        if (P.roster[id].items.length >= 8) { toast('소지품이 가득 찼습니다'); return; }
        P.gold -= d.price; P.roster[id].items.push(it); saveGame(); renderCamp(); toast(`${HEROES[id].name}: ${it} 구입`);
      });
    } else if (inv) {
      const [id, i] = inv.dataset.inv.split(':'); const r = P.roster[id]; const it = r.items[+i], d = ITEMS[it];
      const opts = [];
      if (d.type === 'promo') opts.push(['사용 (승급)', () => {
        if (r.cls !== d.from) { toast(`${CLASSES[d.from].name}만 쓸 수 있습니다`); return; }
        if (r.lv < d.lv) { toast(`Lv${d.lv} 이상이어야 합니다`); return; }
        r.cls = PROMOTE[r.cls]; r.items.splice(+i, 1); toast(`${HEROES[id].name}이(가) ${CLASSES[r.cls].name}(으)로 승급!`); saveGame(); renderCamp(); }]);
      if (d.type === 'job') opts.push(['사용 (전직)', () => {
        if (HEROES[id].lord) { toast('유비는 전직할 수 없습니다'); return; }
        r.cls = d.to; r.items.splice(+i, 1); toast(`${HEROES[id].name}이(가) ${CLASSES[r.cls].name}(으)로 전직!`); saveGame(); renderCamp(); }]);
      opts.push(['다른 장수에게 넘기기', () => pickHero(`${it}을(를) 누구에게?`, (to) => {
        if (to === id) return; if (P.roster[to].items.length >= 8) { toast('소지품이 가득 찼습니다'); return; }
        r.items.splice(+i, 1); P.roster[to].items.push(it); saveGame(); renderCamp(); })]);
      if (d.price) opts.push([`팔기 (금 ${Math.floor(d.price * 0.75)})`, () => { r.items.splice(+i, 1); P.gold += Math.floor(d.price * 0.75); saveGame(); renderCamp(); }]);
      pickList(`${it} — ${d.desc}`, opts);
    }
  });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { camp.tab = t.dataset.tab; renderCamp(); }));
  function pickHero(title, cb) {
    pickList(title, P.order.map((id) => [`${HEROES[id].name} (Lv${P.roster[id].lv} ${CLASSES[P.roster[id].cls].name} · 소지 ${P.roster[id].items.length}/8)`, () => cb(id)]));
  }
  function pickList(title, opts) {
    $('#pickTitle').textContent = title;
    const box = $('#pickList'); box.innerHTML = '';
    for (const [label, fn] of opts) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = () => { hide('#pick'); fn(); }; box.appendChild(b); }
    show('#pick');
  }

  // ---------- 전투 시작 ----------
  function loadStage(s, deploy) {
    G.stage = s; G.map = s.map.map((r) => r); G.units = []; nextId = 1; G.runId = (G.runId || 0) + 1;
    G.taken = new Set(); G.spawned = new Set();
    deploy.forEach((id, i) => { const u = makePlayerUnit(id); const [x, y] = s.start[i]; u.x = x; u.y = y; G.units.push(u); });
    for (const n of s.npcs || []) G.units.push(makeUnit(n, 'n'));
    for (const e of s.enemies) G.units.push(makeUnit(e, 'e'));
    for (const [flag, list] of Object.entries(s.extraIfFlag || {})) if (P.flags[flag]) for (const e of list) G.units.push(makeUnit(e, 'e'));
    Object.assign(G, { turn: 1, phase: 'player', state: 'idle', sel: null, reach: null, atkOpts: null, inspect: null, floats: [], fx: [], shot: null, acting: null, busy: true, weather: 'sun', winMsg: '' });
    G.deploy = deploy;
    $('#stageName').textContent = s.title;
    hide('#camp'); hide('#title'); hide('#result'); hide('#menu');
    resize(); updateTop(); updatePanel();
    showDialog(s.intro, () => startPlayerTurn(true));
  }

  const alive = (side) => G.units.filter((u) => u.alive && u.side === side);
  const allies = () => G.units.filter((u) => u.alive && u.side !== 'e');

  // ---------- 턴 진행 ----------
  function terrainHeal(side) {
    for (const u of alive(side)) {
      const t = TERRAIN[L.tileAt(G.map, u.x, u.y)];
      if (!t.heal) continue;
      const mh = L.maxHp(u);
      if (u.hp < mh) { const amt = Math.min(mh - u.hp, 150 + rnd(11) * 10); u.hp += amt; addFloat(u.x, u.y, `+${amt}`, '#8fe08f'); }
      if (t.heal === 'both' && u.morale < 100) u.morale = Math.min(100, u.morale + Math.floor(u.tong / 10) + 1 + rnd(5));
    }
    // 군악대 인접 아군 책략치 회복
    for (const b of alive(side)) {
      if (!CLASSES[b.cls].mpRegen) continue;
      for (const u of alive(side)) {
        if (u === b || L.dist(u.x, u.y, b.x, b.y) !== 1) continue;
        const mm = L.maxMp(u); if (u.mp < mm) { u.mp = Math.min(mm, u.mp + Math.floor(b.lv / 10) + 1); addFloat(u.x, u.y, '책략치↑', '#9ec1ff'); }
      }
    }
    for (const u of alive(side)) {
      if (u.confused && rnd(100) < (u.tong + u.morale) / 3) { u.confused = false; addFloat(u.x, u.y, '혼란 해제', '#fff'); }
      else if (!u.confused && u.morale < 30 && rnd(100) < 60) { u.confused = true; addFloat(u.x, u.y, '혼란!', '#f5c542'); }
    }
  }
  function spawnReinforcements() {
    for (const r of G.stage.reinforce || []) {
      const k = r.turn + r.side + r.units.map((u) => u.name).join();
      if (r.turn !== G.turn || G.spawned.has(k)) continue;
      G.spawned.add(k);
      for (const spec of r.units) {
        let { x, y } = spec;
        if (L.unitAt(G.units, x, y)) { const free = findFree(x, y); if (!free) continue; [x, y] = free; }
        const u = makeUnit({ ...spec, x, y }, r.side); G.units.push(u);
      }
      if (r.text) toast(r.text);
    }
  }
  function findFree(x, y) {
    for (let r = 1; r < 4; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      const nx = x + dx, ny = y + dy, ch = L.tileAt(G.map, nx, ny);
      if (ch && !TERRAIN[ch].block && !L.unitAt(G.units, nx, ny)) return [nx, ny];
    }
    return null;
  }
  function startPlayerTurn(first) {
    if (!first) G.turn++;
    if (G.turn > G.stage.turns) {
      if (G.stage.timeoutWin) { G.busy = true; G.winMsg = '시간 초과 — 적군 철수'; showDialog(G.stage.outro, () => stageClear(0)); }
      else showResult(false, `제한 턴(${G.stage.turns}턴)을 넘겼습니다.`);
      return;
    }
    const w = rnd(100); G.weather = w < 60 ? 'sun' : w < 85 ? 'cloud' : 'rain';
    G.phase = 'player'; G.acting = null; G.busy = false; G.state = 'idle';
    for (const u of alive('p')) u.acted = false;
    spawnReinforcements();
    terrainHeal('p');
    updateTop(); updatePanel();
    if (G.turn === 1 && !first) return;
  }
  async function endPlayerTurn() {
    if (G.busy || G.phase !== 'player') return;
    G.busy = true; deselect(); hideCmdMenu();
    // NPC
    const runId = G.runId;
    const stale = () => G.runId !== runId || !G.map;
    if (alive('n').length) {
      G.phase = 'npc'; updateTop(); updatePanel(); terrainHeal('n'); await sleep(250);
      for (const n of alive('n')) { if (stale()) return; if (!n.alive) continue; if (await runAi(n)) return; }
    }
    if (stale()) return;
    G.phase = 'enemy'; updateTop(); updatePanel();
    terrainHeal('e'); await sleep(300);
    try { for (const e of alive('e')) { if (stale()) return; if (!e.alive) continue; if (await runAi(e)) return; } }
    catch (err) { console.error(err); if (stale()) return; toast('적 턴 처리 중 오류 — 아군 턴으로 넘어갑니다'); }
    if (stale()) return;
    G.acting = null;
    startPlayerTurn(false);
  }
  // 한 부대의 AI 행동. 전투 종료 시 true
  async function runAi(e) {
    if (e.confused) { addFloat(e.x, e.y, '혼란…', '#f5c542'); await sleep(150); return false; }
    const plan = L.planUnit(G.map, G.units, e, G.weather);
    if (plan.type === 'stay') return false;
    G.acting = e; scrollTo(e); await sleep(220);
    if (plan.reach && (plan.x !== e.x || plan.y !== e.y)) await moveUnit(e, plan.x, plan.y, plan.reach);
    if (plan.type === 'attack') { await attack(e, plan.target); if (checkEnd()) { G.acting = null; return true; } }
    else if (plan.type === 'tactic') { await castTactic(e, plan.name, plan.cell, null); if (checkEnd()) { G.acting = null; return true; } }
    await sleep(120);
    return false;
  }

  // ---------- 선택 / 이동 ----------
  function select(u) {
    G.sel = u; G.origin = { x: u.x, y: u.y }; G.inspect = null;
    G.reach = L.computeReach(G.map, G.units, u);
    G.atkOpts = L.attackOptions(G.map, G.units, u, G.reach);
    G.moveTargets = L.targetsFrom(G.units, u, u.x, u.y);
    G.state = 'selected'; updatePanel(); showCmdMenu();
  }
  function deselect() {
    G.sel = null; G.reach = null; G.atkOpts = null; G.moveTargets = []; G.inspect = null; G.tacName = null; G.tacItem = null; G.tacCells = null;
    G.state = 'idle'; updatePanel(); hideCmdMenu();
  }
  // ---------- 명령 메뉴 (원작식 팝업) ----------
  function showCmdMenu() {
    const u = G.sel, m = $('#cmdMenu'); if (!u) return;
    const canAtk = G.state === 'moved' ? G.moveTargets.length > 0 : G.atkOpts.size > 0;
    m.innerHTML = `${G.state === 'selected' ? '<button data-act="moveMode">이동</button>' : ''}<button data-act="attackMode" ${canAtk ? '' : 'disabled'}>공격</button><button data-act="tactics">책략</button><button data-act="items">도구</button><button data-act="wait">대기</button><button data-act="cancel">${G.state === 'moved' ? '취소' : '해제'}</button>`;
    m.classList.remove('hidden');
    const mw = m.offsetWidth || 100, mh = m.offsetHeight || 220;
    // 가리면 안 되는 칸: 이동 가능 칸 · 공격 대상 · 자기 자신
    const avoid = [{ x: u.x, y: u.y }];
    if (G.state === 'selected' && G.reach) { for (const v of G.reach.values()) if (!v.blocked) avoid.push(v); for (const id of G.atkOpts.keys()) { const t = G.units.find((z) => z.id === id); if (t) avoid.push(t); } }
    else if (G.state === 'moved') for (const t of G.moveTargets) avoid.push(t);
    const ox = canvas.offsetLeft, oy = canvas.offsetTop, maxX = Math.max(0, wrap.scrollWidth - mw), maxY = Math.max(0, wrap.scrollHeight - mh);
    const cands = [
      [ox + (u.x + 1) * TS + 4, oy + u.y * TS - 10],            // 오른쪽
      [ox + u.x * TS - mw - 4, oy + u.y * TS - 10],             // 왼쪽
      [ox + u.x * TS - mw / 2 + TS / 2, oy + (u.y + 1) * TS + 4], // 아래
      [ox + u.x * TS - mw / 2 + TS / 2, oy + u.y * TS - mh - 4], // 위
    ];
    let best = null, bestScore = Infinity;
    for (const [cx, cy] of cands) {
      const px = Math.max(0, Math.min(cx, maxX)), py = Math.max(0, Math.min(cy, maxY));
      let score = (Math.abs(px - cx) + Math.abs(py - cy)) * 0.01;   // 밀려난 만큼 약한 감점
      for (const c of avoid) { const ax = ox + c.x * TS, ay = oy + c.y * TS; if (ax < px + mw && ax + TS > px && ay < py + mh && ay + TS > py) score += c === avoid[0] ? 50 : 1; }
      if (score < bestScore) { bestScore = score; best = [px, py]; }
    }
    m.style.left = best[0] + 'px'; m.style.top = best[1] + 'px';
  }
  function hideCmdMenu() { $('#cmdMenu').classList.add('hidden'); }
  async function moveUnit(u, x, y, reach) {
    const path = L.pathTo(reach, x, y);
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i];
      const t0 = performance.now(), dur = 90;
      await new Promise((res) => {
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / dur);
          u.px = ax + (bx - ax) * t; u.py = ay + (by - ay) * t;
          if (t < 1) requestAnimationFrame(step); else res();
        };
        step();
      });
    }
    u.px = u.py = undefined; u.x = x; u.y = y;
  }
  // 이동 후 이벤트: 보물고 · 도달 승리 · 일기토. 전투 종료면 true
  async function afterPlayerMove(u) {
    const k = L.key(u.x, u.y), ch = L.tileAt(G.map, u.x, u.y);
    const chest = (G.stage.chests || {})[k];
    if (TERRAIN[ch].chest && chest && !G.taken.has(k) && chest !== 'gold:0') {
      G.taken.add(k);
      if (chest.startsWith('gold:')) { const g = +chest.slice(5); P.gold += g; toast(`금 ${g} 획득!`); addFloat(u.x, u.y, `금 +${g}`, '#ffd54f'); }
      else if (u.items.length >= 8) toast(`${chest} — 소지품이 가득 차 가져갈 수 없습니다`);
      else { u.items.push(chest); toast(`${u.name}: ${chest} 획득!`); addFloat(u.x, u.y, chest, '#ffd54f'); }
    }
    for (const w of G.stage.win) {
      if (w.type === 'reach' && u.hero === w.hero && w.tiles.some(([x, y]) => x === u.x && y === u.y)) {
        G.busy = true; G.winMsg = w.text;
        if (w.xp) for (const a of alive('p')) gainXp(a, w.xp, true);
        await sleep(500); showDialog(G.stage.outro, () => stageClear(w.gold ?? G.stage.gold)); return true;
      }
    }
    return await checkDuel(u);
  }
  async function checkDuel(u) {
    for (const d of G.stage.duels || []) {
      if (u.hero !== d.hero || d.done) continue;
      const foe = G.units.find((e) => e.alive && e.side === 'e' && e.name === d.enemy);
      if (!foe || L.dist(u.x, u.y, foe.x, foe.y) !== 1) continue;
      d.done = true; G.busy = true;
      await new Promise((res) => showDialog(d.lines, res));
      levelUp(u); addFloat(u.x, u.y, 'LEVEL UP!', '#ffd54f');
      foe.alive = false; addFloat(foe.x, foe.y, d.retreat ? '퇴각!' : '격파!', '#ffd54f');
      u.acted = true;
      if (checkEnd()) return true;
      G.busy = false; deselect();
      return true;
    }
    return false;
  }

  // ---------- 공격 ----------
  function applyHit(a, d, dmg, counter) {
    const before = d.hp;
    d.hp = Math.max(0, d.hp - dmg);
    d.morale = Math.max(0, d.morale - L.moraleLoss(dmg, d));
    let killed = d.hp <= 0 || d.morale <= 0;
    if (killed) { d.alive = false; }
    return { att: a, def: d, dmg, hpBefore: before, hpAfter: d.hp, killed, counter, ranged: L.dist(a.x, a.y, d.x, d.y) > 1 || CLASSES[a.cls].ranged };
  }
  async function attack(a, d) {
    if (d.side === 'e' && d.ai === 'passive') d.ai = 'active';
    const strikes = [applyHit(a, d, L.calcDmg(G.map, a, d), false)];
    if (d.alive && Math.random() < L.counterChance(d, a)) strikes.push(applyHit(d, a, L.calcDmg(G.map, d, a, { counter: true }), true));
    await playStrikes(a, d, strikes);
    for (const s of strikes) {
      if (s.killed) { addFloat(s.def.x, s.def.y, s.def.side === 'e' ? '격파!' : '퇴각…', '#ffd54f'); }
      if (s.att.side === 'p') gainXp(s.att, L.xpForHit(s.att, s.def) + (s.killed ? L.xpForKill(s.att, s.def) : 0));
    }
    updatePanel();
  }
  async function playStrikes(a, d, strikes) {
    if (settings.battleAnim) {
      scrollTo(d);
      await BattleScene.play({ att: a, def: d, strikes, terrain: L.tileAt(G.map, d.x, d.y), weather: G.weather, IMG, CLASSES });
      return;
    }
    for (const s of strikes) {
      a === s.att ? await bump(a, d) : await bump(d, a);
      addFx(s.def.x, s.def.y, s.magic || 'hit');
      addFloat(s.def.x, s.def.y, `-${s.dmg}`, s.def.side === 'e' ? '#fff' : '#ff8a80');
      await sleep(350);
    }
  }
  async function bump(a, d) {
    const ranged = L.dist(a.x, a.y, d.x, d.y) > 1;
    a.anim = { dx: Math.sign(d.x - a.x), dy: Math.sign(d.y - a.y), t0: performance.now(), dur: 260 };
    if (ranged) G.shot = { a, d, t0: performance.now(), dur: 300 };
    await sleep(270); a.anim = null; G.shot = null;
  }

  // ---------- 책략 · 도구 ----------
  async function castTactic(u, name, cell, item) {
    const tac = TACTICS[name];
    if (item) { const i = u.items.indexOf(item); if (i >= 0) u.items.splice(i, 1); }
    else u.mp -= tac.mp;
    const results = L.tacticResolve(G.map, u, name, cell.units, G.weather);
    const hostile = L.isHostileTac(tac);
    if (hostile && settings.battleAnim && L.isAttackTac(tac)) {
      const first = results[0];
      const strikes = [{ att: u, def: first.target, dmg: first.ok ? first.dmg : 0, hpBefore: first.target.hp, hpAfter: Math.max(0, first.target.hp - (first.ok ? first.dmg : 0)), killed: first.ok && first.dmg >= first.target.hp, ranged: true, magic: tac.type, miss: !first.ok, name }];
      scrollTo(first.target);
      await BattleScene.play({ att: u, def: first.target, strikes, terrain: L.tileAt(G.map, first.target.x, first.target.y), weather: G.weather, IMG, CLASSES });
    } else { G.shot = { a: u, d: cell, t0: performance.now(), dur: 400, magic: tac.type }; await sleep(380); G.shot = null; for (const r of results) addFx(r.target.x, r.target.y, r.ok ? tac.type : 'miss'); await sleep(300); }
    let xp = 0;
    for (const r of results) {
      const t = r.target;
      if (!r.ok) { addFloat(t.x, t.y, '실패', '#aaa'); continue; }
      if (r.dmg) {
        t.hp = Math.max(0, t.hp - r.dmg); t.morale = Math.max(0, t.morale - L.moraleLoss(r.dmg, t));
        addFloat(t.x, t.y, `-${r.dmg}`, t.side === 'e' ? '#fff' : '#ff8a80');
        if (t.side === 'e' && t.ai === 'passive') t.ai = 'active';
        if (t.hp <= 0 || t.morale <= 0) { t.alive = false; addFloat(t.x, t.y, t.side === 'e' ? '격파!' : '퇴각…', '#ffd54f'); if (u.side === 'p') xp += L.xpForKill(u, t); }
        if (u.side === 'p') xp += L.xpForHit(u, t);
      }
      if (r.heal) { const mh = L.maxHp(t), amt = Math.min(mh - t.hp, r.heal); t.hp += amt; addFx(t.x, t.y, 'heal'); addFloat(t.x, t.y, `+${amt}`, '#8fe08f'); if (u.side === 'p') xp += 12; }
      if (r.morale) { t.morale = Math.max(0, Math.min(100, t.morale + r.morale)); addFloat(t.x, t.y, `사기 ${r.morale > 0 ? '+' : ''}${r.morale}`, r.morale > 0 ? '#f5c542' : '#ff8a80'); if (u.side === 'p' && !r.dmg && !r.heal) xp += 8;
        if (t.morale <= 0) { t.alive = false; addFloat(t.x, t.y, t.side === 'e' ? '격파!' : '퇴각…', '#ffd54f'); if (u.side === 'p') xp += L.xpForKill(u, t); } }
      if (r.confuse) { t.confused = true; addFx(t.x, t.y, 'confuse'); addFloat(t.x, t.y, '혼란!', '#f5c542'); if (u.side === 'p') xp += 8; }
    }
    if (xp) gainXp(u, xp);
    await sleep(500); updatePanel();
  }
  async function useBomb(u, item, target) {
    const i = u.items.indexOf(item); if (i >= 0) u.items.splice(i, 1);
    const strikes = [applyHit(u, target, ITEMS[item].bomb, false)];
    strikes[0].magic = 'fire'; strikes[0].ranged = true;
    await playStrikes(u, target, strikes);
    if (strikes[0].killed) addFloat(target.x, target.y, '격파!', '#ffd54f');
    gainXp(u, L.xpForHit(u, target) + (strikes[0].killed ? L.xpForKill(u, target) : 0));
  }

  // ---------- 경험치 ----------
  function levelUp(u) {
    if (u.lv >= 99) return;
    u.lv++; u.hp = Math.min(L.maxHp(u), u.hp + CLASSES[u.cls].hpLv);
    toast(`${u.name} 레벨 ${u.lv}!`);
  }
  function gainXp(u, n, quiet) {
    if (u.side !== 'p') return;
    u.xp += n; if (!quiet) toast(`${u.name} +${n} EXP`);
    while (u.xp >= 100 && u.lv < 99) { u.xp -= 100; levelUp(u); addFx(u.x, u.y, 'levelup'); addFloat(u.x, u.y, 'LEVEL UP!', '#ffd54f'); }
    if (u.lv >= 99) u.xp = Math.min(u.xp, 99);
  }

  // ---------- 행동 종료 · 승패 ----------
  function finishAction(u) {
    u.acted = true; deselect();
    if (checkEnd()) return;
    if (alive('p').every((p) => p.acted)) setTimeout(endPlayerTurn, 400);
  }
  function checkEnd() {
    const liu = G.units.find((u) => u.hero === 'liubei');
    if (!liu.alive) { showResult(false, '유비가 퇴각했습니다.'); return true; }
    for (const w of G.stage.win) {
      let ok = false;
      if (w.type === 'boss') ok = !G.units.some((u) => u.side === 'e' && u.boss && u.alive);
      else if (w.type === 'all') ok = !alive('e').length;
      if (ok) { G.busy = true; G.winMsg = w.type === 'boss' ? '적 총대장 격파' : '적 전멸'; showDialog(G.stage.outro, () => stageClear(w.gold ?? G.stage.gold)); return true; }
    }
    return false;
  }
  function stageClear(gold) {
    const s = G.stage;
    for (const u of G.units) if (u.side === 'p') P.roster[u.hero] = { lv: u.lv, xp: u.xp, cls: u.cls, items: u.items };
    P.gold = Math.min(10000, P.gold + (gold || 0));
    if (s.flag) P.flags[s.flag] = true;
    for (const h of s.join || []) addHero(h);
    G.map = null;
    const joined = (s.join || []).map((h) => HEROES[h].name).join(', ');
    toast(`${G.winMsg} · 금 +${gold || 0}${joined ? ' · 가입: ' + joined : ''}`);
    saveGame(); resolveNext(s);
  }

  // ---------- 터치 ----------
  const run = async (fn) => { if (G.busy) return; G.busy = true; try { await fn(); } catch (e) { console.error(e); toast('오류가 나서 행동을 취소했습니다'); } finally { if (G.phase === 'player' && !G.dialog && G.map) G.busy = false; } };
  // 안전장치: 어떤 이유로든 busy가 오래 풀리지 않으면(대화창·전투 장면·결과창이 없는데 8초 이상) 강제로 푼다
  let busyAt = 0, realBusy = false;
  Object.defineProperty(G, 'busy', { get: () => realBusy, set: (v) => { realBusy = !!v; if (v) busyAt = Date.now(); } });
  function stuckBusy() {
    if (!G.busy || G.phase !== 'player' || G.dialog || !G.map) return false;
    if (!$('#battle').classList.contains('hidden') || !$('#result').classList.contains('hidden') || !$('#camp').classList.contains('hidden') || !$('#choice').classList.contains('hidden')) return false;
    if (Date.now() - busyAt < 8000) return false;
    G.busy = false; G.acting = null; return true;
  }
  let dialogClosedAt = 0;
  canvas.addEventListener('click', (e) => {
    if (G.busy && stuckBusy()) updatePanel();
    if (G.busy || G.phase !== 'player' || G.dialog || !G.map) return;
    if (Date.now() - dialogClosedAt < 400) return;   // 대화창을 닫은 터치가 지도까지 전달되는 것 방지
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / TS), y = Math.floor((e.clientY - r.top) / TS);
    if (!L.tileAt(G.map, x, y)) return;
    onTap(x, y);
  });
  function onTap(x, y) {
    const u = L.unitAt(G.units, x, y), ch = L.tileAt(G.map, x, y), s = G.sel;
    if (G.state === 'idle') {
      if (u && u.side === 'p' && !u.acted && !u.confused) select(u);
      else { G.inspect = u || { terrain: ch, x, y }; updatePanel(); }
      return;
    }
    if (G.state === 'atkTarget') {
      const ok = u && u.side === 'e' && (G.preState === 'moved' ? L.inRange(s, s.x, s.y, u) : G.atkOpts.has(u.id));
      if (!ok) { toast('빨간 테두리의 적을 터치하세요'); return; }
      run(async () => {
        if (G.preState !== 'moved') { const spot = L.bestSpot(G.atkOpts.get(u.id), s); if (spot.x !== s.x || spot.y !== s.y) await moveUnit(s, spot.x, spot.y, G.reach); if (await afterPlayerMove(s)) return; }
        await attack(s, u); finishAction(s);
      });
      return;
    }
    if (G.state === 'tacTarget') {
      const cell = G.tacCells.find((c) => c.x === x && c.y === y);
      if (!cell) { toast('노란 칸을 터치하세요'); return; }
      run(async () => {
        const name = G.tacName, item = G.tacItem;
        if (item && ITEMS[item].bomb) await useBomb(s, item, cell.units[0]);
        else await castTactic(s, name, cell, item);
        finishAction(s);
      });
      return;
    }
    if (G.state === 'selected') {
      if (u === s) { G.inspect = null; updatePanel(); showCmdMenu(); return; }
      if (u && u.side === 'e' && G.atkOpts.has(u.id)) {
        const spot = L.bestSpot(G.atkOpts.get(u.id), s);
        run(async () => {
          if (spot.x !== s.x || spot.y !== s.y) await moveUnit(s, spot.x, spot.y, G.reach);
          if (await afterPlayerMove(s)) return;
          await attack(s, u); finishAction(s);
        });
        return;
      }
      if (u && u.side === 'p' && !u.acted && !u.confused) { select(u); return; }
      if (u) { G.inspect = u; updatePanel(); return; }
      const v = G.reach.get(L.key(x, y));
      if (v && !v.blocked) {
        run(async () => {
          await moveUnit(s, x, y, G.reach);
          G.state = 'moved'; G.inspect = null;
          G.moveTargets = L.targetsFrom(G.units, s, s.x, s.y); updatePanel();
          if (!(await afterPlayerMove(s)) && G.state === 'moved') showCmdMenu();
        });
        return;
      }
      G.inspect = { terrain: ch, x, y }; updatePanel();
      return;
    }
    if (G.state === 'moved') {
      if (u && u.side === 'e' && L.inRange(s, s.x, s.y, u)) run(async () => { await attack(s, u); finishAction(s); });
      else if (u) { G.inspect = u; updatePanel(); }
      else { G.inspect = { terrain: ch, x, y }; updatePanel(); }
    }
  }
  function cancelMove() {
    const s = G.sel;
    if (['tactic', 'item', 'tacTarget', 'atkTarget'].includes(G.state)) { G.state = G.origin.x === s.x && G.origin.y === s.y ? 'selected' : 'moved'; G.tacName = null; G.tacItem = null; G.tacCells = null; updatePanel(); showCmdMenu(); return; }
    if (G.state === 'moved') { s.x = G.origin.x; s.y = G.origin.y; select(s); return; }
    deselect();
  }
  function openTactics() { G.preState = G.state; G.state = 'tactic'; G.inspect = null; hideCmdMenu(); updatePanel(); }
  function openItems() { G.preState = G.state; G.state = 'item'; G.inspect = null; hideCmdMenu(); updatePanel(); }
  function openAttack() {
    const n = G.state === 'moved' ? G.moveTargets.length : (G.atkOpts ? G.atkOpts.size : 0);
    if (!n) { toast('공격할 수 있는 적이 없습니다'); return; }
    G.preState = G.state; G.state = 'atkTarget'; G.inspect = null; hideCmdMenu(); updatePanel();
  }
  function chooseTactic(name, item) {
    const s = G.sel;
    if (item && ITEMS[item].bomb) {
      const cells = L.targetsFrom(G.units, { ...s, cls: 'inf2' }, s.x, s.y).filter((t) => L.dist(s.x, s.y, t.x, t.y) <= 1).map((t) => ({ x: t.x, y: t.y, units: [t] }));
      if (!cells.length) { toast('인접한 적이 없습니다'); return; }
      G.tacCells = cells;
    } else {
      const cells = L.tacticTargets(G.map, G.units, s, name, G.weather);
      if (!cells.length) { toast(TACTICS[name] && L.isAttackTac(TACTICS[name]) ? '범위 안에 맞는 지형의 적이 없습니다' + (G.weather === 'rain' && TACTICS[name].type === 'fire' ? ' (비가 와서 화계 불가)' : '') : '범위 안에 대상이 없습니다'); return; }
      G.tacCells = cells;
    }
    G.tacName = name; G.tacItem = item || null; G.state = 'tacTarget'; hideCmdMenu(); updatePanel();
  }

  // ---------- 버튼 ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'login' || act === 'register') doAuth(act);
    else if (act === 'guest') { ACC.guest = true; ACC.id = ACC.token = null; renderTitle(); }
    else if (act === 'logout') logout();
    else if (act === 'slotLoad') slotLoad(+a.dataset.slot);
    else if (act === 'slotNew') slotNew(+a.dataset.slot, !a.closest('.slot').querySelector('[data-act="slotLoad"]') ? false : true);
    else if (act === 'slotDel') slotDel(+a.dataset.slot);
    else if (act === 'continue') { hide('#result'); gotoStage(P.stageId || FIRST_STAGE); }
    else if (act === 'help') show('#help');
    else if (act === 'closeHelp') hide('#help');
    else if (act === 'closePick') hide('#pick');
    else if (act === 'menu') show('#menu');
    else if (act === 'closeMenu') hide('#menu');
    else if (act === 'zoom') { settings.zoom = !settings.zoom; saveSettings(); resize(); if (G.sel) { scrollTo(G.sel); if (G.state === 'selected' || G.state === 'moved') showCmdMenu(); } }
    else if (act === 'toggleAnim') { settings.battleAnim = !settings.battleAnim; saveSettings(); updateAnimBtn(); }
    else if (act === 'restart') { hide('#menu'); hide('#result'); if (G.stage) { hide('#dialog'); G.dialog = null; loadStage(G.stage, G.deploy); } else if (P.stageId) gotoStage(P.stageId); }
    else if (act === 'home') { hide('#menu'); hide('#result'); hide('#camp'); hide('#choice'); G.map = null; G.dialog = null; hide('#dialog'); showTitle(); }
    else if (act === 'sortie') { hide('#camp'); loadStage(camp.stage, camp.sel.slice()); }
    else if (G.busy && stuckBusy()) { toast('멈춘 동작을 풀었습니다'); deselect(); return; }
    else if (G.busy || G.phase !== 'player') return;
    else if (act === 'endturn') endPlayerTurn();
    else if (act === 'wait') finishAction(G.sel);
    else if (act === 'cancel') cancelMove();
    else if (act === 'tactics') openTactics();
    else if (act === 'attackMode') openAttack();
    else if (act === 'moveMode') { hideCmdMenu(); G.inspect = null; updatePanel(); toast('파란 칸을 터치하면 이동합니다'); }
    else if (act === 'items') openItems();
    else if (act === 'tac') chooseTactic(a.dataset.name, null);
    else if (act === 'useitem') { const it = a.dataset.name; chooseTactic(ITEMS[it].tac, it); }
  });

  // ---------- 패널 / 상단 ----------
  function updateTop() {
    if (!G.map) return;
    const ph = { player: '아군', npc: '우군', enemy: '적군' }[G.phase];
    $('#turnInfo').textContent = `${G.turn}/${G.stage.turns}턴 ${ph} · ${WEATHER[G.weather]} · 적 ${alive('e').length}`;
  }
  function relationText(a, d) {
    const m = L.classMult(a, d);
    if (m < 1) return `<span class="adv">상성 유리</span>`;
    if (m > 1) return `<span class="dis">상성 불리</span>`;
    return '';
  }
  function faceHtml(u) {
    const src = u.portrait ? `img/${u.portrait}.png` : `img/${CLASSES[u.cls].sprite}.png`;
    return `<span class="face ${u.side}"><img src="${src}" alt="" onerror="this.remove()"><b>${u.ch}</b></span>`;
  }
  function bar(v, m, cls) { const pct = Math.max(0, Math.min(100, Math.round(v / m * 100))); return `<div class="hpbar"><i class="${cls}${pct <= 30 && !cls ? ' low' : ''}" style="width:${pct}%"></i></div>`; }
  function unitCard(u) {
    const t = TERRAIN[L.tileAt(G.map, u.x, u.y)], st = L.stats(u), c = CLASSES[u.cls];
    let extra = '';
    if (u.side === 'p') extra = `이동 ${st.mov} · 사거리 ${{ a4: '인접4', a8: '인접8', bow: '대각·2칸', xbow: '2칸 이내', cata: '3칸 이내' }[c.rng]}${u.confused ? ' · <span class="dis">혼란</span>' : ''}`;
    else if (G.sel && u.side === 'e') {
      const d1 = L.calcDmg(G.map, G.sel, u), d2 = L.calcDmg(G.map, u, G.sel);
      extra = `${G.sel.name}→${u.name} 예상 피해 <b>${d1}</b> ${relationText(G.sel, u)} · 반대로 ${d2}${c.counter ? ' · 반격 가능' : ''}`;
    } else extra = `${{ active: '적극적으로 공격', passive: '가까이 가면 움직임', fixed: '자리를 지킴' }[u.ai] || ''}${u.confused ? ' · 혼란' : ''}`;
    return `<div class="card">${faceHtml(u)}
      <div class="info"><div class="nm">${u.name}<small>${c.name} Lv${u.lv}${u.boss ? ' 총대장' : ''}</small></div>
        ${bar(u.hp, st.maxhp, '')}
        <dl class="grid"><dt>병력</dt><dd>${u.hp}/${st.maxhp}</dd><dt>사기</dt><dd>${u.morale}</dd>
        <dt>책략치</dt><dd>${u.mp}/${st.maxmp}</dd><dt>경험</dt><dd>${u.side === 'p' ? u.xp : '-'}</dd>
        <dt>공격</dt><dd>${st.atk}</dd><dt>방어</dt><dd>${st.def}</dd>
        <dt>무지통</dt><dd>${u.mu}·${u.chi}·${u.tong}</dd><dt>지형</dt><dd>${t.name} ${t.def}%</dd></dl>
      </div></div><div class="sub">${extra}</div>`;
  }
  function updatePanel() {
    if (!G.map) return;
    let html = '', btns = '';
    const s = G.sel, ins = G.inspect && G.inspect.name ? G.inspect : null;
    if (G.state === 'tactic') {
      const list = L.learned(s);
      html = `<div class="sub">${s.name}의 책략 (책략치 ${s.mp}) · 날씨 ${WEATHER[G.weather]}</div><div class="list">`;
      if (!list.length) html += `<div class="hint">아직 익힌 책략이 없습니다</div>`;
      for (const n of list) { const t = TACTICS[n]; const off = s.mp < t.mp; html += `<div class="item ${off ? 'off' : ''}" ${off ? '' : `data-act="tac" data-name="${n}"`}><span class="nm">${n}</span><span class="ds">${TACTIC_TYPE_NAME[t.type]} · 범위 ${{ s: '소', m: '중', l: '대' }[t.rng]}${t.cross ? ' 십자' : ''}${t.pow ? ' · 위력 ' + t.pow : ''}</span><span class="pr">${t.mp}</span></div>`; }
      html += '</div>';
      btns = `<button class="btn gray" data-act="cancel">뒤로</button>`;
    } else if (G.state === 'item') {
      const list = s.items.filter((i) => ITEMS[i].type === 'use');
      html = `<div class="sub">${s.name}의 도구</div><div class="list">`;
      if (!list.length) html += `<div class="hint">쓸 수 있는 도구가 없습니다 (진영 상점에서 구입)</div>`;
      for (const n of list) { const d = ITEMS[n]; html += `<div class="item" data-act="useitem" data-name="${n}"><span class="nm">${n}</span><span class="ds">${d.desc}</span></div>`; }
      html += '</div>';
      btns = `<button class="btn gray" data-act="cancel">뒤로</button>`;
    } else if (G.state === 'tacTarget') {
      html = `<div class="hint"><b>${G.tacItem || G.tacName}</b> — 노란 칸(대상)을 터치하세요.${TACTICS[G.tacName] && TACTICS[G.tacName].cross ? ' 십자 모양으로 퍼집니다.' : ''}</div>`;
      if (ins) html = unitCard(ins) + html;
      btns = `<button class="btn gray" data-act="cancel">뒤로</button>`;
    } else {
      if (ins) html = unitCard(ins);
      else if (s) html = unitCard(s);
      else if (G.inspect && G.inspect.terrain) {
        const t = TERRAIN[G.inspect.terrain];
        html = `<div class="hint"><b>${t.name}</b> — 방어 ${t.def}%${t.heal ? ' · 턴마다 회복' : ''}${t.block ? ' · 진입 불가' : ''}${t.mountain ? ' · 산적·무도가·이민족·맹수사만 진입' : ''}${t.noCav ? ' · 기병 진입 불가' : ''}${t.tactic ? ' · 책략: ' + t.tactic.split(' ').map((k) => TACTIC_TYPE_NAME[k]).join('/') : ' · 책략 불가'}<br><small>장수를 터치하세요</small></div>`;
      } else if (G.phase !== 'player') html = `<div class="hint">${G.phase === 'npc' ? '우군' : '적군'}이 움직이는 중…</div>`;
      else html = `<div class="hint">장수를 터치하세요.<br><small>파란 칸: 이동 · 빨간 적: 공격 · 승리: ${G.stage.win.map((w) => w.type === 'boss' ? '총대장 격파' : w.type === 'all' ? '적 전멸' : w.text).join(' 또는 ')}</small></div>`;
      if (G.phase === 'player') {
        if (G.state === 'atkTarget') { html = `<div class="hint"><b>공격</b> — 빨간 테두리의 적을 터치하세요.</div>` + (ins ? unitCard(ins) : ''); btns = `<button class="btn gray" data-act="cancel">뒤로</button>`; }
        else if (G.state === 'selected' || G.state === 'moved') btns = '';
        else btns = `<button class="btn gold" data-act="endturn">턴 종료</button>`;
      }
    }
    $('#panelBody').innerHTML = html; $('#panelBtns').innerHTML = btns;
  }
  function toast(msg) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  // ---------- 대화 / 결과 / 타이틀 ----------
  function showDialog(lines, done) {
    if (!lines || !lines.length) { done && done(); return; }
    G.dialog = { lines, i: 0, done }; renderDialog(); show('#dialog');
  }
  function renderDialog() {
    const l = G.dialog.lines[G.dialog.i];
    $('#dlgName').textContent = l.who; $('#dlgText').textContent = l.text;
    const face = $('#dlgFace'), pic = PORTRAITS[l.who];
    if (pic) { face.src = `img/${pic}.png`; face.classList.remove('hidden'); } else face.classList.add('hidden');
    $('#dlgMore').textContent = G.dialog.i === G.dialog.lines.length - 1 ? '▼ 터치해서 닫기' : '▼ 터치해서 계속';
  }
  $('#dialog').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const d = G.dialog; if (!d) return;
    d.i++;
    if (d.i >= d.lines.length) { G.dialog = null; hide('#dialog'); dialogClosedAt = Date.now(); d.done && d.done(); } else renderDialog();
  });
  function showResult(win, why) {
    G.busy = true;
    $('#resultTitle').textContent = win ? '1장 2막 클리어!' : '패배…';
    $('#resultText').textContent = win
      ? '여기까지 플레이해 주셔서 고맙습니다. 이어하기를 누르면 키운 장수들과 함께 서장부터 다시 시작합니다.'
      : (why || '') + ' 지형·상성·책략을 이용해 다시 도전해 보세요.';
    $('#resultBtn').textContent = win ? '서장부터 다시 (강해진 장수들로)' : '다시 도전';
    $('#resultBtn').dataset.act = win ? 'continue' : 'restart';
    if (win) { P.stageId = FIRST_STAGE; saveGame(); }
    show('#result');
  }
  function showTitle() {
    $('#stageName').textContent = '삼국지 영걸전'; $('#turnInfo').textContent = '';
    $('#panelBody').innerHTML = ''; $('#panelBtns').innerHTML = '';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    show('#title'); renderTitle();
  }
  // ---------- 계정 · 슬롯 화면 ----------
  function loginMsg(t, ok) { const m = $('#loginMsg'); m.textContent = t || ''; m.classList.toggle('ok', !!ok); }
  async function renderTitle() {
    const logged = !!(ACC.id && ACC.token) || ACC.guest;
    $('#loginBox').classList.toggle('hidden', logged); $('#slotBox').classList.toggle('hidden', !logged);
    if (!logged) return;
    $('#slotUser').textContent = ACC.guest ? '이 기기 저장 (로그인 안 함)' : `${ACC.id}님의 저장 슬롯`;
    const list = $('#slotList'); list.innerHTML = '<div class="slot"><div class="d">불러오는 중…</div></div>';
    let slots = [];
    if (ACC.guest) slots = Array.from({ length: SLOTS }, (_, i) => { const l = localSlot(i); return l ? { slot: i, meta: l.meta } : null; });
    else {
      const r = await api('saves', { op: 'list' });
      if (r.error) { if (/로그인/.test(r.error)) { ACC.id = ACC.token = null; saveAccount(); renderTitle(); loginMsg(r.error); return; }
        slots = Array.from({ length: SLOTS }, (_, i) => { const l = localSlot(i); return l ? { slot: i, meta: l.meta, local: true } : null; }); toast('서버 연결 실패 — 이 기기의 사본을 표시'); }
      else slots = r.slots;
      // 서버 반영이 1~2초 늦을 수 있으니 이 기기의 사본이 더 새것이면 그걸 보여 준다
      for (let i = 0; i < SLOTS; i++) { const l = localSlot(i); if (l && l.meta && (!slots[i] || (l.meta.updated || 0) > (slots[i].meta.updated || 0))) slots[i] = { slot: i, meta: l.meta }; }
    }
    list.innerHTML = slots.map((sl, i) => {
      if (!sl) return `<div class="slot"><div class="t">슬롯 ${i + 1}</div><div class="d">비어 있음</div><div class="btns"><button class="btn gold" data-act="slotNew" data-slot="${i}">새 게임 시작</button></div></div>`;
      const m = sl.meta || {}, when = m.updated ? new Date(m.updated).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="slot"><div class="t">슬롯 ${i + 1} — ${m.title || ''}${sl.local ? ' (기기 사본)' : ''}</div><div class="d">${m.chapter || ''}<br>유비 Lv${m.lv || '?'} · 장수 ${m.heroes || '?'}명 · 금 ${m.gold ?? '?'} · ${when}</div><div class="btns"><button class="btn gold" data-act="slotLoad" data-slot="${i}">이어하기</button><button class="btn" data-act="slotNew" data-slot="${i}">새로 시작</button><button class="btn red" data-act="slotDel" data-slot="${i}">삭제</button></div></div>`;
    }).join('');
  }
  async function doAuth(action) {
    const id = $('#loginId').value.trim(), pw = $('#loginPw').value;
    if (!id || !pw) { loginMsg('아이디와 비밀번호를 입력하세요'); return; }
    loginMsg(action === 'login' ? '로그인 중…' : '만드는 중…', true);
    try {
      const r = await api('auth', { action, id, pw });
      if (r.error) { loginMsg(r.error); return; }
      ACC.id = r.id; ACC.token = r.token; ACC.guest = false; saveAccount(); $('#loginPw').value = ''; loginMsg('');
      renderTitle();
    } catch (e) { loginMsg('서버에 연결할 수 없습니다'); }
  }
  async function slotLoad(slot) {
    let d = null;
    if (ACC.guest) { const l = localSlot(slot); d = l && l.data; }
    else {
      const r = await api('saves', { op: 'load', slot }), l = localSlot(slot);
      if (!r.error) d = (l && l.meta && r.meta && (l.meta.updated || 0) > (r.meta.updated || 0)) ? l.data : r.data;   // 더 새것 우선
      else { d = l && l.data; if (d) toast('서버 연결 실패 — 기기 사본으로 진행'); else { toast(r.error); return; } }
    }
    if (!d) return;
    ACC.slot = slot; Object.assign(P, { roster: {}, gold: 0, stageId: null, flags: {}, order: [] }, d);
    hide('#title'); gotoStage(P.stageId || FIRST_STAGE);
  }
  async function slotNew(slot, hasData) {
    if (hasData && !confirm(`슬롯 ${slot + 1}의 저장을 지우고 새로 시작할까요?`)) return;
    ACC.slot = slot; hide('#title'); newGame();
  }
  async function slotDel(slot) {
    if (!confirm(`슬롯 ${slot + 1}의 저장을 삭제할까요?`)) return;
    try { localStorage.removeItem(slotKey(slot)); } catch (e) { /* 무시 */ }
    if (!ACC.guest) { const r = await api('saves', { op: 'delete', slot }); if (r.error) toast(r.error); }
    renderTitle();
  }
  async function logout() {
    if (ACC.id && ACC.token) api('auth', { action: 'logout' }).catch(() => {});
    ACC.id = ACC.token = null; ACC.guest = false; ACC.slot = null; saveAccount(); renderTitle();
  }

  // ---------- 렌더링 ----------
  function resize() {
    if (!G.map) return;
    const cols = G.map[0].length, rows = G.map.length;
    const fit = Math.floor(Math.min(wrap.clientWidth / cols, wrap.clientHeight / rows));
    TS = settings.zoom ? Math.max(40, Math.floor(fit * 1.6)) : Math.max(20, fit);
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = TS * cols + 'px'; canvas.style.height = TS * rows + 'px';
    canvas.width = Math.round(TS * cols * dpr); canvas.height = Math.round(TS * rows * dpr);
    $('#btnZoom').textContent = settings.zoom ? '축소' : '확대';
  }
  window.addEventListener('resize', resize);
  function scrollTo(u) {
    const cx = (u.x + 0.5) * TS + (canvas.offsetLeft || 0), cy = (u.y + 0.5) * TS;
    const left = cx - wrap.clientWidth / 2, top = cy - wrap.clientHeight / 2;
    if (Math.abs(wrap.scrollLeft - left) > wrap.clientWidth * 0.3 || Math.abs(wrap.scrollTop - top) > wrap.clientHeight * 0.3) wrap.scrollTo({ left, top, behavior: 'smooth' });
  }
  function addFloat(x, y, text, color) { G.floats.push({ x, y, text, color, t0: performance.now(), dur: 1000 }); }
  // 지도 위 효과(책략·피격·회복·레벨업). 결정적 파티클이라 상태 없이 시간만으로 그림
  const FX = { fire: ['#ff7043', '#ffd54f'], water: ['#4fc3f7', '#e1f5fe'], earth: ['#a1887f', '#6d4c41'], heal: ['#8fe08f', '#ffffff'], cure: ['#8fe08f', '#ffffff'], morale: ['#ce93d8', '#7e57c2'], confuse: ['#ce93d8', '#ffd54f'], cheer: ['#f5c542', '#ffffff'], virtue: ['#ffd54f', '#ffffff'], hit: ['#ffffff', '#ffe082'], miss: ['#aaaaaa', '#666666'], levelup: ['#ffd54f', '#ffffff'] };
  function addFx(x, y, type) { G.fx.push({ x, y, type, t0: performance.now(), dur: type === 'fire' ? 900 : 700, seed: Math.random() * 100 }); }
  function drawFx(now) {
    G.fx = G.fx.filter((f) => now - f.t0 < f.dur);
    for (const f of G.fx) {
      const t = (now - f.t0) / f.dur, cx = f.x * TS + TS / 2, cy = f.y * TS + TS / 2, cols = FX[f.type] || FX.hit;
      ctx.save();
      if (f.type === 'fire') {
        const env = Math.sin(Math.PI * t);
        for (let i = 0; i < 7; i++) { const s = Math.sin(f.seed + i * 12.9) * 0.5 + 0.5, fx = cx + (i - 3) * TS * 0.14, fh = TS * (0.35 + s * 0.5) * env * (0.85 + 0.15 * Math.sin(now / 60 + i)), fy = cy + TS * 0.45;
          for (const [col, m] of [['rgba(230,70,30,.9)', 1], ['rgba(255,170,40,.95)', 0.7], ['rgba(255,240,140,.95)', 0.4]]) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx - TS * 0.1 * m, fy); ctx.quadraticCurveTo(fx, fy - fh * m * 0.5, fx, fy - fh * m); ctx.quadraticCurveTo(fx, fy - fh * m * 0.5, fx + TS * 0.1 * m, fy); ctx.fill(); } }
      } else if (f.type === 'water') {
        ctx.fillStyle = `rgba(79,195,247,${0.8 * (1 - t)})`; ctx.beginPath(); ctx.arc(cx, cy, TS * 0.65 * t, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${1 - t})`; for (let i = 0; i < 8; i++) { const a = f.seed + i * 0.8, r = TS * 0.3 + TS * 0.5 * t; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6 - t * TS * 0.4, TS * 0.06, 0, 7); ctx.fill(); }
      } else if (f.type === 'earth') {
        for (let i = 0; i < 5; i++) { const k = Math.max(0, Math.min(1, t * 1.6 - i * 0.1)), rx = cx + (i - 2) * TS * 0.2, ry = cy - TS * 1.5 * (1 - k * k) + TS * 0.3; ctx.fillStyle = cols[i % 2]; ctx.beginPath(); ctx.arc(rx, ry, TS * 0.1, 0, 7); ctx.fill(); }
        if (t > 0.6) { ctx.fillStyle = `rgba(160,130,100,${(1 - t) * 1.5})`; ctx.beginPath(); ctx.ellipse(cx, cy + TS * 0.4, TS * 0.6 * (t - 0.4), TS * 0.2, 0, 0, 7); ctx.fill(); }
      } else if (f.type === 'hit') {
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, TS * 0.08); ctx.beginPath(); ctx.arc(cx, cy, TS * 0.45, -2.4 + t, -0.6 + t); ctx.stroke();
        for (let i = 0; i < 8; i++) { const a = f.seed + i * 0.79, r = TS * 0.15 + TS * 0.5 * t; ctx.fillStyle = cols[i % 2]; ctx.fillRect(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r - 2, 4, 4); }
      } else if (f.type === 'miss') {
        ctx.globalAlpha = 1 - t; ctx.fillStyle = '#ccc'; for (let i = 0; i < 6; i++) { const a = f.seed + i * 1.05, r = TS * 0.2 + TS * 0.3 * t; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, TS * 0.07, 0, 7); ctx.fill(); }
      } else { // 회복·사기·혼란·레벨업: 올라가는 반짝임 + 고리
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = cols[0]; ctx.lineWidth = Math.max(2, TS * 0.06); ctx.beginPath(); ctx.ellipse(cx, cy + TS * 0.35, TS * 0.55 * t + 2, TS * 0.25 * t + 1, 0, 0, 7); ctx.stroke();
        for (let i = 0; i < 10; i++) { const s = Math.sin(f.seed + i * 7.3) * 0.5 + 0.5, px = cx + (s - 0.5) * TS * 0.9, py = cy + TS * 0.4 - (t * 1.2 + s * 0.3) * TS * 0.9, r = TS * 0.05 + TS * 0.04 * Math.sin(now / 80 + i); ctx.fillStyle = cols[i % 2]; ctx.beginPath(); ctx.moveTo(px, py - r * 2); ctx.lineTo(px + r, py); ctx.lineTo(px, py + r * 2); ctx.lineTo(px - r, py); ctx.closePath(); ctx.fill(); }
      }
      ctx.restore();
    }
  }

  function drawTile(ch, x, y) {
    const t = TERRAIN[ch], px = x * TS, py = y * TS, s = TS;
    const img = IMG[t.img];
    if (img) {
      ctx.drawImage(img, px, py, s, s);
      if ((ch === 'T' || ch === 'Q') && G.taken.has(L.key(x, y))) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px, py, s, s); }
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      return;
    }
    // 이미지 없을 때 대체 그리기
    const base = { B: IMG.t_W, G: IMG.t_P, D: IMG.t_R, K: IMG.t_C, X: IMG.t_C, S: IMG.t_P, E: IMG.t_P, T: IMG.t_P, Q: IMG.t_P }[ch];
    if (base) ctx.drawImage(base, px, py, s, s);
    else { ctx.fillStyle = { P: '#9ccc65', R: '#e0cda0', G: '#8bc34a', F: '#5e9c48', B: '#8d6e4a', M: '#a08a6e', D: '#c2a67a', C: '#b0aab8', K: '#8a8496', X: '#6d6775', S: '#9ccc65', H: '#e2b87a', E: '#9ccc65', T: '#9ccc65', Q: '#9ccc65', W: '#4f9bd9' }[ch]; ctx.fillRect(px, py, s, s); }
    if (ch === 'G') { ctx.fillStyle = 'rgba(40,160,60,.22)'; ctx.fillRect(px, py, s, s); }
    if (ch === 'D') { ctx.fillStyle = 'rgba(120,80,30,.25)'; ctx.fillRect(px, py, s, s); }
    if (ch === 'B') { ctx.fillStyle = '#9a7048'; ctx.fillRect(px + s * 0.08, py, s * 0.84, s); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(px + s * 0.08, py + s * i / 4); ctx.lineTo(px + s * 0.92, py + s * i / 4); ctx.stroke(); } }
    else if (ch === 'X') { ctx.fillStyle = 'rgba(40,30,50,.55)'; ctx.fillRect(px, py, s, s); }
    else if (ch === 'K') { ctx.fillStyle = 'rgba(40,30,50,.55)'; ctx.fillRect(px, py, s, s); ctx.fillStyle = '#e8c070'; ctx.beginPath(); ctx.arc(px + s / 2, py + s * 0.55, s * 0.3, Math.PI, 0); ctx.lineTo(px + s * 0.8, py + s * 0.95); ctx.lineTo(px + s * 0.2, py + s * 0.95); ctx.closePath(); ctx.fill(); }
    else if (ch === 'S') { ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.strokeRect(px + s * 0.12, py + s * 0.12, s * 0.76, s * 0.76); }
    else if (ch === 'E') { ctx.fillStyle = '#d9c28a'; ctx.beginPath(); ctx.moveTo(px + s * 0.15, py + s * 0.8); ctx.lineTo(px + s * 0.5, py + s * 0.25); ctx.lineTo(px + s * 0.85, py + s * 0.8); ctx.closePath(); ctx.fill(); }
    else if ((ch === 'T' || ch === 'Q') && !G.taken.has(L.key(x, y))) { ctx.fillStyle = ch === 'Q' ? '#b08a4a' : '#c9a227'; ctx.fillRect(px + s * 0.2, py + s * 0.35, s * 0.6, s * 0.45); }
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  }
  function drawUnit(u, now) {
    let ux = u.px !== undefined ? u.px : u.x, uy = u.py !== undefined ? u.py : u.y;
    if (u.anim) { const t = Math.min(1, (now - u.anim.t0) / u.anim.dur); const k = Math.sin(Math.PI * t) * 0.4; ux += u.anim.dx * k; uy += u.anim.dy * k; }
    const cx = ux * TS + TS / 2, cy = uy * TS + TS / 2, r = TS * 0.4;
    ctx.save();
    if (u.acted && G.phase === 'player' && u.side === 'p') ctx.globalAlpha = 0.5;
    const sp = IMG[CLASSES[u.cls].sprite];
    if (u.boss || u.lord) {
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = Math.max(2, TS * 0.09); ctx.beginPath();
      if (sp) ctx.ellipse(cx, cy + r * 0.55, r + TS * 0.05, r * 0.5 + TS * 0.05, 0, 0, 7); else ctx.arc(cx, cy, r + TS * 0.05, 0, 7);
      ctx.stroke();
    }
    const col = u.side === 'p' ? 'rgba(59,111,214,.75)' : u.side === 'n' ? 'rgba(61,163,93,.75)' : (u.boss ? 'rgba(164,38,44,.85)' : 'rgba(214,69,69,.75)');
    if (sp) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.55, r, r * 0.5, 0, 0, 7); ctx.fill();
      const sz = TS * 1.25; ctx.drawImage(sp, cx - sz / 2, cy + r * 0.75 - sz, sz, sz);
    } else {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(TS * 0.5)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(u.ch, cx, cy + TS * 0.02);
    }
    // 진영 깃발 (원작식: 아군 파랑 · 우군 초록 · 적군 빨강)
    const fcol = u.side === 'p' ? '#3b6fd6' : u.side === 'n' ? '#3da35d' : '#d64545';
    const fx = cx - r * 0.95, fy = cy - r * 1.35;
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = Math.max(1, TS * 0.05); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, cy + r * 0.3); ctx.stroke();
    ctx.fillStyle = fcol; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + r * 0.75, fy + r * 0.25); ctx.lineTo(fx, fy + r * 0.5); ctx.closePath(); ctx.fill();
    if (u.boss || u.lord) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 1; ctx.stroke(); }
    if (CLASSES[u.cls].tier > 1) { ctx.fillStyle = '#ffd54f'; ctx.font = `bold ${Math.round(TS * 0.3)}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('★'.repeat(CLASSES[u.cls].tier - 1), cx - r, cy - r); }
    if (u.confused) { ctx.fillStyle = '#f5c542'; ctx.font = `bold ${Math.round(TS * 0.38)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('?', cx, cy - r * 0.9); }
    const bw = TS * 0.76, bh = Math.max(3, TS * 0.1), bx = cx - bw / 2, by = cy + r - bh * 0.2;
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh);
    const pct = u.hp / L.maxHp(u);
    ctx.fillStyle = pct > 0.5 ? '#6fd66f' : pct > 0.25 ? '#f5c542' : '#e0553a'; ctx.fillRect(bx, by, bw * pct, bh);
    ctx.restore();
  }
  function draw(now) {
    requestAnimationFrame(draw);
    if (!G.map) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = G.map[0].length, rows = G.map.length;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) drawTile(G.map[y][x], x, y);
    // 승리 목표 칸 표시
    for (const w of G.stage.win) if (w.type === 'reach') { ctx.strokeStyle = `rgba(255,213,79,${0.5 + 0.4 * Math.sin(now / 300)})`; ctx.lineWidth = Math.max(2, TS * 0.08); for (const [x, y] of w.tiles) ctx.strokeRect(x * TS + 2, y * TS + 2, TS - 4, TS - 4); }
    if (G.phase === 'player' && G.sel) {
      if (G.state === 'selected' && G.reach) {
        ctx.fillStyle = 'rgba(60,120,255,.4)';
        for (const v of G.reach.values()) if (!v.blocked) ctx.fillRect(v.x * TS, v.y * TS, TS, TS);
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = Math.max(2, TS * 0.1);
        for (const id of G.atkOpts.keys()) { const t = G.units.find((u) => u.id === id); ctx.strokeRect(t.x * TS + 2, t.y * TS + 2, TS - 4, TS - 4); }
      } else if (G.state === 'moved') {
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = Math.max(2, TS * 0.1);
        for (const t of G.moveTargets) ctx.strokeRect(t.x * TS + 2, t.y * TS + 2, TS - 4, TS - 4);
      } else if (G.state === 'atkTarget') {
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = Math.max(2, TS * 0.1);
        const list = G.preState === 'moved' ? G.moveTargets : [...G.atkOpts.keys()].map((id) => G.units.find((u) => u.id === id));
        for (const t of list) ctx.strokeRect(t.x * TS + 2, t.y * TS + 2, TS - 4, TS - 4);
      } else if (G.state === 'tacTarget' && G.tacCells) {
        ctx.fillStyle = 'rgba(255,213,79,.45)';
        for (const c of G.tacCells) ctx.fillRect(c.x * TS, c.y * TS, TS, TS);
      }
    }
    const hl = G.sel || G.acting;
    if (hl) { const blink = 0.6 + 0.4 * Math.sin(now / 150); ctx.strokeStyle = `rgba(255,255,255,${blink})`; ctx.lineWidth = Math.max(2, TS * 0.08); ctx.strokeRect(hl.x * TS + 1, hl.y * TS + 1, TS - 2, TS - 2); }
    const sorted = G.units.filter((u) => u.alive).sort((a, b) => (a.py ?? a.y) - (b.py ?? b.y));
    for (const u of sorted) drawUnit(u, now);
    if (G.shot) {
      const t = Math.min(1, (now - G.shot.t0) / G.shot.dur), { a, d } = G.shot;
      const x1 = a.x * TS + TS / 2, y1 = a.y * TS + TS / 2, x2 = d.x * TS + TS / 2, y2 = d.y * TS + TS / 2;
      ctx.strokeStyle = { fire: '#ff7043', water: '#4fc3f7', earth: '#a1887f' }[G.shot.magic] || (G.shot.magic ? '#b388ff' : '#ffe082'); ctx.lineWidth = Math.max(2, TS * 0.08);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t); ctx.stroke();
    }
    drawFx(now);
    if (G.weather === 'rain') { ctx.strokeStyle = 'rgba(200,220,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); const w = cols * TS, h = rows * TS; for (let i = 0; i < 90; i++) { const sx = Math.sin(i * 127.1) * 0.5 + 0.5, sy = Math.sin(i * 311.7) * 0.5 + 0.5, x = ((sx * (w + 60) - now * 0.2) % (w + 60) + w + 60) % (w + 60) - 30, y = (sy * h + now * (0.7 + sx * 0.4)) % h; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + TS * 0.3); } ctx.stroke(); }
    G.floats = G.floats.filter((f) => now - f.t0 < f.dur);
    for (const f of G.floats) {
      const t = (now - f.t0) / f.dur; ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = f.color; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
      ctx.font = `bold ${Math.round(TS * 0.42)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fx = f.x * TS + TS / 2, fy = f.y * TS - t * TS * 0.8;
      ctx.strokeText(f.text, fx, fy); ctx.fillText(f.text, fx, fy); ctx.globalAlpha = 1;
    }
  }

  loadAccount(); showTitle(); updateAnimBtn();
  requestAnimationFrame(draw);
  window.__G = G; window.__P = P; window.__dbg = { loadStage, gotoStage, newGame, endPlayerTurn, select, onTap, finishAction, STAGES };
})();
