import React, { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const StatusBadge = ({ status }) => {
  const styles = {
    PENDING: 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30',
    GRADED: 'bg-green-400/20 text-green-300 border border-green-400/30',
  };
  const labels = { PENDING: 'รอตรวจ', GRADED: 'ตรวจแล้ว' };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

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

  useEffect(() => { loadAssignment(); }, [id]);

  const mySubmission = user?.role === 'STUDENT'
    ? assignment?.submissions?.[0]
    : null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setMsg('');
    try {
      await api.post(`/assignments/${id}/submit`, {});
      setMsg('ส่งการบ้านสำเร็จ! 🎉');
      await loadAssignment();
    } catch (err) {
      setMsg(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
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
    } finally {
      setGradingId(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-white/50"
      style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      กำลังโหลด...
    </div>
  );

  if (error || !assignment) return (
    <div className="min-h-screen flex items-center justify-center text-red-400"
      style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      {error || 'ไม่พบการบ้านนี้'}
    </div>
  );

  const isOverdue = new Date(assignment.due_date) < new Date();

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <nav className="px-6 py-4 flex items-center gap-3 border-b border-white/10 sticky top-0 z-10"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate('/assignments')} className="text-white/60 hover:text-white transition-colors text-sm">
          ← การบ้าน
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Assignment Card */}
        <div className="rounded-2xl p-6 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
          <h2 className="text-2xl font-bold text-white mb-2">{assignment.title}</h2>
          {assignment.description && (
            <p className="text-white/60 mb-4">{assignment.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-white/50">
            <span>👤 {assignment.teacher?.name}</span>
            <span className={isOverdue ? 'text-red-400' : ''}>
              📅 {new Date(assignment.due_date).toLocaleDateString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
              {isOverdue && ' (เกินกำหนด)'}
            </span>
            <span>🏆 {assignment.max_score} คะแนน</span>
          </div>
        </div>

        {/* Feedback message */}
        {msg && (
          <div className={`p-4 rounded-xl text-sm border ${msg.includes('สำเร็จ') || msg.includes('✅')
            ? 'bg-green-400/10 border-green-400/30 text-green-300'
            : 'bg-red-400/10 border-red-400/30 text-red-300'}`}>
            {msg}
          </div>
        )}

        {/* STUDENT: Submit Section */}
        {user?.role === 'STUDENT' && (
          <div className="rounded-2xl p-6 border border-white/10"
            style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
            <h3 className="font-semibold text-white mb-4">สถานะของคุณ</h3>

            {!mySubmission ? (
              <div>
                <p className="text-white/50 text-sm mb-4">คุณยังไม่ได้ส่งการบ้านนี้</p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
                >
                  {submitting ? 'กำลังส่ง...' : '📤 ส่งการบ้าน'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={mySubmission.status} />
                  </div>
                  <p className="text-xs text-white/40">
                    ส่งเมื่อ {new Date(mySubmission.submitted_at).toLocaleDateString('th-TH', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                {mySubmission.status === 'GRADED' && (
                  <div className="text-right">
                    <p className="text-4xl font-bold text-green-400">{mySubmission.score_given}</p>
                    <p className="text-sm text-white/40">/ {assignment.max_score} คะแนน</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TEACHER: Submissions Section */}
        {user?.role === 'TEACHER' && (
          <div className="rounded-2xl p-6 border border-white/10"
            style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">งานที่ส่งมา</h3>
              <span className="text-sm text-white/40">{assignment.submissions?.length || 0} คน</span>
            </div>

            {!assignment.submissions || assignment.submissions.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">ยังไม่มีนักเรียนส่งงาน</p>
            ) : (
              <div className="space-y-3">
                {assignment.submissions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div>
                      <p className="font-medium text-white text-sm">{sub.student?.name}</p>
                      {sub.student?.student_number && (
                        <p className="text-xs text-white/40">{sub.student.student_number}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={sub.status} />
                        {sub.status === 'GRADED' && (
                          <span className="text-green-400 text-sm font-bold">
                            {sub.score_given}/{assignment.max_score}
                          </span>
                        )}
                      </div>
                    </div>

                    {sub.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={assignment.max_score}
                          placeholder={`0-${assignment.max_score}`}
                          value={gradeInputs[sub.id] || ''}
                          onChange={(e) => setGradeInputs({ ...gradeInputs, [sub.id]: e.target.value })}
                          className="w-24 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"
                        />
                        <button
                          onClick={() => handleGrade(sub.id)}
                          disabled={gradingId === sub.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
                        >
                          {gradingId === sub.id ? '...' : 'ให้คะแนน'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AssignmentDetail;
