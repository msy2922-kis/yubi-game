// POST /api/auth  { action: 'register' | 'login' | 'check' | 'logout', id, pw, token }
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
      const salt = crypto.randomBytes(16).toString('hex');
      await S.putUser({ id, salt, hash: S.hashPw(pw, salt), created: Date.now() });
      return res.json({ ok: true, id, token: S.signToken(id, TOKEN_DAYS) });
    }
    if (action === 'login') {
      let u = await S.getUser(id);
      if (!u) { await new Promise((r) => setTimeout(r, 400)); u = await S.getUser(id); }   // 방금 만든 계정이 아직 안 보일 때 한 번 더
      if (!u || S.hashPw(pw, u.salt) !== u.hash) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀립니다' });
      return res.json({ ok: true, id: u.id, token: S.signToken(u.id, TOKEN_DAYS) });
    }
    if (action === 'check') return S.auth(id, b.token) ? res.json({ ok: true, id }) : res.status(401).json({ error: '로그인이 만료되었습니다' });
    if (action === 'logout') return res.json({ ok: true });   // 서명 토큰: 클라이언트가 지우면 끝
    return res.status(400).json({ error: '알 수 없는 요청' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류: ' + (e.message || e) });
  }
};
