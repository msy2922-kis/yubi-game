// 공용: Vercel Blob 저장소 래퍼 + 인증 유틸
// 경로 규칙 (비공개 스토어, 경로는 비밀키 HMAC으로 가림, 같은 경로에 덮어쓰기)
//   u/<h(id)>.json         사용자 레코드 {id, salt, hash, created}
//   s/<h(id)>/<slot>.json  세이브 {meta, data}
// 세션 토큰은 서명 방식(id|만료|HMAC)이라 검증에 저장소 조회가 필요 없다
const crypto = require('crypto');
const blob = require('@vercel/blob');

const SECRET = process.env.SESSION_SECRET || 'dev-secret';
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const hid = (id) => hmac('id:' + id.toLowerCase()).slice(0, 32);
const normId = (id) => String(id || '').trim();
const validId = (id) => /^[0-9A-Za-z가-힣_]{2,16}$/.test(id);

async function readJson(path) {
  const r = await blob.get(path, { access: 'private' });
  if (!r || r.statusCode !== 200) return null;
  return new Response(r.stream).json();
}
async function writeJson(path, obj) {
  await blob.put(path, JSON.stringify(obj), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}
async function removePath(path) { await blob.del(path); }

const userPath = (id) => `u/${hid(id)}.json`;
const slotPath = (id, slot) => `s/${hid(id)}/${slot}.json`;

function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
function signToken(id, days) {
  const exp = Date.now() + days * 864e5, base = `${Buffer.from(id).toString('base64url')}.${exp.toString(36)}`;
  return `${base}.${hmac('tok:' + base).slice(0, 40)}`;
}
function verifyToken(id, token) {
  if (!token) return false;
  const parts = String(token).split('.'); if (parts.length !== 3) return false;
  const base = `${parts[0]}.${parts[1]}`;
  if (hmac('tok:' + base).slice(0, 40) !== parts[2]) return false;
  if (Buffer.from(parts[0], 'base64url').toString() !== id) return false;
  return parseInt(parts[1], 36) > Date.now();
}

async function getUser(id) { return readJson(userPath(id)); }
async function putUser(u) { await writeJson(userPath(u.id), u); }
function auth(id, token) { id = normId(id); return validId(id) && verifyToken(id, token); }

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
function body(req) { if (!req.body) return {}; if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } } return req.body; }

module.exports = { normId, validId, hashPw, signToken, getUser, putUser, auth, readJson, writeJson, removePath, slotPath, cors, body };
