import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT:0, PARENT:0, STAFF:1, CLASS_ADMIN:1, TEACHER:2, ADMIN:3, SUPER_USER:4 };
const fmtDate = d => new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

// ─── Word Modal ───────────────────────────────────────────────────────────────
const WordModal = ({ initial, categories, onClose, onSave }) => {
  const [form, setForm] = useState({ word: initial?.word||'', translation: initial?.translation||'', hint: initial?.hint||'', category: initial?.category||'ทั่วไป', newCat:'' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    try { await onSave({ ...form, category: form.newCat.trim() || form.category }); onClose(); }
    catch(e) { setErr(e.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}}>
      <div className="w-full max-w-md rounded-2xl p-6 border border-white/10" style={{background:'#0f0c29'}}>
        <h2 className="text-lg font-bold text-white mb-4">{initial ? 'แก้ไขคำศัพท์' : 'เพิ่มคำศัพท์'}</h2>
        {err && <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 p-2 rounded-lg">{err}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">คำศัพท์ *</label>
              <input value={form.word} onChange={e=>set('word',e.target.value)} required placeholder="word"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20"/>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">คำแปล *</label>
              <input value={form.translation} onChange={e=>set('translation',e.target.value)} required placeholder="แปลว่า..."
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">คำใบ้ (ถ้ามี)</label>
            <input value={form.hint} onChange={e=>set('hint',e.target.value)} placeholder="힌트..."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">หมวดหมู่</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400">
                {categories.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">หรือสร้างใหม่</label>
              <input value={form.newCat} onChange={e=>set('newCat',e.target.value)} placeholder="หมวดใหม่..."
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20"/>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10">ยกเลิก</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl font-semibold text-white disabled:opacity-40"
              style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)'}}>
              {saving ? '...' : initial ? 'บันทึก' : '+ เพิ่ม'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Challenge Modal ─────────────────────────────────────────────────────────
// โหลด players/categories ใน modal เองเลย ไม่พึ่ง parent state
const ChallengeModal = ({ currentUserId, onClose, onChallenge }) => {
  const [opponentId, setOpponentId] = useState('');
  const [category, setCategory]     = useState('');
  const [maxRounds, setMaxRounds]   = useState(10);
  const [sending, setSending]       = useState(false);
  const [err, setErr]               = useState('');
  const [players, setPlayers]       = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // โหลดข้อมูลตอน modal เปิด
  useEffect(() => {
    Promise.allSettled([
      api.get('/vocab/players'),
      api.get('/vocab/categories'),
    ]).then(([plR, cR]) => {
      if (plR.status === 'fulfilled') setPlayers(plR.value.data || []);
      if (cR.status === 'fulfilled')  setCategories(cR.value.data || []);
    }).finally(() => setLoadingData(false));
  }, []);

  const handleSend = async () => {
    if (!opponentId) return setErr('กรุณาเลือกคู่ต่อสู้');
    setSending(true); setErr('');
    try {
      await onChallenge({ opponent_id: parseInt(opponentId), category: category || null, max_rounds: maxRounds });
      onClose();
    } catch(e) { setErr(e.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)'}}>
      <div className="w-full max-w-md rounded-2xl p-6 border border-white/10" style={{background:'#0f0c29'}}>
        <h2 className="text-lg font-bold text-white mb-2">⚔️ ส่งคำท้า</h2>
        <p className="text-xs text-white/40 mb-4">เลือกคู่ต่อสู้และตั้งค่าการต่อสู้</p>

        {err && <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 p-2 rounded-lg">{err}</div>}

        {loadingData ? (
          <div className="py-8 text-center text-white/30 text-sm">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="space-y-3">
            {/* เลือกคู่ต่อสู้ */}
            <div>
              <label className="text-xs text-white/50 block mb-1">
                เลือกคู่ต่อสู้ <span className="text-white/30">({players.length} คน)</span>
              </label>
              <select value={opponentId} onChange={e => setOpponentId(e.target.value)}
                style={{background:'#1a1a3a', color:'#fff', width:'100%', padding:'8px 12px',
                  border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, fontSize:13, outline:'none'}}>
                <option value="">— เลือกผู้เล่น —</option>
                {players.map(p => (
                  <option key={p.id} value={p.id} style={{background:'#1a1a3a', color:'#fff'}}>
                    {p.student_number ? `${p.student_number} - ` : ''}{p.name}
                    {' '}({p.battle_stats?.wins || 0}W / {p.battle_stats?.losses || 0}L)
                  </option>
                ))}
              </select>
            </div>

            {/* หมวดและรอบ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 block mb-1">
                  หมวดคำศัพท์ <span className="text-white/30">({categories.length})</span>
                </label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  style={{background:'#1a1a3a', color:'#fff', width:'100%', padding:'8px 12px',
                    border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, fontSize:13, outline:'none'}}>
                  <option value="" style={{background:'#1a1a3a'}}>ทุกหมวด</option>
                  {categories.map(c => (
                    <option key={c.name} value={c.name} style={{background:'#1a1a3a', color:'#fff'}}>
                      {c.name} ({c.count} คำ)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">จำนวนรอบ</label>
                <select value={maxRounds} onChange={e => setMaxRounds(parseInt(e.target.value))}
                  style={{background:'#1a1a3a', color:'#fff', width:'100%', padding:'8px 12px',
                    border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, fontSize:13, outline:'none'}}>
                  {[5, 10, 15, 20].map(n => (
                    <option key={n} value={n} style={{background:'#1a1a3a'}}>{n} รอบ</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10">
                ยกเลิก
              </button>
              <button onClick={handleSend} disabled={sending || !opponentId}
                className="flex-1 py-2 rounded-xl font-semibold text-white disabled:opacity-40"
                style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>
                {sending ? '...' : '⚔️ ท้าเลย!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Bulk Import Modal ────────────────────────────────────────────────────────
const BulkModal = ({ categories, onClose, onSave }) => {
  const [text, setText]     = useState('');
  const [category, setCat]  = useState('ทั่วไป');
  const [newCat, setNewCat] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [preview, setPreview] = useState([]);

  const parseText = (t) => {
    return t.split('\n').map(l=>l.trim()).filter(Boolean).map(l => {
      const parts = l.split(/[,=\t|]+/);
      return parts.length >= 2 ? { word: parts[0].trim(), translation: parts[1].trim() } : null;
    }).filter(Boolean);
  };

  useEffect(() => { setPreview(parseText(text)); }, [text]);

  const handleSave = async () => {
    if (!preview.length) return setErr('ไม่พบคำศัพท์ที่อ่านได้');
    setSaving(true); setErr('');
    try { await onSave(preview, newCat.trim() || category); onClose(); }
    catch(e) { setErr(e.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}}>
      <div className="w-full max-w-lg rounded-2xl p-6 border border-white/10" style={{background:'#0f0c29'}}>
        <h2 className="text-lg font-bold text-white mb-1">📋 นำเข้าคำศัพท์จำนวนมาก</h2>
        <p className="text-xs text-white/40 mb-3">รูปแบบ: คำศัพท์,คำแปล (1 คู่ต่อบรรทัด) คั่นด้วย , = Tab หรือ |</p>
        {err && <div className="mb-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 p-2 rounded-lg">{err}</div>}
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={8}
          placeholder={'apple,แอปเปิ้ล\nbanana,กล้วย\nhappy,มีความสุข'}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-purple-400 placeholder-white/15 resize-none mb-3"/>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-white/50 block mb-1">หมวดหมู่</label>
            <select value={category} onChange={e=>setCat(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400">
              {categories.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">หรือสร้างหมวดใหม่</label>
            <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="หมวดใหม่..."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20"/>
          </div>
        </div>
        {preview.length > 0 && (
          <div className="mb-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
            ✅ พบ {preview.length} คู่ — ตัวอย่าง: "{preview[0].word}" = "{preview[0].translation}"
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10">ยกเลิก</button>
          <button onClick={handleSave} disabled={saving || !preview.length} className="flex-1 py-2 rounded-xl font-semibold text-white disabled:opacity-40"
            style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>
            {saving ? '...' : `นำเข้า ${preview.length} คำ`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const VocabBattle = () => {
  const { user } = useContext(AuthContext);
  const navigate  = useNavigate();
  const isTeacher = ROLE_LEVEL[user?.role] >= ROLE_LEVEL['CLASS_ADMIN'];

  const [tab, setTab]               = useState('words');
  const [words, setWords]           = useState([]);
  const [categories, setCategories] = useState([{name:'ทั่วไป',count:0}]);
  const [players, setPlayers]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [myBattles, setMyBattles]   = useState([]);
  const [pending, setPending]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [catFilter, setCatFilter]   = useState('');
  const [search, setSearch]         = useState('');
  const [modal, setModal]           = useState(null); // null|'word'|'edit'|'challenge'|'bulk'
  const [editWord, setEditWord]     = useState(null);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const fetchAll = useCallback(async () => {
    try {
      const [wR, cR, sR, bR, pR, plR] = await Promise.allSettled([
        api.get('/vocab/words'),
        api.get('/vocab/categories'),
        api.get('/vocab/stats'),
        api.get('/vocab/battles/my'),
        api.get('/vocab/battles/pending'),
        api.get('/vocab/players'),
      ]);

      if (wR.status  === 'fulfilled') setWords(wR.value.data   || []);
      if (sR.status  === 'fulfilled') setStats(sR.value.data);
      if (bR.status  === 'fulfilled') setMyBattles(bR.value.data || []);
      if (pR.status  === 'fulfilled') setPending(pR.value.data   || []);
      if (plR.status === 'fulfilled') setPlayers(plR.value.data  || []);

      if (cR.status === 'fulfilled') {
        const catsData = cR.value.data || [];
        const hasGeneral = catsData.some(c => c.name === 'ทั่วไป');
        setCategories(hasGeneral ? catsData : [{ name:'ทั่วไป', count:0 }, ...catsData]);
      }

    } catch (err) {
      console.error('VocabBattle fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveWord = async (form) => {
    if (editWord) {
      await api.put(`/vocab/words/${editWord.id}`, form);
      showToast('แก้ไขแล้ว');
    } else {
      await api.post('/vocab/words', form);
      showToast('เพิ่มคำศัพท์แล้ว');
    }
    setEditWord(null);
    await fetchAll();
  };

  const handleDelete = async (id) => {
    if (!confirm('ลบคำศัพท์นี้?')) return;
    await api.delete(`/vocab/words/${id}`);
    showToast('ลบแล้ว');
    await fetchAll();
  };

  const handleChallenge = async (data) => {
    const res = await api.post('/vocab/battles', data);
    showToast('ส่งคำท้าแล้ว! รอคู่ต่อสู้ตอบรับ ⚔️');
    await fetchAll();
    return res.data;
  };

  const handleBulkImport = async (words, category) => {
    await api.post('/vocab/words/bulk', { words, category });
    showToast(`นำเข้า ${words.length} คำแล้ว ✅`);
    await fetchAll();
  };

  const handleRespond = async (battleId, action) => {
    const res = await api.put(`/vocab/battles/${battleId}/respond`, { action });
    if (action === 'accept') {
      navigate(`/vocab-battle/${battleId}`);
    } else {
      showToast('ปฏิเสธคำท้าแล้ว');
      await fetchAll();
    }
  };

  const filtered = words
    .filter(w => !catFilter || w.category === catFilter)
    .filter(w => !search || w.word.toLowerCase().includes(search.toLowerCase()) || w.translation.includes(search));

  const TABS = [
    { id:'words',    label:'📚 คลังคำศัพท์', badge: words.length },
    { id:'battle',   label:'⚔️ ต่อสู้',      badge: pending.length || null },
    { id:'stats',    label:'🏆 สถิติ',        badge: null },
  ];

  return (
    <div className="min-h-screen text-white" style={{background:'linear-gradient(135deg,#0f0c29 0%,#1a1a2e 40%,#16213e 100%)'}}>
      <div className="fixed top-0 left-0 w-96 h-96 rounded-full opacity-10 pointer-events-none" style={{background:'radial-gradient(circle,#ef4444,transparent)',filter:'blur(100px)'}}/>
      <div className="fixed bottom-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none" style={{background:'radial-gradient(circle,#7c3aed,transparent)',filter:'blur(100px)'}}/>

      {/* Toast */}
      {toast && <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-lg border ${toast.type==='error'?'bg-red-500/20 text-red-300 border-red-500/30':'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>{toast.msg}</div>}

      {/* Nav */}
      <nav className="px-6 py-3 flex items-center gap-4 border-b border-white/10 sticky top-0 z-30" style={{background:'rgba(15,12,41,0.85)',backdropFilter:'blur(16px)'}}>
        <button onClick={()=>navigate('/dashboard')} className="text-white/40 hover:text-white transition-colors text-lg">←</button>
        <div>
          <h1 className="font-bold text-white text-base leading-none">⚔️ Vocab Battle</h1>
          <p className="text-xs text-white/30 mt-0.5">ทายคำศัพท์ — แข่งขันกับเพื่อน</p>
        </div>
        <div className="ml-auto flex gap-2">
          {pending.length > 0 && (
            <button onClick={()=>setTab('battle')} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white animate-pulse"
              style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>
              ⚔️ มีคำท้า {pending.length} รายการ!
            </button>
          )}
          <button onClick={()=>setModal('challenge')} className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>
            ⚔️ ท้าต่อสู้
          </button>
          {isTeacher && (
            <>
              <button onClick={()=>setModal('bulk')} className="px-4 py-2 rounded-xl text-sm border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">
                📋 นำเข้า
              </button>
              <button onClick={()=>{setEditWord(null);setModal('word');}} className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)'}}>
                + คำศัพท์
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Tabs */}
      <div className="border-b border-white/10" style={{background:'rgba(15,12,41,0.5)'}}>
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pt-2">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${tab===t.id?'text-white border-purple-500 bg-white/5':'text-white/40 border-transparent hover:text-white'}`}>
              {t.label}
              {t.badge ? <span className={`px-1.5 py-0.5 rounded-full text-xs ${t.id==='battle'?'bg-red-500 text-white':'bg-white/10 text-white/50'}`}>{t.badge}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {loading ? <div className="flex items-center justify-center h-64 text-white/30">กำลังโหลด...</div> :

        tab === 'words' ? (
          /* ═══ Words Tab ═══ */
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex gap-1 flex-wrap">
                <button onClick={()=>setCatFilter('')} className={`px-3 py-1.5 rounded-xl text-xs ${!catFilter?'bg-purple-600 text-white':'bg-white/5 text-white/40 hover:text-white border border-white/10'}`}>ทั้งหมด ({words.length})</button>
                {categories.filter(c=>c.count>0||c.name==='ทั่วไป').map(c=>(
                  <button key={c.name} onClick={()=>setCatFilter(c.name===catFilter?'':c.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs ${catFilter===c.name?'bg-purple-600 text-white':'bg-white/5 text-white/40 hover:text-white border border-white/10'}`}>
                    {c.name} {c.count>0?`(${c.count})`:''}
                  </button>
                ))}
              </div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..."
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400 placeholder-white/20 ml-auto w-48"/>
            </div>

            {!filtered.length ? (
              <div className="flex flex-col items-center justify-center h-48 text-white/30 gap-3">
                <span className="text-4xl">📚</span>
                <p>{isTeacher ? 'ยังไม่มีคำศัพท์ กด "+ คำศัพท์" เพื่อเริ่ม' : 'ยังไม่มีคำศัพท์'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(w => (
                  <div key={w.id} className="rounded-2xl p-4 border border-white/10 group hover:border-white/20 transition-all"
                    style={{background:'rgba(255,255,255,0.05)'}}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-base">{w.word}</p>
                        <p className="text-purple-300 text-sm mt-0.5">{w.translation}</p>
                        {w.hint && <p className="text-white/30 text-xs mt-1">💡 {w.hint}</p>}
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/30 border border-white/8">{w.category}</span>
                      </div>
                      {isTeacher && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={()=>{setEditWord(w);setModal('edit');}} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10">✏️</button>
                          <button onClick={()=>handleDelete(w.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10">🗑️</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : tab === 'battle' ? (
          /* ═══ Battle Tab ═══ */
          <div className="space-y-5">
            {/* Pending challenges */}
            {pending.length > 0 && (
              <div className="rounded-2xl border border-red-500/30 overflow-hidden" style={{background:'rgba(239,68,68,0.05)'}}>
                <div className="px-5 py-3 border-b border-white/10">
                  <h3 className="font-semibold text-red-300 flex items-center gap-2">⚔️ คำท้าที่รอการตอบรับ</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {pending.map(b => (
                    <div key={b.id} className="px-5 py-4 flex items-center gap-4">
                      <div className="text-3xl">⚔️</div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{b.challenger.name} ท้าคุณ!</p>
                        <p className="text-xs text-white/40">{b.category||'ทุกหมวด'} · {b.max_rounds} รอบ · {fmtDate(b.created_at)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={()=>handleRespond(b.id,'accept')}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>
                          ⚔️ รับคำท้า!
                        </button>
                        <button onClick={()=>handleRespond(b.id,'decline')}
                          className="px-3 py-2 rounded-xl text-xs text-white/40 border border-white/10 hover:bg-white/5">
                          ปฏิเสธ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Battle history */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{background:'rgba(255,255,255,0.04)'}}>
              <div className="px-5 py-3 border-b border-white/10">
                <h3 className="font-semibold text-white">📜 ประวัติการต่อสู้</h3>
              </div>
              {!myBattles.length ? (
                <div className="py-12 text-center text-white/30">ยังไม่เคยต่อสู้</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {myBattles.map(b => {
                    const isMe = user.id;
                    const isChal = b.challenger_id === isMe;
                    const opponent = isChal ? b.opponent : b.challenger;
                    const won = b.winner_id === isMe;
                    return (
                      <div key={b.id} className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/5"
                        onClick={()=>b.status==='ACTIVE'&&navigate(`/vocab-battle/${b.id}`)}>
                        <div className="text-2xl">{b.status==='ACTIVE'?'⚔️':won?'🏆':'💀'}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">vs {opponent?.name}</p>
                          <p className="text-xs text-white/40">{b.category||'ทุกหมวด'} · {b.rounds_played}/{b.max_rounds} รอบ · {fmtDate(b.created_at)}</p>
                        </div>
                        <div className="text-right">
                          {b.status==='ACTIVE' && <button className="px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>▶ เข้าต่อสู้!</button>}
                          {b.status==='FINISHED' && <span className={`px-2 py-1 rounded-full text-xs font-bold ${won?'bg-emerald-500/20 text-emerald-300':'bg-red-500/20 text-red-300'}`}>{won?'ชนะ':'แพ้'}</span>}
                          {b.status==='DECLINED' && <span className="text-xs text-white/30">ปฏิเสธ</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ═══ Stats Tab ═══ */
          <div className="space-y-5">
            {/* My stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {label:'ชนะ',value:stats?.myStats?.wins||0,color:'#10b981',icon:'🏆'},
                {label:'แพ้', value:stats?.myStats?.losses||0,color:'#ef4444',icon:'💀'},
                {label:'Win rate',value:stats?.myStats?.wins+stats?.myStats?.losses>0?Math.round((stats?.myStats?.wins||0)/((stats?.myStats?.wins||0)+(stats?.myStats?.losses||0))*100)+'%':'—',color:'#a78bfa',icon:'📊'},
                {label:'Best Combo',value:stats?.myStats?.best_combo||0,color:'#f59e0b',icon:'🔥'},
              ].map((s,i) => (
                <div key={i} className="rounded-2xl p-4 border border-white/10 text-center" style={{background:'rgba(255,255,255,0.05)'}}>
                  <p className="text-2xl mb-1">{s.icon}</p>
                  <p className="text-xl font-bold" style={{color:s.color}}>{s.value}</p>
                  <p className="text-xs text-white/40">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Leaderboard */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{background:'rgba(255,255,255,0.04)'}}>
              <div className="px-5 py-3 border-b border-white/10">
                <h3 className="font-semibold text-white">🏆 อันดับผู้ชนะ</h3>
              </div>
              {!stats?.topPlayers?.length ? (
                <div className="py-12 text-center text-white/30">ยังไม่มีสถิติ</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {stats.topPlayers.map((p, i) => (
                    <div key={p.id} className={`px-5 py-3 flex items-center gap-3 ${p.user_id===user.id?'bg-purple-500/10':''}`}>
                      <span className="text-lg w-8 text-center">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${p.user_id===user.id?'text-purple-300':'text-white'}`}>
                          {p.user?.name} {p.user_id===user.id&&'(คุณ)'}
                        </p>
                        <p className="text-xs text-white/30">Best Combo: {p.best_combo}🔥</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">{p.wins}W</p>
                        <p className="text-xs text-red-400">{p.losses}L</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {(modal==='word'||modal==='edit') && (
        <WordModal initial={editWord} categories={categories} onClose={()=>{setModal(null);setEditWord(null);}} onSave={handleSaveWord}/>
      )}
      {modal==='challenge' && (
        <ChallengeModal currentUserId={user?.id} onClose={()=>setModal(null)} onChallenge={handleChallenge}/>
      )}
      {modal==='bulk' && (
        <BulkModal categories={categories} onClose={()=>setModal(null)} onSave={handleBulkImport}/>
      )}
    </div>
  );
};

export default VocabBattle;
