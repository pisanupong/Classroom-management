/* ══════════════════════════════════════════════════════════
   WORD CHECK — ตรวจว่าคำที่ป้อนเป็นคำศัพท์ที่มีความหมายจริง

   ใช้ Wiktionary (ฟรี ไม่ต้องใช้ key):
     - คำไทย   → th.wiktionary.org
     - คำอังกฤษ → en.wiktionary.org
   ถ้าเน็ต/ปลายทางล่ม จะ "ผ่านให้" (fail-open) เพื่อไม่ให้เกมสะดุด
══════════════════════════════════════════════════════════ */
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;   // จำผลไว้ 7 วัน
const CACHE_MAX = 5000;
const cache = new Map();                    // word → { ok, at }

const TIMEOUT_MS = 4000;

const isThai = (w) => /[ก-๙]/.test(w);

function cacheGet(word) {
  const hit = cache.get(word);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_MS) { cache.delete(word); return undefined; }
  return hit.ok;
}

function cacheSet(word, ok) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(word, { ok, at: Date.now() });
}

/* เรียก Wiktionary — คืน true ถ้ามีหน้าคำนี้อยู่, false ถ้าไม่มี, null ถ้าเรียกไม่สำเร็จ */
async function wiktionaryHas(lang, word) {
  const url = `https://${lang}.wiktionary.org/w/api.php?action=query&format=json`
            + `&redirects=1&titles=${encodeURIComponent(word)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ClassroomApp/1.0 (pet word check)' },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const pages = j?.query?.pages;
    if (!pages) return null;
    return !Object.values(pages).some(p => p.missing !== undefined);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * checkWord(word) → { valid, reason }
 *   valid=true  : เป็นคำจริง (หรือตรวจไม่ได้ — ปล่อยผ่าน)
 *   valid=false : ไม่พบในพจนานุกรม
 */
async function checkWord(word) {
  const w = String(word || '').trim();
  if (!w) return { valid: false, reason: 'empty' };

  const key = w.toLowerCase();
  const cached = cacheGet(key);
  if (cached !== undefined) return { valid: cached, reason: cached ? 'cached' : 'not_found' };

  // ลองภาษาที่น่าจะตรงก่อน แล้วค่อยลองอีกภาษาเป็นตัวสำรอง
  const langs = isThai(w) ? ['th', 'en'] : ['en', 'th'];
  let anyError = false;
  for (const lang of langs) {
    const has = await wiktionaryHas(lang, isThai(w) ? w : key);
    if (has === true)  { cacheSet(key, true);  return { valid: true,  reason: `found_${lang}` }; }
    if (has === null)  anyError = true;
  }

  // เรียกไม่สำเร็จ → ปล่อยผ่าน และไม่ cache ไว้ (จะได้ลองใหม่คราวหน้า)
  if (anyError) return { valid: true, reason: 'check_unavailable' };

  cacheSet(key, false);
  return { valid: false, reason: 'not_found' };
}

module.exports = { checkWord };
