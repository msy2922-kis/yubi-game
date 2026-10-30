// ===== 삼국지 영걸전(PC판) 데이터: 지형 · 병종 · 책략 · 아이템 · 장수 · 적장 =====
// 출처: docs/research_*.md (원작 공략 조사)

// ---------- 지형 ----------
// def: 방어율(%), heal: 회복 지형, cost: 기본 이동 비용, pass: 진입 불가 여부
const TERRAIN = {
  P: { name: '평지',   def: 0,  cost: 1, img: 't_P', tactic: 'fire water' },
  R: { name: '길',     def: 0,  cost: 1, img: 't_R', tactic: 'fire water' },
  G: { name: '초원',   def: 5,  cost: 1, img: 't_G', tactic: 'fire' },
  F: { name: '숲',     def: 20, cost: 1, img: 't_F', tactic: 'fire', fireBonus: true, noCav: true, rough: true },
  B: { name: '다리',   def: 0,  cost: 1, img: 't_B', tactic: 'water' },
  M: { name: '산지',   def: 30, cost: 1, img: 't_M', tactic: 'earth', mountain: true },
  D: { name: '황무지', def: 0,  cost: 1, img: 't_D', tactic: 'earth', rough: true, cavRough: true },
  C: { name: '성내',   def: 0,  cost: 1, img: 't_C', tactic: 'fire' },
  K: { name: '성문',   def: 0,  cost: 1, img: 't_K', tactic: 'fire', gate: true },
  X: { name: '성벽',   def: 0,  cost: 99, img: 't_X', block: true },
  S: { name: '성채',   def: 30, cost: 1, img: 't_S', tactic: null, heal: 'both' },
  H: { name: '마을',   def: 5,  cost: 1, img: 't_H', tactic: null, heal: 'both' },
  E: { name: '병영',   def: 10, cost: 1, img: 't_E', tactic: null, heal: 'hp' },
  T: { name: '보물고', def: 0,  cost: 2, img: 't_T', tactic: null, chest: true },
  Q: { name: '군량고', def: 0,  cost: 2, img: 't_Q', tactic: null, chest: true, granary: true },
  W: { name: '강',     def: 0,  cost: 99, img: 't_W', block: true },
};

