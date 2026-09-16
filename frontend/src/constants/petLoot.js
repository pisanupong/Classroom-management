/* ══════════════════════════════════════════════════════════
   PET LOOT — ต้องตรงกับ backend/utils/petLoot.js
══════════════════════════════════════════════════════════ */
export const COSTUMES = {
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

export const RARITY = {
  common:    { label:'ทั่วไป',   color:'#94a3b8' },
  rare:      { label:'หายาก',    color:'#38bdf8' },
  epic:      { label:'มหากาพย์', color:'#a78bfa' },
  legendary: { label:'ตำนาน',    color:'#fbbf24' },
};

export const COSTUME_LIST = Object.values(COSTUMES);

/* ไอเทมสิ้นเปลืองที่ดรอปจากแบบฝึกหัด */
export const LOOT_ITEMS = {
  herb:  { key:'herb',  name:'ยาสมุนไพรเวท', emoji:'🌿', desc:'รักษาอาการป่วย' },
  kit:   { key:'kit',   name:'ชุดรักษาเวท',  emoji:'🧰', desc:'รักษาอาการบาดเจ็บ' },
  snack: { key:'snack', name:'ขนมพิเศษ',     emoji:'🍬', desc:'+35 EXP · +12 ความอิ่ม' },
};

export const lootMeta = (r) =>
  r.type === 'costume' ? { ...COSTUMES[r.key], ...r } : { ...(LOOT_ITEMS[r.type] || {}), ...r };
