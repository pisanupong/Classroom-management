/**
 * หลักสูตร Python สำหรับเมนู "Python" — เก็บไว้ฝั่งเซิร์ฟเวอร์เป็นแหล่งความจริงเดียว
 * คะแนน/XP/เงื่อนไขผ่าน ทั้งหมดตัดสินที่นี่ ไม่เชื่อค่าที่ client ส่งมา
 */

const LEVELS = [
  { level: 1, title: '🥉 เลเวล 1 — มือใหม่หัดเขียน',  need: 0,   next: 30,  avatar: '🤖', titleShort: 'มือใหม่หัดเขียน' },
  { level: 2, title: '🥈 เลเวล 2 — นักเขียนโค้ดน้อย',  need: 30,  next: 70,  avatar: '🦾', titleShort: 'นักเขียนโค้ดน้อย' },
  { level: 3, title: '🥇 เลเวล 3 — นักผจญภัยโค้ด',    need: 70,  next: 120, avatar: '🦸', titleShort: 'นักผจญภัยโค้ด' },
  { level: 4, title: '💎 เลเวล 4 — ปรมาจารย์ Python', need: 120, next: 180, avatar: '🧙', titleShort: 'ปรมาจารย์ Python' },
  { level: 5, title: '👑 เลเวล 5 — ตำนานแห่งโค้ด',    need: 180, next: 999, avatar: '👑', titleShort: 'ตำนานแห่งโค้ด' },
];

const LESSONS = ['print', 'var', 'input', 'if', 'for', 'list', 'def'];
const LESSON_XP = 10;
const LESSON_SCORE = 30;

// s = สรุปความคืบหน้าของผู้เล่น { learned, missions, rewards, exercises, xp, level }
const countTrue = (obj) => Object.keys(obj || {}).filter(k => obj[k]).length;

