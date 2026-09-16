/* ══════════════════════════════════════════════════════════
   PET STAGE — ต้องตรงกับ STAGES ใน frontend/src/pages/Pet.jsx
   และ PET_STAGE_POWER ใน server.js
══════════════════════════════════════════════════════════ */
const STAGES = [
  { key: 'EGG',     minXp: 0,    power: 0,   short: 'ไข่' },
  { key: 'NEWBORN', minXp: 40,   power: 5,   short: 'แรกเกิด' },
  { key: 'TODDLER', minXp: 110,  power: 12,  short: 'เตาะแตะ' },
  { key: 'CHILD',   minXp: 230,  power: 24,  short: 'วัยเด็ก' },
  { key: 'PRETEEN', minXp: 430,  power: 40,  short: 'รุ่นต้น' },
  { key: 'TEEN',    minXp: 760,  power: 65,  short: 'วัยรุ่น' },
  { key: 'YOUNG',   minXp: 1300, power: 95,  short: 'หนุ่มสาว' },
  { key: 'ADULT',   minXp: 2150, power: 140, short: 'โตเต็มวัย' },
  { key: 'EXPERT',  minXp: 3500, power: 210, short: 'เชี่ยวชาญ' },
  { key: 'LEGEND',  minXp: 5600, power: 320, short: 'ตำนาน' },
];

function petStage(xp) {
  const n = Number(xp) || 0;
  for (let i = STAGES.length - 1; i >= 0; i--) if (n >= STAGES[i].minXp) return STAGES[i];
  return STAGES[0];
}

const stageKey = (xp) => petStage(xp).key;

module.exports = { STAGES, petStage, stageKey };
