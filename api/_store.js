// 공용: Vercel Blob 저장소 래퍼 + 인증 유틸
// 경로 규칙 (공개 스토어라 경로를 비밀키 HMAC으로 숨김, 쓰기마다 새 파일을 만들어 CDN 캐시를 피함)
//   u/<h(id)>/<ts>.json         사용자 레코드 {id, salt, hash, tokens:[{h,exp}]}
//   s/<h(id)>/<slot>/<ts>.json  세이브 {meta, data}
const crypto = require('crypto');
const blob = require('@vercel/blob');

const SECRET = process.env.SESSION_SECRET || 'dev-secret';
const hid = (id) => crypto.createHmac('sha256', SECRET).update('id:' + id.toLowerCase()).digest('hex').slice(0, 32);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const normId = (id) => String(id || '').trim();
const validId = (id) => /^[0-9A-Za-z가-힣_]{2,16}$/.test(id);

async function latest(prefix) {
  const { blobs } = await blob.list({ prefix, limit: 1000 });
  if (!blobs.length) return null;
  blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
  const r = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!r.ok) return null;
  const data = await r.json();
  // 오래된 버전 정리 (최신 1개만 유지)
  if (blobs.length > 1) blob.del(blobs.slice(1).map((b) => b.url)).catch(() => {});
  return data;
}
async function write(prefix, obj) {
  const path = `${prefix}${Date.now().toString(36)}.json`;
  await blob.put(path, JSON.stringify(obj), { access: 'public', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 });
}
async function remove(prefix) {
  const { blobs } = await blob.list({ prefix, limit: 1000 });
  if (blobs.length) await blob.del(blobs.map((b) => b.url));
}

const userPrefix = (id) => `u/${hid(id)}/`;
const slotPrefix = (id, slot) => `s/${hid(id)}/${slot}/`;

function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
function newToken() { return crypto.randomBytes(24).toString('hex'); }

async function getUser(id) { return latest(userPrefix(id)); }
async function putUser(u) { await write(userPrefix(u.id), u); }

// 토큰 검증 → 사용자 레코드 (없으면 null)
async function auth(id, token) {
  id = normId(id); if (!validId(id) || !token) return null;
  const u = await getUser(id); if (!u) return null;
  const th = sha(token), now = Date.now();
  const t = (u.tokens || []).find((x) => x.h === th && x.exp > now);
  return t ? u : null;
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
function body(req) { if (!req.body) return {}; if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } } return req.body; }

module.exports = { normId, validId, hashPw, newToken, sha, getUser, putUser, auth, latest, write, remove, slotPrefix, cors, body };