// ---------- 병종 ----------
// line: inf 보병 / cav 기병 / arc 궁병 / bandit 적병 / sp 특수(상성 없음)
// atk/def: 병과 기본 공격·방어, hp0: Lv1 병력, hpLv: Lv당 병력, mov: 이동력
// rng: a4 인접4 / a8 인접8 / bow 궁병 / xbow 연노 / cata 발석차
const CLASSES = {
  inf1:   { name: '단병',   line: 'inf', tier: 1, atk: 40, def: 40, hp0: 500, hpLv: 50, mov: 4, rng: 'a4', sprite: 'u_inf', tac: 'inf' },
  inf2:   { name: '장병',   line: 'inf', tier: 2, atk: 60, def: 60, hp0: 500, hpLv: 50, mov: 4, rng: 'a8', sprite: 'u_inf', tac: 'inf' },
  inf3:   { name: '전차대', line: 'inf', tier: 3, atk: 60, def: 80, hp0: 500, hpLv: 50, mov: 5, rng: 'a8', sprite: 'u_inf', tac: 'inf' },
  cav1:   { name: '경기병', line: 'cav', tier: 1, atk: 60, def: 30, hp0: 500, hpLv: 60, mov: 6, rng: 'a4', sprite: 'u_cav', tac: 'cav', cav: true },
  cav2:   { name: '중기병', line: 'cav', tier: 2, atk: 70, def: 50, hp0: 500, hpLv: 60, mov: 5, rng: 'a4', sprite: 'u_cav', tac: 'cav', cav: true },
  cav3:   { name: '친위대', line: 'cav', tier: 3, atk: 80, def: 60, hp0: 500, hpLv: 60, mov: 6, rng: 'a4', sprite: 'u_cav', tac: 'cav', cav: true },
  arc1:   { name: '궁병',   line: 'arc', tier: 1, atk: 30, def: 40, hp0: 500, hpLv: 40, mov: 4, rng: 'bow',  sprite: 'u_arc', tac: 'arc', ranged: true },
  arc2:   { name: '연노병', line: 'arc', tier: 2, atk: 60, def: 40, hp0: 500, hpLv: 40, mov: 4, rng: 'xbow', sprite: 'u_arc', tac: 'arc', ranged: true },
  arc3:   { name: '발석차', line: 'arc', tier: 3, atk: 80, def: 50, hp0: 500, hpLv: 40, mov: 3, rng: 'cata', sprite: 'u_cata', tac: 'arc', ranged: true },
  ban1:   { name: '산적',   line: 'bandit', tier: 1, atk: 50, def: 40, hp0: 800, hpLv: 40, mov: 4, rng: 'a4', sprite: 'u_bandit', tac: 'bandit', mountain: true },
  ban2:   { name: '흉적',   line: 'bandit', tier: 2, atk: 60, def: 50, hp0: 800, hpLv: 40, mov: 4, rng: 'a8', sprite: 'u_bandit', tac: 'bandit', mountain: true, counter: true },
  ban3:   { name: '의적',   line: 'bandit', tier: 3, atk: 70, def: 60, hp0: 800, hpLv: 40, mov: 4, rng: 'a8', sprite: 'u_bandit', tac: 'bandit', mountain: true, counter: true },
  monk:   { name: '무도가', line: 'sp', tier: 1, atk: 70, def: 60, hp0: 600, hpLv: 50, mov: 5, rng: 'a8', sprite: 'u_monk', tac: 'monk', mountain: true, counter: true },
  tribe:  { name: '이민족', line: 'sp', tier: 1, atk: 70, def: 80, hp0: 700, hpLv: 60, mov: 5, rng: 'a8', sprite: 'u_tribe', tac: 'tribe', mountain: true },
  beast:  { name: '맹수사', line: 'sp', tier: 1, atk: 80, def: 30, hp0: 400, hpLv: 50, mov: 4, rng: 'a8', sprite: 'u_beast', tac: 'beast', mountain: true },
  supply: { name: '수송대', line: 'sp', tier: 1, atk: 20, def: 20, hp0: 300, hpLv: 40, mov: 3, rng: 'a8', sprite: 'u_supply', tac: 'supply', rough: true, support: true },
  band:   { name: '군악대', line: 'sp', tier: 1, atk: 20, def: 20, hp0: 300, hpLv: 40, mov: 4, rng: 'a8', sprite: 'u_band', tac: 'band', rough: true, support: true, mpRegen: true },
  shaman: { name: '주술사', line: 'sp', tier: 1, atk: 20, def: 20, hp0: 300, hpLv: 50, mov: 4, rng: 'a4', sprite: 'u_str', tac: 'shaman', support: true },
};
// 상성: 기병 > 보병 > 궁병 > 기병 (키가 값에 강함)
const ADV = { cav: 'inf', inf: 'arc', arc: 'cav' };
// 승급 경로 (아이템 사용, Lv 조건)
const PROMOTE = { inf1: 'inf2', inf2: 'inf3', cav1: 'cav2', cav2: 'cav3', arc1: 'arc2', arc2: 'arc3', ban1: 'ban2', ban2: 'ban3' };

