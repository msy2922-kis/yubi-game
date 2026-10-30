// POST /api/auth  { action: 'register' | 'login' | 'logout' | 'check', id, pw, token }
const S = require('./_store');
const crypto = require('crypto');
const TOKEN_DAYS = 60;

module.exports = async (req, res) => {
  if (S.cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 지원' });
  const b = S.body(req), action = b.action, id = S.normId(b.id), pw = String(b.pw || '');
  try {
    if (!S.validId(id)) return res.status(400).json({ error: '아이디는 2~16자 (한글·영문·숫자·_)' });
    if (action === 'register') {
      if (pw.length < 4 || pw.length > 32) return res.status(400).json({ error: '비밀번호는 4~32자' });
      if (await S.getUser(id)) return res.status(409).json({ error: '이미 있는 아이디' });
      const salt = crypto.randomBytes(16).toString('hex'), token = S.newToken();
      await S.putUser({ id, salt, hash: S.hashPw(pw, salt), created: Date.now(), tokens: [{ h: S.sha(token), exp: Date.now() + TOKEN_DAYS * 864e5 }] });
      return res.json({ ok: true, id, token });
    }
    if (action === 'login') {
      const u = await S.getUser(id);
      if (!u || S.hashPw(pw, u.salt) !== u.hash) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다' });
      const token = S.newToken(), now = Date.now();
      u.tokens = (u.tokens || []).filter((t) => t.exp > now).slice(-5);
      u.tokens.push({ h: S.sha(token), exp: now + TOKEN_DAYS * 864e5 });
      await S.putUser(u);
      return res.json({ ok: true, id: u.id, token });
    }
    if (action === 'check') {
      const u = await S.auth(id, b.token);
      return u ? res.json({ ok: true, id: u.id }) : res.status(401).json({ error: '로그인이 만료되었습니다' });
    }
    if (action === 'logout') {
      const u = await S.auth(id, b.token);
      if (u) { const th = S.sha(b.token); u.tokens = u.tokens.filter((t) => t.h !== th); await S.putUser(u); }
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: '알 수 없는 요청' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류: ' + (e.message || e) });
  }
};