const MISSIONS = [
  { id:'m1',  icon:'🖨️', title:'ทักทายโลก',      desc:'print "Hello Python"',        lesson:'print', xp:15, score:50,  unlockLevel:1, check:(o)   => /hello\s*python/i.test(o) },
  { id:'m2',  icon:'📦', title:'สร้างตัวตน',      desc:'สร้างตัวแปร name แล้ว print',  lesson:'var',   xp:15, score:50,  unlockLevel:1, check:(o,c) => /name\s*=/.test(c) && o.trim().length > 0 },
  { id:'m3',  icon:'⌨️', title:'แนะนำตัว',        desc:'ใส่ชื่อแล้วรัน input สำเร็จ',   lesson:'input', xp:15, score:50,  unlockLevel:1, special:'input', check:() => true },
  { id:'m4',  icon:'❓', title:'ผู้ตัดสิน',       desc:'if-else ให้ขึ้น ผ่าน/ไม่ผ่าน',  lesson:'if',    xp:20, score:80,  unlockLevel:2, check:(o)   => /ผ่าน|ไม่ผ่าน/.test(o) },
  { id:'m5',  icon:'🔁', title:'นักนับเลข',       desc:'for นับอย่างน้อย 3 รอบ',       lesson:'for',   xp:20, score:80,  unlockLevel:2, check:(o)   => o.trim().split('\n').length >= 3 },
  { id:'m6',  icon:'📋', title:'เจ้าของลิสต์',    desc:'สร้างลิสต์ ≥3 แล้ว print',     lesson:'list',  xp:20, score:80,  unlockLevel:2, check:(o,c) => /\[/.test(c) && o.trim().length > 0 },
  { id:'m7',  icon:'🎯', title:'สร้างเวทมนตร์',   desc:'สร้างฟังก์ชันแล้วเรียกใช้',     lesson:'def',   xp:25, score:100, unlockLevel:3, check:(o,c) => /def\s+\w+/.test(c) && o.trim().length > 0 },
  { id:'m8',  icon:'⭐', title:'นักเรียนขยัน',    desc:'เข้าใจครบ 7 คำสั่ง',           lesson:null,    xp:30, score:150, unlockLevel:1, special:'allLearned', auto:(s) => countTrue(s.learned) >= 7 },
  { id:'m9',  icon:'🔥', title:'นักรบ XP',        desc:'สะสม XP ≥ 50',                lesson:null,    xp:20, score:80,  unlockLevel:2, special:'xp50',       auto:(s) => s.xp >= 50 },
  { id:'m10', icon:'🏆', title:'ขึ้นเลเวล 3',     desc:'อัปเลเวลถึง 3',                lesson:null,    xp:25, score:100, unlockLevel:2, special:'lv3',        auto:(s) => s.level >= 3 },
  { id:'m11', icon:'💪', title:'ทำภารกิจ 5 อัน',  desc:'เคลียร์ 5 ภารกิจ',            lesson:null,    xp:25, score:100, unlockLevel:3, special:'m5',         auto:(s) => countTrue(s.missions) >= 5 },
  { id:'m12', icon:'👑', title:'จอมทัพโค้ด',      desc:'เคลียร์เกือบทุกภารกิจ',        lesson:null,    xp:50, score:200, unlockLevel:4, special:'all',        auto:(s) => countTrue(s.missions) >= 11 },
];

const REWARD_TIERS = {
  1: { name:'ธรรมดา',    color:'#cd7f32', bg:'rgba(205,127,50,.12)',  border:'rgba(205,127,50,.45)' },
  2: { name:'หายาก',     color:'#94a3b8', bg:'rgba(148,163,184,.12)', border:'rgba(148,163,184,.5)' },
  3: { name:'มหากาพย์',  color:'#fbbf24', bg:'rgba(251,191,36,.12)',  border:'rgba(251,191,36,.55)' },
  4: { name:'ตำนาน',     color:'#a78bfa', bg:'rgba(167,139,250,.15)', border:'rgba(167,139,250,.6)' },
};

const REWARDS = [
  { id:'r1',  icon:'🥉', name:'ตราเริ่มต้น',       desc:'เริ่มต้นการผจญภัย',      tier:1, scoreBonus:10,  cond:() => true },
  { id:'r2',  icon:'🖨️', name:'นักพิมพ์',          desc:'เรียน print เสร็จ',       tier:1, scoreBonus:20,  cond:(s) => !!s.learned.print },
  { id:'r3',  icon:'📦', name:'เจ้าแห่งกล่อง',     desc:'เรียนตัวแปรเสร็จ',        tier:1, scoreBonus:20,  cond:(s) => !!s.learned.var },
  { id:'r4',  icon:'⭐', name:'ดาวแห่งความรู้',    desc:'เรียนครบ 3 คำสั่ง',       tier:2, scoreBonus:40,  cond:(s) => countTrue(s.learned) >= 3 },
  { id:'r5',  icon:'🥈', name:'นักผจญภัย',         desc:'ถึงเลเวล 2',              tier:2, scoreBonus:40,  cond:(s) => s.level >= 2 },
  { id:'r6',  icon:'🔥', name:'ไฟแห่งโค้ด',        desc:'ทำภารกิจ 3 อัน',          tier:2, scoreBonus:50,  cond:(s) => countTrue(s.missions) >= 3 },
  { id:'r7',  icon:'📚', name:'นักฝึกหัด',         desc:'ผ่านแบบฝึกหัด 4 ข้อ',     tier:2, scoreBonus:50,  cond:(s) => countTrue(s.exercises) >= 4 },
  { id:'r8',  icon:'🥇', name:'ฮีโร่โค้ด',         desc:'ถึงเลเวล 3',              tier:3, scoreBonus:80,  cond:(s) => s.level >= 3 },
  { id:'r9',  icon:'💎', name:'เพชร Python',       desc:'ถึงเลเวล 4',              tier:3, scoreBonus:100, cond:(s) => s.level >= 4 },
  { id:'r10', icon:'🏅', name:'ตำนานภารกิจ',       desc:'ทำภารกิจ 8 อัน',          tier:3, scoreBonus:100, cond:(s) => countTrue(s.missions) >= 8 },
  { id:'r11', icon:'🎓', name:'จบหลักสูตร',        desc:'เรียนครบ 7 คำสั่ง',       tier:3, scoreBonus:120, cond:(s) => countTrue(s.learned) >= 7 },
  { id:'r12', icon:'👑', name:'ราชาแห่งโค้ด',      desc:'ถึงเลเวล 5',              tier:4, scoreBonus:200, cond:(s) => s.level >= 5 },
  { id:'r13', icon:'🌌', name:'ผู้พิชิตแบบฝึก',    desc:'ผ่านแบบฝึกหัดครบ 8 ข้อ',  tier:4, scoreBonus:150, cond:(s) => countTrue(s.exercises) >= 8 },
  { id:'r14', icon:'🏆', name:'ตำนานสมบูรณ์',      desc:'ได้รางวัลอย่างน้อย 12 ชิ้น', tier:4, scoreBonus:250, cond:(s) => countTrue(s.rewards) >= 12 },
];

const EXERCISES = [
  { id:'ex1', icon:'🖨️', title:'ทักทาย Python', topic:'print',      score:40, xp:8,
    desc:'เขียนโค้ดให้พิมพ์ข้อความ Hello Python ออกจอ',
    starter:'# พิมพ์ Hello Python\n',
    hint:'ใช้ print("Hello Python") โดยใส่ข้อความในเครื่องหมายคำพูด',
    check:(o) => /hello\s*python/i.test(o.trim()) },
  { id:'ex2', icon:'📦', title:'เก็บชื่อเล่น', topic:'ตัวแปร',       score:40, xp:8,
    desc:'สร้างตัวแปรชื่อ nick ใส่ค่า "โค้ดเลส" แล้ว print ค่านั้น',
    starter:'# สร้างตัวแปร nick\n',
    hint:'nick = "โค้ดเลส"\nprint(nick)',
    check:(o,c) => /nick\s*=/.test(c) && /โค้ดเลส/.test(o) },
  { id:'ex3', icon:'➕', title:'บวกเลข', topic:'การคำนวณ',           score:40, xp:8,
    desc:'ให้ print ผลลัพธ์ของ 25 + 17 (แค่ตัวเลขผลลัพธ์)',
    starter:'# คำนวณ 25 + 17\n',
    hint:'print(25 + 17)',
    check:(o) => o.trim() === '42' },
  { id:'ex4', icon:'❓', title:'ตรวจคะแนนสอบ', topic:'if-else',      score:50, xp:10,
    desc:'มีตัวแปร score = 72 ถ้า >= 50 ให้พิมพ์ "ผ่าน" ไม่งั้นพิมพ์ "ไม่ผ่าน"',
    starter:'score = 72\n# เขียน if-else\n',
    hint:'if score >= 50:\n    print("ผ่าน")\nelse:\n    print("ไม่ผ่าน")',
    check:(o) => o.trim() === 'ผ่าน' },
  { id:'ex5', icon:'🔁', title:'นับถอยหลัง', topic:'for',            score:50, xp:10,
    desc:'ใช้ for พิมพ์เลข 3, 2, 1 ทีละบรรทัด',
    starter:'# นับ 3 2 1\n',
    hint:'for i in range(3, 0, -1):\n    print(i)',
    check:(o) => o.trim() === '3\n2\n1' },
  { id:'ex6', icon:'📋', title:'เมนูอาหาร', topic:'list',            score:50, xp:10,
    desc:'สร้างลิสต์ foods มี "ข้าว","แกง","ผลไม้" แล้ว print ทั้งลิสต์',
    starter:'# สร้างลิสต์ foods\n',
    hint:'foods = ["ข้าว", "แกง", "ผลไม้"]\nprint(foods)',
    check:(o,c) => /foods\s*=/.test(c) && /\[/.test(c) && o.trim().length > 0 },
  { id:'ex7', icon:'🎯', title:'ฟังก์ชันสวัสดี', topic:'function',   score:60, xp:12,
    desc:'สร้างฟังก์ชัน hi ที่รับ name แล้วพิมพ์ "สวัสดี, {name}" จากนั้นเรียก hi("เพื่อน")',
    starter:'# สร้างฟังก์ชัน hi\n',
    hint:'def hi(name):\n    print("สวัสดี,", name)\n\nhi("เพื่อน")',
    check:(o,c) => /def\s+hi/.test(c) && /สวัสดี/.test(o) && /เพื่อน/.test(o) },
  { id:'ex8', icon:'🌟', title:'รวมพลัง', topic:'ผสม',               score:45, xp:9,
    desc:'สร้างตัวแปร a = 10, b = 20 แล้ว print ผลรวม a+b',
    starter:'# a + b\n',
    hint:'a = 10\nb = 20\nprint(a + b)',
    check:(o) => o.trim() === '30' },
];

const levelForXp = (xp) => {
  let info = LEVELS[0];
  for (const lv of LEVELS) if (xp >= lv.need) info = lv;
  return info;
};

// ส่งให้ frontend — ตัดฟังก์ชัน check/cond/auto ออก (serialize ไม่ได้ และไม่ควรให้ client เห็น)
const publicCurriculum = () => ({
  levels: LEVELS,
  lessons: LESSONS,
  lessonReward: { xp: LESSON_XP, score: LESSON_SCORE },
  missions: MISSIONS.map(({ check, auto, ...m }) => m),
  rewardTiers: REWARD_TIERS,
  rewards: REWARDS.map(({ cond, ...r }) => r),
  exercises: EXERCISES.map(({ check, ...e }) => e),
});

module.exports = {
  LEVELS, LESSONS, LESSON_XP, LESSON_SCORE,
  MISSIONS, REWARDS, REWARD_TIERS, EXERCISES,
  levelForXp, countTrue, publicCurriculum,
};