// ---------- 책략 ----------
// type: fire/water/earth 공격, morale 사기저하, confuse 혼란, heal 병력회복, cheer 사기회복, cure 병력+사기(주술사), virtue 유비 전용
// rng: s 소(8칸) / m 중(12칸) / l 대(20칸), cross: 십자 범위
const TACTICS = {
  초열: { type: 'fire', mp: 4, rng: 's', pow: 200 }, 화룡: { type: 'fire', mp: 8, rng: 'm', pow: 600 }, 업화: { type: 'fire', mp: 12, rng: 'l', pow: 1000 },
  대초열: { type: 'fire', mp: 16, rng: 's', pow: 200, cross: true }, 대화룡: { type: 'fire', mp: 20, rng: 'm', pow: 600, cross: true },
  소용돌이: { type: 'water', mp: 6, rng: 's', pow: 300 }, 탁류: { type: 'water', mp: 10, rng: 'm', pow: 700 }, 해일: { type: 'water', mp: 14, rng: 'l', pow: 1100 },
  대소용돌이: { type: 'water', mp: 18, rng: 's', pow: 300, cross: true }, 대탁류: { type: 'water', mp: 22, rng: 'm', pow: 700, cross: true },
  낙석: { type: 'earth', mp: 8, rng: 's', pow: 400 }, 산사태: { type: 'earth', mp: 12, rng: 'm', pow: 800 }, 토석류: { type: 'earth', mp: 16, rng: 'l', pow: 1200 },
  대낙석: { type: 'earth', mp: 20, rng: 's', pow: 400, cross: true }, 대산사태: { type: 'earth', mp: 24, rng: 'm', pow: 800, cross: true },
  견제: { type: 'morale', mp: 4, rng: 's', pow: 20 }, 도발: { type: 'morale', mp: 8, rng: 'm', pow: 30 }, 위압: { type: 'morale', mp: 16, rng: 'l', pow: 40 },
  거짓정보: { type: 'confuse', mp: 8, rng: 's' }, 위병: { type: 'confuse', mp: 16, rng: 'l' }, 위장: { type: 'confuse', mp: 24, rng: 's', cross: true },
  원조: { type: 'heal', mp: 6, rng: 's', pow: 600 }, 보급: { type: 'heal', mp: 10, rng: 'm', pow: 1200 }, 구제: { type: 'heal', mp: 14, rng: 'l', pow: 1800 },
  대원조: { type: 'heal', mp: 24, rng: 's', pow: 600, cross: true }, 대보급: { type: 'heal', mp: 32, rng: 'm', pow: 1200, cross: true }, 대구제: { type: 'heal', mp: 40, rng: 'l', pow: 1800, cross: true },
  격려: { type: 'cheer', mp: 4, rng: 's', pow: 30 }, 응원: { type: 'cheer', mp: 8, rng: 'm', pow: 40 }, 고무: { type: 'cheer', mp: 12, rng: 'l', pow: 50 },
  대격려: { type: 'cheer', mp: 16, rng: 's', pow: 30, cross: true }, 대응원: { type: 'cheer', mp: 24, rng: 'm', pow: 40, cross: true }, 대고무: { type: 'cheer', mp: 32, rng: 'l', pow: 50, cross: true },
  간호: { type: 'cure', mp: 12, rng: 's', pow: 500, morale: 30 }, 치유: { type: 'cure', mp: 20, rng: 'm', pow: 1000, morale: 40 }, 구명: { type: 'cure', mp: 28, rng: 'l', pow: 1500, morale: 50 },
  인덕: { type: 'virtue', mp: 10, rng: 's', pow: 300, morale: 10, cross: true }, 의덕: { type: 'virtue', mp: 18, rng: 's', pow: 600, morale: 20, cross: true },
  애덕: { type: 'virtue', mp: 28, rng: 'm', pow: 1000, morale: 30, cross: true }, 대덕: { type: 'virtue', mp: 50, rng: 'l', pow: 1500, morale: 50, cross: true },
};
const TACTIC_TYPE_NAME = { fire: '화계', water: '수계', earth: '지계', morale: '사기저하', confuse: '혼란', heal: '병력회복', cheer: '사기회복', cure: '치유', virtue: '덕' };
// 병종 계열별 습득 책략 [책략, 습득Lv, 최소 tier]
const LEARN = {
  inf:    [['초열', 6], ['거짓정보', 12], ['화룡', 18, 2], ['격려', 24], ['원조', 28]],
  cav:    [['견제', 8], ['격려', 12], ['도발', 20, 2]],
  arc:    [['소용돌이', 6], ['거짓정보', 12], ['탁류', 18, 2], ['격려', 24], ['원조', 28]],
  bandit: [['낙석', 3], ['견제', 8], ['산사태', 8], ['거짓정보', 12], ['격려', 16], ['토석류', 16, 2], ['원조', 20], ['대낙석', 24]],
  monk:   [['초열', 4], ['화룡', 8], ['업화', 16], ['대초열', 20], ['대화룡', 24]],
  tribe:  [['소용돌이', 1], ['탁류', 8], ['해일', 16], ['대소용돌이', 20]],
  beast:  [['견제', 1], ['도발', 6], ['거짓정보', 8], ['위압', 12], ['위병', 16], ['위장', 24]],
  supply: [['원조', 1], ['보급', 8], ['구제', 16], ['대원조', 20], ['대보급', 26], ['대구제', 32]],
  band:   [['격려', 1], ['응원', 8], ['고무', 16], ['대격려', 20], ['대응원', 26], ['대고무', 32]],
  shaman: [['초열', 1], ['소용돌이', 1], ['낙석', 1], ['견제', 1], ['거짓정보', 1], ['간호', 1], ['화룡', 4], ['탁류', 4], ['산사태', 4], ['도발', 4],
           ['위압', 6], ['위병', 6], ['업화', 8], ['해일', 8], ['토석류', 8], ['치유', 10], ['대초열', 12], ['대소용돌이', 12], ['대낙석', 12], ['위장', 12],
           ['대화룡', 16], ['대탁류', 16], ['대산사태', 16], ['구명', 20]],
};
const LIUBEI_TACTICS = [['인덕', 1], ['의덕', 10], ['애덕', 20], ['대덕', 30]];

