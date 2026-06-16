import React, { useContext, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT: 0, PARENT: 0, STAFF: 1, CLASS_ADMIN: 1, TEACHER: 2, ADMIN: 3, SUPER_USER: 4 };

const ROLE_META = {
  STUDENT:     { label: 'นักเรียน',      color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)'  },
  PARENT:      { label: 'ผู้ปกครอง',     color: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
  CLASS_ADMIN: { label: 'ประธาน',        color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  TEACHER:     { label: 'ครู',           color: '#7c3aed', bg: 'rgba(124,58,237,0.15)'  },
  ADMIN:       { label: 'Admin',         color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  SUPER_USER:  { label: 'Super User',    color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  STAFF:       { label: 'ทีมงาน',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const fmtShort = (d) =>
  new Date(d).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const StatusBadge = ({ status }) => {
  const styles = {
    PENDING: { bg: 'rgba(251,191,36,0.15)', color: '#fcd34d', border: 'rgba(251,191,36,0.3)', label: '⏳ รอตรวจ' },
    GRADED:  { bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: 'rgba(16,185,129,0.3)', label: '✅ ตรวจแล้ว' },
  };
  const s = styles[status] || styles.PENDING;
  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {s.label}
    </span>
  );
};

/* ── Comment Item ── */
const CommentItem = ({ comment, currentUserId, currentUserRole, onDelete }) => {
  const m = ROLE_META[comment.user.role] || ROLE_META.STUDENT;
  const isOwner = comment.user_id === currentUserId;
  const canDelete = isOwner || ROLE_LEVEL[currentUserRole] >= ROLE_LEVEL['TEACHER'];

  return (
    <div className="flex gap-3 group">
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
        style={{ background: m.bg, color: m.color }}>
        {comment.user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-sm text-white">{comment.user.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: m.bg, color: m.color, fontSize: 10 }}>
            {m.label}
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{fmtShort(comment.created_at)}</span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)', wordBreak: 'break-word' }}>
          {comment.content}
        </p>
      </div>
      {canDelete && (
        <button onClick={() => onDelete(comment.id)}
          className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg flex-shrink-0 self-start transition-opacity"
          style={{ color: 'rgba(239,68,68,0.6)', background: 'rgba(239,68,68,0.08)' }}>
          ✕
        </button>
      )}
    </div>
  );
};

/* ── Main ── */
const AssignmentDetail = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gradeInputs, setGradeInputs] = useState({});
  const [gradingId, setGradingId] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Comments
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentEndRef = useRef(null);

  const isTeacher = ROLE_LEVEL[user?.role] >= ROLE_LEVEL['CLASS_ADMIN'];

  const loadAssignment = async () => {
    try {
      const res = await api.get(`/assignments/${id}`);
      setAssignment(res.data);
    } catch {
      setError('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const res = await api.get(`/assignments/${id}/comments`);
      setComments(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadAssignment();
    loadComments();
  }, [id]);

  const mySubmission = user?.role === 'STUDENT' ? assignment?.submissions?.[0] : null;

  const handleSubmit = async () => {
    setSubmitting(true); setMsg('');
    try {
      await api.post(`/assignments/${id}/submit`, {});
      setMsg('ส่งการบ้านสำเร็จ! 🎉');
      await loadAssignment();
    } catch (err) {
      setMsg(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSubmitting(false); }
  };

  const handleGrade = async (submissionId) => {
    const score = gradeInputs[submissionId];
    if (score === undefined || score === '') return;
    setGradingId(submissionId);
    try {
      await api.put(`/assignments/${id}/submissions/${submissionId}/grade`, { score_given: score });
      setMsg('ให้คะแนนสำเร็จ ✅');
      await loadAssignment();
    } catch (err) {
      setMsg(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setGradingId(null); }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      const res = await api.post(`/assignments/${id}/comments`, { content: commentText.trim() });
      setComments(prev => [...prev, res.data]);
      setCommentText('');
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      alert(err.response?.data?.message || 'ส่ง comment ไม่สำเร็จ');
    } finally { setSendingComment(false); }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('ลบ comment นี้?')) return;
    try {
      await api.delete(`/assignments/${id}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* ignore */ }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg,#0a0018,#0f0c29,#0a1628)' }}>
      <div className="text-white/40 text-sm animate-pulse">กำลังโหลด...</div>
    </div>
  );

  if (error || !assignment) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg,#0a0018,#0f0c29,#0a1628)' }}>
      <div className="text-red-400 text-sm">{error || 'ไม่พบการบ้านนี้'}</div>
    </div>
  );

  const isOverdue = new Date(assignment.due_date) < new Date();

  return (
    <div className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg,#0a0018 0%,#0f0c29 40%,#0a1628 100%)' }}>

      {/* Ambient */}
      <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none opacity-5"
        style={{ background: 'radial-gradient(circle,#7c3aed,transparent)', filter: 'blur(80px)' }}/>

      {/* Navbar */}
      <nav className="px-6 py-4 flex items-center gap-3 border-b sticky top-0 z-20"
        style={{ background: 'rgba(10,0,24,0.85)', backdropFilter: 'blur(16px)', borderColor: 'rgba(124,58,237,0.2)' }}>
        <button onClick={() => navigate('/assignments')}
          className="text-white/50 hover:text-white transition-colors text-sm">
          ← การบ้าน
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
        <h1 className="text-sm font-semibold text-white/70 truncate">{assignment.title}</h1>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── Assignment Info Card ── */}
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(124,58,237,0.25)', backdropFilter: 'blur(14px)' }}>

          {/* Header gradient strip */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg,#7c3aed,#db2777,#0ea5e9)' }}/>

          <div className="p-6">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xs font-bold tracking-widest" style={{ color: '#8b5cf6', fontSize: 9, letterSpacing: 3 }}>
                📋 MISSION
              </span>
              {assignment.homework_type && (
                <span className="text-xs px-2 py-0.5 rounded-full border"
                  style={{ background: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}>
                  🗂️ {assignment.homework_type}
                </span>
              )}
              {assignment.submit_location && (
                <span className="text-xs px-2 py-0.5 rounded-full border"
                  style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
                  📍 {assignment.submit_location}
                </span>
              )}
              {isOverdue && (
                <span className="text-xs px-2 py-0.5 rounded-full border animate-pulse"
                  style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' }}>
                  ⚠ เกินกำหนด
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 leading-snug">{assignment.title}</h2>
            {assignment.description && (
              <p className="text-sm mb-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {assignment.description}
              </p>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '👤', label: 'ผู้มอบหมาย', value: assignment.teacher?.name },
                { icon: '🏆', label: 'คะแนนเต็ม', value: `${assignment.max_score} คะแนน${assignment.bonus_points > 0 ? ` (+${assignment.bonus_points}⭐)` : ''}` },
                assignment.start_date && { icon: '📅', label: 'เปิดรับ', value: fmtDate(assignment.start_date) },
                { icon: '⏰', label: 'กำหนดส่ง', value: fmtDate(assignment.due_date), overdue: isOverdue },
              ].filter(Boolean).map((item, i) => (
                <div key={i} className="px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.icon} {item.label}</p>
                  <p className="text-sm font-medium" style={{ color: item.overdue ? '#f87171' : 'rgba(255,255,255,0.85)' }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feedback message */}
        {msg && (
          <div className={`p-3 rounded-xl text-sm border ${msg.includes('สำเร็จ') || msg.includes('✅')
            ? 'bg-green-400/10 border-green-400/30 text-green-300'
            : 'bg-red-400/10 border-red-400/30 text-red-300'}`}>
            {msg}
          </div>
        )}

        {/* STUDENT: Submit Section */}
        {user?.role === 'STUDENT' && (
          <div className="rounded-2xl p-5 border"
            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)' }}>
            <h3 className="font-semibold text-white mb-4 text-sm">สถานะของคุณ</h3>
            {!mySubmission ? (
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>คุณยังไม่ได้ส่งการบ้านนี้</p>
                <button onClick={handleSubmit} disabled={submitting}
                  className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                  {submitting ? 'กำลังส่ง...' : '📤 ส่งการบ้าน'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <StatusBadge status={mySubmission.status} />
                  <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    ส่งเมื่อ {fmtDate(mySubmission.submitted_at)}
                  </p>
                </div>
                {mySubmission.status === 'GRADED' && (
                  <div className="text-right">
                    <p className="text-4xl font-bold" style={{ color: '#34d399' }}>{mySubmission.score_given}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>/ {assignment.max_score} คะแนน</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submissions Section — ทุก role เห็น */}
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)' }}>

          <div className="px-5 py-4 border-b flex items-center justify-between"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h3 className="font-semibold text-white text-sm">👥 งานที่ส่งมา</h3>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${assignment.totalStudents > 0 ? Math.round((assignment.submissions?.length / assignment.totalStudents) * 100) : 0}%`,
                    background: 'linear-gradient(90deg,#7c3aed,#db2777)',
                  }}/>
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {assignment.submissions?.length || 0}/{assignment.totalStudents || 0} คน
              </span>
            </div>
          </div>

          <div className="p-5">
            {!assignment.submissions?.length ? (
              <p className="text-center py-4 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>ยังไม่มีนักเรียนส่งงาน</p>
            ) : (
              <div className="space-y-2">
                {assignment.submissions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
                        {(sub.student?.name || '?').charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{sub.student?.name}</p>
                        {sub.student?.student_number && (
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {sub.student.student_number}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTeacher ? (
                        <>
                          <StatusBadge status={sub.status} />
                          {sub.status === 'GRADED' && (
                            <span className="text-sm font-bold" style={{ color: '#34d399' }}>
                              {sub.score_given}/{assignment.max_score}
                            </span>
                          )}
                          {sub.status === 'PENDING' && user?.role === 'TEACHER' && (
                            <div className="flex items-center gap-1.5">
                              <input type="number" min="0" max={assignment.max_score}
                                placeholder={`0-${assignment.max_score}`}
                                value={gradeInputs[sub.id] || ''}
                                onChange={(e) => setGradeInputs({ ...gradeInputs, [sub.id]: e.target.value })}
                                className="w-20 px-2 py-1.5 rounded-lg text-white text-sm focus:outline-none"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}/>
                              <button onClick={() => handleGrade(sub.id)} disabled={gradingId === sub.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 hover:scale-105 transition-all"
                                style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                                {gradingId === sub.id ? '...' : 'ให้คะแนน'}
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)' }}>
                          ✅ ส่งแล้ว
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Comment Section ── */}
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)' }}>

          <div className="px-5 py-4 border-b flex items-center justify-between"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h3 className="font-semibold text-white text-sm">💬 ความคิดเห็น</h3>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              {comments.length} รายการ
            </span>
          </div>

          {/* Comment list */}
          <div className="px-5 py-4 space-y-4 max-h-96 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-center py-6 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                ยังไม่มีความคิดเห็น — เป็นคนแรกที่แสดงความคิดเห็น!
              </p>
            ) : (
              comments.map(c => (
                <CommentItem key={c.id} comment={c}
                  currentUserId={user?.id}
                  currentUserRole={user?.role}
                  onDelete={handleDeleteComment}/>
              ))
            )}
            <div ref={commentEndRef}/>
          </div>

          {/* Comment input */}
          <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <form onSubmit={handleSendComment} className="flex gap-3 items-end">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{
                  background: (ROLE_META[user?.role] || ROLE_META.STUDENT).bg,
                  color: (ROLE_META[user?.role] || ROLE_META.STUDENT).color,
                }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 relative">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(e); } }}
                  placeholder="แสดงความคิดเห็น... (Enter เพื่อส่ง)"
                  rows={1}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm resize-none focus:outline-none placeholder-white/20"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    minHeight: 44, maxHeight: 120,
                  }}
                />
              </div>
              <button type="submit" disabled={sendingComment || !commentText.trim()}
                className="px-4 py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-40 transition-all hover:scale-105 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                {sendingComment ? '...' : 'ส่ง'}
              </button>
            </form>
          </div>
        </div>

      </main>
    </div>
  );
};

export default AssignmentDetail;
