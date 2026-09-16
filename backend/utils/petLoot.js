/* ══════════════════════════════════════════════════════════
   PET LOOT — ของรางวัลสุ่มจากการทำแบบฝึกหัด
   ต้องตรงกับ frontend/src/constants/petLoot.js
══════════════════════════════════════════════════════════ */

/* ชุดแต่งสัตว์เลี้ยง — เก็บสะสมได้ ใส่ได้ทีละชิ้น */
const COSTUMES = {
  ribbon:  { key:'ribbon',  name:'ริบบิ้นหวาน',      emoji:'🎀', rarity:'common' },
  scarf:   { key:'scarf',   name:'ผ้าพันคอไหมพรม',   emoji:'🧣', rarity:'common' },
  glasses: { key:'glasses', name:'แว่นกันแดดเท่',    emoji:'🕶️', rarity:'common' },
  bandana: { key:'bandana', name:'ผ้าโพกหัวนักสู้',  emoji:'🥷', rarity:'common' },
  wizard:  { key:'wizard',  name:'หมวกพ่อมดเวท',     emoji:'🧙', rarity:'rare' },
  cape:    { key:'cape',    name:'ผ้าคลุมวีรบุรุษ',  emoji:'🦸', rarity:'rare' },
  horns:   { key:'horns',   name:'เขาปีศาจน้อย',     emoji:'😈', rarity:'rare' },
  halo:    { key:'halo',    name:'วงแหวนศักดิ์สิทธิ์', emoji:'😇', rarity:'epic' },
  crown:   { key:'crown',   name:'มงกุฎราชันย์',      emoji:'👑', rarity:'legendary' },
};

const RARITY = {
  common:    { label:'ทั่วไป',   color:'#94a3b8', weight:58 },
  rare:      { label:'หายาก',    color:'#38bdf8', weight:28 },
  epic:      { label:'มหากาพย์', color:'#a78bfa', weight:11 },
  legendary: { label:'ตำนาน',    color:'#fbbf24', weight:3  },
};

/* น้ำหนักการสุ่มประเภทของรางวัล */
const DROP_TABLE = [
  { type:'herb',    weight:30 },   // ยาสมุนไพรเวท (รักษาอาการป่วย)
  { type:'kit',     weight:20 },   // ชุดรักษาเวท (รักษาบาดเจ็บ)
  { type:'snack',   weight:28 },   // ขนมพิเศษ (+EXP ทันทีเมื่อใช้)
  { type:'costume', weight:22 },   // ชุดแต่งสัตว์เลี้ยง
];

function pickWeighted(rows, weightOf) {
  const total = rows.reduce((s, r) => s + weightOf(r), 0);
  let n = Math.random() * total;
  for (const r of rows) {
    n -= weightOf(r);
    if (n <= 0) return r;
  }
  return rows[rows.length - 1];
}

/* จำนวนครั้งที่ได้สุ่ม — ยิ่งทำถูกมาก ยิ่งได้สุ่มเยอะ */
function rollCount(pct) {
  if (pct >= 100) return 3;
  if (pct >= 80)  return 2;
  if (pct >= 50)  return 1;
  return Math.random() < 0.4 ? 1 : 0;   // ต่ำกว่า 50% ได้ลุ้นแค่ครึ่ง ๆ
}

/* สุ่มของรางวัลจากผลแบบฝึกหัด
   owned: array ของ costume key ที่มีอยู่แล้ว (ไว้กันได้ซ้ำ)
   คืน array ของ { type, key, name, emoji, rarity, amount } */
function rollLoot(pct, owned = []) {
  const n = rollCount(Math.max(0, Math.min(100, pct)));
  const out = [];
  const gained = new Set(owned);

  for (let i = 0; i < n; i++) {
    const drop = pickWeighted(DROP_TABLE, r => r.weight);

    if (drop.type === 'costume') {
      const pool = Object.values(COSTUMES).filter(c => !gained.has(c.key));
      if (!pool.length) {
        // มีชุดครบทุกแบบแล้ว → แปลงเป็นขนมพิเศษ 2 ชิ้น
        out.push({ type:'snack', key:'snack', name:'ขนมพิเศษ', emoji:'🍬', rarity:'common', amount:2 });
        continue;
      }
      const c = pickWeighted(pool, x => RARITY[x.rarity].weight);
      gained.add(c.key);
      out.push({ type:'costume', key:c.key, name:c.name, emoji:c.emoji, rarity:c.rarity, amount:1 });
      continue;
    }

    const meta = {
      herb:  { name:'ยาสมุนไพรเวท', emoji:'🌿' },
      kit:   { name:'ชุดรักษาเวท',  emoji:'🧰' },
      snack: { name:'ขนมพิเศษ',     emoji:'🍬' },
    }[drop.type];

    out.push({ type:drop.type, key:drop.type, ...meta, rarity:'common', amount:1 });
  }

  return out;
}

module.exports = { COSTUMES, RARITY, DROP_TABLE, rollLoot, rollCount };