// ---------- 아이템 ----------
// weapon: 공격 +%, book: 방어 +%, horse: 이동 +, use: 소모품(책략 효과), promo: 승급, job: 전직, gold: 금
const ITEMS = {
  // 보물 무기
  사모: { type: 'weapon', atk: 10, desc: '장비의 장팔사모. 공격 +10%' }, 청룡언월도: { type: 'weapon', atk: 12, desc: '관우의 청룡언월도. 공격 +12%' },
  삼첨도: { type: 'weapon', atk: 10, desc: '공격 +10%' }, 칠성검: { type: 'weapon', atk: 10, desc: '공격 +10%' }, 의천검: { type: 'weapon', atk: 14, desc: '공격 +14%' },
  자웅일대검: { type: 'weapon', atk: 16, desc: '유비의 쌍검. 공격 +16%' }, 방천화극: { type: 'weapon', atk: 18, desc: '여포의 창. 공격 +18%' },
  청강검: { type: 'weapon', atk: 20, desc: '공격 +20%' }, 영걸검: { type: 'weapon', atk: 22, desc: '공격 +22%' }, 패자검: { type: 'weapon', atk: 24, desc: '공격 +24%' },
  반월창: { type: 'weapon', atk: 6, desc: '공격 +6%' }, 갈고리: { type: 'weapon', atk: 5, desc: '공격 +5%' },
  // 병법서 · 방어구
  육도: { type: 'book', def: 15, desc: '방어 +15%' }, 삼략: { type: 'book', def: 15, desc: '방어 +15%' }, 오자병법서: { type: 'book', def: 20, desc: '방어 +20%' },
  손자병법서: { type: 'book', def: 22, desc: '방어 +22%' }, 맹덕신서: { type: 'book', def: 15, desc: '방어 +15%' }, 단패: { type: 'book', def: 6, desc: '방어 +6%' },
  // 말
  조황비전: { type: 'horse', mov: 1, desc: '이동 +1' }, 적로: { type: 'horse', mov: 2, desc: '이동 +2' }, 적토마: { type: 'horse', mov: 3, desc: '이동 +3' },
  // 소모품 (책략 효과)
  콩: { type: 'use', tac: '원조', price: 100, desc: '병력 회복(소)' }, 보리: { type: 'use', tac: '보급', price: 200, desc: '병력 회복(중)' }, 쌀: { type: 'use', tac: '구제', price: 400, desc: '병력 회복(대)' },
  술: { type: 'use', tac: '격려', price: 50, desc: '사기 회복(소)' }, 특급주: { type: 'use', tac: '응원', price: 100, desc: '사기 회복(중)' },
  상약: { type: 'use', tac: '간호', price: 300, desc: '병력+사기 회복(소)' }, 한방약: { type: 'use', tac: '치유', price: 600, desc: '병력+사기 회복(중)' },
  초열서: { type: 'use', tac: '초열', price: 50, desc: '화계 초열' }, 화룡서: { type: 'use', tac: '화룡', price: 100, desc: '화계 화룡' },
  소용돌이서: { type: 'use', tac: '소용돌이', price: 80, desc: '수계 소용돌이' }, 탁류서: { type: 'use', tac: '탁류', price: 160, desc: '수계 탁류' },
  낙석서: { type: 'use', tac: '낙석', price: 100, desc: '지계 낙석' }, 산사태서: { type: 'use', tac: '산사태', price: 200, desc: '지계 산사태' },
  농무서: { type: 'use', tac: '거짓정보', price: 50, desc: '적을 혼란시킴' }, 폭탄: { type: 'use', bomb: 1500, price: 500, desc: '인접 적에게 1500 고정 피해' },
  // 승급
  장창: { type: 'promo', from: 'inf1', lv: 15, price: 300, desc: '단병→장병 (Lv15)' }, 보병차: { type: 'promo', from: 'inf2', lv: 30, price: 600, desc: '장병→전차대 (Lv30)' },
  마개: { type: 'promo', from: 'cav1', lv: 15, price: 400, desc: '경기병→중기병 (Lv15)' }, 근위개: { type: 'promo', from: 'cav2', lv: 30, price: 800, desc: '중기병→친위대 (Lv30)' },
  연노: { type: 'promo', from: 'arc1', lv: 15, price: 350, desc: '궁병→연노병 (Lv15)' }, 투석기: { type: 'promo', from: 'arc2', lv: 30, price: 700, desc: '연노병→발석차 (Lv30)' },
  무술교본: { type: 'promo', from: 'ban1', lv: 15, price: 200, desc: '산적→흉적 (Lv15)' }, 의협교본: { type: 'promo', from: 'ban2', lv: 30, price: 400, desc: '흉적→의적 (Lv30)' },
  // 전직 (유비 불가)
  검술지침서: { type: 'job', to: 'inf1', desc: '단병으로 전직' }, 궁술지침서: { type: 'job', to: 'arc1', desc: '궁병으로 전직' }, 마술지침서: { type: 'job', to: 'cav1', desc: '경기병으로 전직' },
  산적의맹세: { type: 'job', to: 'ban1', desc: '산적으로 전직' }, 무술지침서: { type: 'job', to: 'monk', desc: '무도가로 전직' },
};
const SHOP_BASIC = ['콩', '보리', '술', '상약', '초열서', '소용돌이서', '낙석서', '농무서', '폭탄'];
const SHOP_PROMO1 = ['장창', '마개', '연노', '무술교본'];

