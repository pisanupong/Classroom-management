const prisma = require('../config/db');

const DEFAULT_SETTINGS = {
  loginBackground: JSON.stringify({
    type: 'gradient',
    value: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
  }),
  menuPermissions: JSON.stringify({
    assignments:   ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    calendar:      ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    daily_homework:['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    quiz:          ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    character:     ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    chat:          ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    treasury:      ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    rewards:       ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    vocab_battle:  ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
    leaderboard:   ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'],
  }),
};

// GET /api/settings  — public (ทุกคนอ่านได้ สำหรับ login bg)
const getSettings = async (req, res) => {
  try {
    const rows = await prisma.setting.findMany();
    const settings = { ...DEFAULT_SETTINGS };
    rows.forEach(r => { settings[r.key] = r.value; });
    // parse JSON values
    const parsed = {};
    Object.entries(settings).forEach(([k, v]) => {
      try { parsed[k] = JSON.parse(v); } catch { parsed[k] = v; }
    });
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/settings  — SUPER_USER only
const updateSettings = async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    const results = {};
    for (const [key, value] of Object.entries(updates)) {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      const row = await prisma.setting.upsert({
        where:  { key },
        create: { key, value: strValue },
        update: { value: strValue },
      });
      try { results[key] = JSON.parse(row.value); } catch { results[key] = row.value; }
    }
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getSettings, updateSettings };
