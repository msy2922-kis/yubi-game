// 세이브 슬롯 (사용자당 3개)
//   POST /api/saves { id, token, op: 'list' }               -> { slots: [{slot, meta}|null x3] }
//   POST /api/saves { id, token, op: 'load', slot }         -> { meta, data }
//   POST /api/saves { id, token, op: 'save', slot, meta, data }
//   POST /api/saves { id, token, op: 'delete', slot }
const S = require('./_store');
const SLOTS = 3, MAX_BYTES = 200 * 1024;

module.exports = async (req, res) => {
  if (S.cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 지원' });
  const b = S.body(req), id = S.normId(b.id);
  try {
    const u = await S.auth(id, b.token);
    if (!u) return res.status(401).json({ error: '로그인이 필요합니다' });
    const slot = Number(b.slot);
    if (b.op === 'list') {
      const slots = await Promise.all(Array.from({ length: SLOTS }, (_, i) => S.latest(S.slotPrefix(id, i)).then((r) => (r ? { slot: i, meta: r.meta } : null))));
      return res.json({ slots });
    }
    if (!(slot >= 0 && slot < SLOTS)) return res.status(400).json({ error: '슬롯 번호 오류' });
    if (b.op === 'load') { const r = await S.latest(S.slotPrefix(id, slot)); return r ? res.json(r) : res.status(404).json({ error: '빈 슬롯' }); }
    if (b.op === 'save') {
      const payload = { meta: Object.assign({}, b.meta, { updated: Date.now() }), data: b.data };
      if (JSON.stringify(payload).length > MAX_BYTES) return res.status(413).json({ error: '세이브가 너무 큽니다' });
      await S.write(S.slotPrefix(id, slot), payload);
      return res.json({ ok: true, meta: payload.meta });
    }
    if (b.op === 'delete') { await S.remove(S.slotPrefix(id, slot)); return res.json({ ok: true }); }
    return res.status(400).json({ error: '알 수 없는 요청' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류: ' + (e.message || e) });
  }
};