// ---------- 아군 장수 (무력/지력/통솔, 가입 Lv, 병종, 초기 아이템) ----------
const HEROES = {
  liubei:   { name: '유비', ch: '劉', cls: 'inf1', lv: 1,  mu: 75, chi: 64, tong: 91, portrait: 'p_liubei', lord: true },
  guanyu:   { name: '관우', ch: '關', cls: 'cav1', lv: 5,  mu: 98, chi: 80, tong: 100, portrait: 'p_guanyu', items: ['청룡언월도'] },
  zhangfei: { name: '장비', ch: '張', cls: 'cav1', lv: 5,  mu: 99, chi: 42, tong: 83, portrait: 'p_zhangfei', items: ['사모'] },
  jianyong: { name: '간옹', ch: '簡', cls: 'arc1', lv: 5,  mu: 42, chi: 74, tong: 36, portrait: 'p_jianyong' },
  fangong:  { name: '번궁', ch: '藩', cls: 'monk', lv: 7,  mu: 62, chi: 52, tong: 71, portrait: 'p_fangong' },
  hanying:  { name: '한영', ch: '韓', cls: 'inf1', lv: 7,  mu: 64, chi: 55, tong: 41 },
  guodi:    { name: '곽적', ch: '郭', cls: 'ban1', lv: 7,  mu: 35, chi: 63, tong: 50 },
  gengwu:   { name: '경무', ch: '耿', cls: 'inf1', lv: 7,  mu: 44, chi: 53, tong: 32 },
  guanchun: { name: '관순', ch: '純', cls: 'arc1', lv: 7,  mu: 42, chi: 61, tong: 32 },
  zhaoyun:  { name: '조운', ch: '趙', cls: 'cav1', lv: 14, mu: 98, chi: 84, tong: 87, portrait: 'p_zhaoyun' },
  sunqian:  { name: '손건', ch: '孫', cls: 'supply', lv: 13, mu: 38, chi: 74, tong: 34, portrait: 'p_sunqian' },
  mizhu:    { name: '미축', ch: '糜', cls: 'band', lv: 13, mu: 40, chi: 64, tong: 36 },
  mifang:   { name: '미방', ch: '芳', cls: 'inf1', lv: 13, mu: 63, chi: 25, tong: 59 },
};

