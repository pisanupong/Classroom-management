import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT: 0, TEACHER: 1, ADMIN: 2, SUPER_USER: 3 };
const ROLE_COLOR = { STUDENT: '#0ea5e9', TEACHER: '#7c3aed', ADMIN: '#f59e0b', SUPER_USER: '#ef4444' };
const ROLE_LABEL = { STUDENT: 'นักเรียน', TEACHER: 'ครู', ADMIN: 'Admin', SUPER_USER: '👑 Super' };

const formatTime = (d) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const formatDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

/* ── Mini avatar (pixel art or initial) ───────────────────────────────────── */
const MiniAvatar = ({ user, size = 32 }) => {
  const cd = user?.character_data;
  if (cd?.grid) {
    const CW = cd.grid.length === 32*48 ? 32 : 16;
    const CH = CW === 32 ? 48 : 24;
    const S = size / CW;
    return (
      <div style={{ width: size, height: size, flexShrink: 0, overflow: 'hidden', borderRadius: 4 }}>
        <svg width={CW*S} height={CH*S} style={{ imageRendering: 'pixelated' }}>
          {cd.grid.slice(0, CW * Math.floor(CW)).map((c, i) => {
            if (!c) return null;
            const x = i % CW, y = Math.floor(i / CW);
            if (y >= CW) return null;
            return <rect key={i} x={x*S} y={y*S} width={S} height={S} fill={c} />;
          })}
        </svg>
      </div>
    );
  }
  const color = ROLE_COLOR[user?.role] || '#7c3aed';
  return (
    <div style={{ width: size, height: size, borderRadius: 4, background: `linear-gradient(135deg,${color},${color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: size * 0.4, color: '#fff', flexShrink: 0 }}>
      {user?.name?.charAt(0)?.toUpperCase()}
    </div>
  );
};

/* ── Create Channel Modal ─────────────────────────────────────────────────── */
const CreateChannelModal = ({ onClose, onCreate }) => {
  const [form, setForm] = useState({ name: '', description: '', type: 'TEXT' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr(''); setSaving(true);
    try { await onCreate(form); onClose(); }
    catch (e) { setErr(e.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6 border border-white/10 text-white"
        style={{ background: 'rgba(22,27,62,0.98)' }}>
        <h3 className="font-bold text-lg mb-4">➕ สร้างห้องสนทนา</h3>
        {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-white/50 block mb-1">ชื่อห้อง *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              placeholder="เช่น general, คณิตศาสตร์"
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20" />
            <p className="text-xs text-white/20 mt-1">ชื่อจะถูกแปลงเป็นตัวเล็กและ - แทนช่องว่าง</p>
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">คำอธิบาย</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="ห้องนี้ใช้สำหรับ..."
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20" />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-2">ประเภทห้อง</label>
            <div className="flex gap-2">
              {[['TEXT','# ข้อความทั่วไป','ทุกคนสามารถส่งข้อความได้'],['ANNOUNCEMENT','📢 ประกาศ','เฉพาะครูส่งข้อความได้']].map(([v,l,d]) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, type: v })}
                  className="flex-1 p-3 rounded-xl text-left transition-all border text-sm"
                  style={{
                    background: form.type === v ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                    borderColor: form.type === v ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                  }}>
                  <p className="font-medium text-white text-xs">{l}</p>
                  <p className="text-white/30 text-xs mt-0.5">{d}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:text-white transition-colors">ยกเลิก</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              {saving ? 'กำลังสร้าง...' : '✨ สร้างห้อง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Main Chat ────────────────────────────────────────────────────────────── */
const Chat = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher = (ROLE_LEVEL[user?.role] ?? 0) >= ROLE_LEVEL['TEACHER'];

  const [channels, setChannels]         = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState('');
  const [onlineUsers, setOnlineUsers]   = useState([]);
  const [typingUsers, setTypingUsers]   = useState([]);
  const [showCreate, setShowCreate]     = useState(false);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [hasMore, setHasMore]           = useState(false);
  const [showMembers, setShowMembers]   = useState(true);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const messagesRef = useRef(null);

  // Init socket
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', { auth: { token } });
    socketRef.current = socket;

    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    socket.on('message_deleted', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted: true } : m));
    });
    socket.on('online_users', setOnlineUsers);
    socket.on('user_typing', ({ userId, name, isTyping }) => {
      setTypingUsers(prev => {
        const filtered = prev.filter(u => u.userId !== userId);
        return isTyping ? [...filtered, { userId, name }] : filtered;
      });
    });

    return () => socket.disconnect();
  }, []);

  // Fetch channels
  useEffect(() => {
    api.get('/chat/channels').then(r => {
      setChannels(r.data);
      if (r.data.length > 0) selectChannel(r.data[0]);
    }).catch(() => {});
  }, []);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectChannel = useCallback(async (ch) => {
    setActiveChannel(ch);
    setMessages([]);
    setLoadingMsgs(true);
    setInput('');
    setTypingUsers([]);
    socketRef.current?.emit('join_channel', ch.id);
    try {
      const r = await api.get(`/chat/channels/${ch.id}/messages`, { params: { limit: 50 } });
      setMessages(r.data);
      setHasMore(r.data.length === 50);
    } catch { /* ignore */ }
    setLoadingMsgs(false);
  }, []);

  const loadMore = async () => {
    if (!activeChannel || !messages.length) return;
    const oldest = messages[0];
    try {
      const r = await api.get(`/chat/channels/${activeChannel.id}/messages`, { params: { before: oldest.id, limit: 50 } });
      setMessages(prev => [...r.data, ...prev]);
      setHasMore(r.data.length === 50);
    } catch { /* ignore */ }
  };

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!input.trim() || !activeChannel || !socketRef.current) return;
    socketRef.current.emit('send_message', { channelId: activeChannel.id, content: input.trim() });
    setInput('');
    socketRef.current.emit('typing', { channelId: activeChannel.id, isTyping: false });
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!activeChannel) return;
    socketRef.current?.emit('typing', { channelId: activeChannel.id, isTyping: e.target.value.length > 0 });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('typing', { channelId: activeChannel.id, isTyping: false });
    }, 2000);
  };

  const deleteMessage = (msgId) => {
    if (!activeChannel) return;
    socketRef.current?.emit('delete_message', { channelId: activeChannel.id, messageId: msgId });
  };

  const handleCreateChannel = async (form) => {
    const r = await api.post('/chat/channels', form);
    setChannels(prev => [...prev, r.data]);
    selectChannel(r.data);
  };

  const handleDeleteChannel = async (chId) => {
    if (!confirm('ลบห้องนี้และข้อความทั้งหมด?')) return;
    await api.delete(`/chat/channels/${chId}`);
    setChannels(prev => prev.filter(c => c.id !== chId));
    if (activeChannel?.id === chId) { setActiveChannel(null); setMessages([]); }
  };

  // Group messages by date + consecutive sender
  const groupedMessages = [];
  messages.filter(m => !m.deleted).forEach((msg, i) => {
    const prev = messages.filter(m => !m.deleted)[i - 1];
    const sameUser = prev && prev.user_id === msg.user_id && (new Date(msg.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000;
    const sameDay = prev && formatDate(prev.created_at) === formatDate(msg.created_at);
    groupedMessages.push({ ...msg, compact: sameUser, showDate: !sameDay || i === 0 });
  });

  const canSend = activeChannel && (activeChannel.type === 'TEXT' || isTeacher);

  return (
    <div className="fixed inset-0 flex text-white overflow-hidden" style={{ background: '#1e1f2e' }}>

      {/* ── Left: Channel sidebar ── */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-white/5" style={{ background: '#16172a' }}>
        {/* Server header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm text-white">🏫 Classroom</p>
            <p className="text-xs text-white/30">กระดานสนทนา</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className="text-white/30 hover:text-white transition-colors text-lg" title="Dashboard">⌂</button>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-1 flex items-center justify-between">
            <span className="text-xs text-white/30 font-semibold uppercase tracking-wide">ห้องสนทนา</span>
            {isTeacher && (
              <button onClick={() => setShowCreate(true)} className="text-white/30 hover:text-white transition-colors text-lg leading-none" title="สร้างห้อง">+</button>
            )}
          </div>

          {channels.map(ch => {
            const isActive = activeChannel?.id === ch.id;
            const icon = ch.type === 'ANNOUNCEMENT' ? '📢' : '#';
            return (
              <div key={ch.id}
                className={`group mx-2 mb-0.5 px-2 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-all ${isActive ? 'text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                style={isActive ? { background: 'rgba(124,58,237,0.3)' } : {}}
                onClick={() => selectChannel(ch)}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm flex-shrink-0">{icon}</span>
                  <span className="text-sm truncate">{ch.name}</span>
                </div>
                {isTeacher && (
                  <button onClick={e => { e.stopPropagation(); handleDeleteChannel(ch.id); }}
                    className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all text-xs px-1">
                    🗑️
                  </button>
                )}
              </div>
            );
          })}

          {channels.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-white/20 text-xs">ยังไม่มีห้อง</p>
              {isTeacher && <button onClick={() => setShowCreate(true)} className="text-purple-400 text-xs mt-2 hover:text-purple-300">+ สร้างห้องแรก</button>}
            </div>
          )}
        </div>

        {/* User info at bottom */}
        <div className="px-3 py-2 border-t border-white/5 flex items-center gap-2">
          <MiniAvatar user={user} size={28} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs" style={{ color: ROLE_COLOR[user?.role] }}>{ROLE_LABEL[user?.role]}</p>
          </div>
          <button onClick={() => navigate('/character')} className="text-white/20 hover:text-white/60 transition-colors" title="แก้ตัวละคร">🎨</button>
        </div>
      </div>

      {/* ── Center: Messages ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-white/30">เลือกห้องสนทนาทางซ้าย</p>
            </div>
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0"
              style={{ background: '#1e1f2e' }}>
              <div className="flex items-center gap-2">
                <span className="text-white/50">{activeChannel.type === 'ANNOUNCEMENT' ? '📢' : '#'}</span>
                <span className="font-semibold text-white">{activeChannel.name}</span>
                {activeChannel.description && <span className="text-white/30 text-sm">— {activeChannel.description}</span>}
                {activeChannel.type === 'ANNOUNCEMENT' && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">ประกาศ</span>}
              </div>
              <button onClick={() => setShowMembers(v => !v)} className="text-white/30 hover:text-white transition-colors text-sm">
                👥 {onlineUsers.length}
              </button>
            </div>

            {/* Messages area */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5"
              style={{ background: '#1e1f2e' }}>

              {hasMore && (
                <div className="text-center py-2">
                  <button onClick={loadMore} className="text-xs text-white/30 hover:text-white/60 transition-colors">โหลดข้อความเก่า</button>
                </div>
              )}

              {loadingMsgs ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <p className="text-white/30 text-sm">กำลังโหลด...</p>
                </div>
              ) : groupedMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">👋</p>
                  <p className="text-white/30 text-sm">เริ่มการสนทนาในห้อง #{activeChannel.name}</p>
                </div>
              ) : (
                groupedMessages.map((msg) => {
                  const canDelete = user?.id === msg.user_id || isTeacher;
                  return (
                    <div key={msg.id}>
                      {msg.showDate && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-white/10" />
                          <span className="text-xs text-white/30">{formatDate(msg.created_at)}</span>
                          <div className="flex-1 h-px bg-white/10" />
                        </div>
                      )}
                      <div className={`group flex gap-3 px-2 py-0.5 rounded-lg hover:bg-white/5 transition-colors ${msg.compact ? 'mt-0' : 'mt-3'}`}>
                        {/* Avatar */}
                        <div className="w-8 flex-shrink-0 flex items-start justify-center" style={{ paddingTop: msg.compact ? 0 : 2 }}>
                          {!msg.compact && <MiniAvatar user={msg.user} size={32} />}
                        </div>

                        <div className="flex-1 min-w-0">
                          {!msg.compact && (
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="font-semibold text-sm" style={{ color: ROLE_COLOR[msg.user?.role] }}>
                                {msg.user?.name}
                              </span>
                              <span className="text-xs text-white/25">{ROLE_LABEL[msg.user?.role]}</span>
                              <span className="text-xs text-white/20">{formatTime(msg.created_at)}</span>
                            </div>
                          )}
                          <p className="text-sm text-white/80 leading-relaxed break-words">{msg.content}</p>
                        </div>

                        {/* Delete button */}
                        {canDelete && (
                          <button onClick={() => deleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 transition-all text-xs px-1 self-center flex-shrink-0">
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Typing indicator */}
            <div className="px-6 h-5 flex-shrink-0">
              {typingUsers.length > 0 && (
                <p className="text-xs text-white/40 italic">
                  {typingUsers.map(u => u.name).join(', ')} กำลังพิมพ์...
                </p>
              )}
            </div>

            {/* Input */}
            <div className="px-4 pb-4 flex-shrink-0">
              {canSend ? (
                <form onSubmit={sendMessage} className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10"
                    style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <input
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
                      placeholder={`ส่งข้อความไปที่ #${activeChannel.name}`}
                      className="flex-1 bg-transparent text-white text-sm placeholder-white/25 focus:outline-none"
                      maxLength={2000}
                    />
                    <span className="text-xs text-white/20">{input.length}/2000</span>
                  </div>
                  <button type="submit" disabled={!input.trim()}
                    className="px-4 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-30 hover:scale-105 transition-all"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                    ส่ง
                  </button>
                </form>
              ) : (
                <div className="px-4 py-3 rounded-xl border border-white/5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-xs text-white/30">📢 ห้องนี้เฉพาะครูส่งข้อความได้</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Right: Online members ── */}
      {showMembers && (
        <div className="w-44 flex-shrink-0 border-l border-white/5 py-3 overflow-y-auto" style={{ background: '#16172a' }}>
          <p className="px-3 text-xs text-white/30 font-semibold uppercase tracking-wide mb-2">ออนไลน์ — {onlineUsers.length}</p>
          {onlineUsers.map((u, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors">
              <div className="relative flex-shrink-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `linear-gradient(135deg,${ROLE_COLOR[u.role]},${ROLE_COLOR[u.role]}80)`, color: '#fff' }}>
                  {u.name?.charAt(0)}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-[#16172a]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/70 truncate">{u.name}</p>
                <p className="text-xs" style={{ fontSize: 9, color: ROLE_COLOR[u.role] }}>{ROLE_LABEL[u.role]}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateChannelModal onClose={() => setShowCreate(false)} onCreate={handleCreateChannel} />}
    </div>
  );
};

export default Chat;