// ---------- 적장 능력치 (무력/지력/통솔) · 없으면 잡병 기본치 ----------
const GENERALS = {
  화웅: [90, 29, 88], 호진: [65, 40, 60], 조잠: [60, 35, 55], 이숙: [55, 70, 50],
  여포: [100, 21, 80], 장료: [90, 80, 87], 위속: [65, 40, 60], 후성: [70, 45, 62], 송헌: [68, 40, 60],
  순우경: [73, 62, 68], 봉기: [35, 78, 58], 장합: [90, 62, 88], 안량: [87, 32, 84], 심배: [50, 80, 70], 고람: [75, 48, 70], 국의: [80, 55, 78],
  원소: [58, 47, 71], 문추: [91, 19, 86], 전풍: [30, 92, 75], 저수: [35, 90, 78], 곽도: [40, 75, 55], 진진: [45, 70, 60], 허유: [35, 80, 50], 진림: [25, 82, 45],
  초촉: [60, 35, 55], 장남: [62, 38, 58], 관해: [68, 14, 52],
  우금: [78, 60, 80], 이전: [75, 75, 78], 조홍: [80, 45, 75], 악진: [85, 40, 78], 하후연: [90, 52, 86], 곽가: [30, 97, 70],
  조조: [75, 94, 98], 하후돈: [95, 60, 87], 순욱: [35, 96, 88],
  // NPC
  도겸: [40, 60, 65], 공손찬: [80, 55, 78], 우칙: [50, 40, 45], 공손월: [60, 45, 55], 주비: [55, 45, 50], 진장: [60, 35, 55], 엄강: [70, 40, 62],
  공융: [30, 80, 60], 태사자: [93, 66, 80], 맹숙: [40, 30, 35], 미방: [63, 25, 59], 손건: [38, 74, 34], 조운: [98, 84, 87],
};
const TROOP_STATS = { 1: [40, 25, 35], 2: [50, 30, 45], 3: [60, 35, 55] };
const TROOP_NAME = { inf: '보병대', cav: '기병대', arc: '궁병대', bandit: '적병', monk: '무도가', tribe: '이민족', beast: '맹수사', supply: '수송대', band: '군악대', shaman: '주술사' };

// 대화 화자 → 초상화
const PORTRAITS = { '유비': 'p_liubei', '관우': 'p_guanyu', '장비': 'p_zhangfei', '간옹': 'p_jianyong', '조운': 'p_zhaoyun', '화웅': 'p_boss3', '여포': 'p_lubu', '원소': 'p_yuanshao',
  '조조': 'p_caocao', '손건': 'p_sunqian', '순우경': 'p_chunyuqiong', '장합': 'p_zhanghe', '문추': 'p_wenchou', '관해': 'p_guanhai', '우금': 'p_yujin', '번궁': 'p_fangong', '정원지': 'p_boss1', '고승': 'p_boss2' };
const IMAGE_LIST = ['t_P', 't_R', 't_F', 't_M', 't_W', 't_C', 't_H', 't_G', 't_D', 't_B', 't_S', 't_E', 't_T', 't_Q', 't_K', 't_X', 'u_lord', 'u_inf', 'u_cav', 'u_arc', 'u_str', 'u_bandit',
  'u_monk', 'u_tribe', 'u_beast', 'u_supply', 'u_band', 'u_cata',
  'p_liubei', 'p_guanyu', 'p_zhangfei', 'p_jianyong', 'p_zhaoyun', 'p_boss1', 'p_boss2', 'p_boss3',
  'p_lubu', 'p_yuanshao', 'p_caocao', 'p_sunqian', 'p_chunyuqiong', 'p_zhanghe', 'p_wenchou', 'p_guanhai', 'p_yujin', 'p_fangong'];
