import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';

export default function StickyNotesModal({ doc, onClose }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [showReviewer, setShowReviewer] = useState(true);
  const [showApprover, setShowApprover] = useState(true);
  const [showViewer, setShowViewer] = useState(false);
  const [showSignoff, setShowSignoff] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(true);
  const [noteToFile, setNoteToFile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!doc?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/documents/${doc.id}`);
      setNotes(res.data.annotations || []);
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setLoading(false);
    }
  }, [doc]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const scopeFlags = [
        showReviewer && 'Reviewer',
        showApprover && 'Approver',
        showViewer && 'Viewer',
        showSignoff && 'Signoff',
        noteToFile && 'NoteToFile',
        showAllVersions && 'AllVersions',
      ].filter(Boolean).join(',');

      await api.post(`/documents/${doc.id}/annotations`, {
        annotation_type: `StickyNote[${scopeFlags}]`,
        annotation_text: text.trim(),
        page_number: 1,
      });
      setText('');
      await fetchNotes();
    } catch (err) {
      alert('Failed to add note: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!confirm('Are you sure you want to delete this sticky note?')) return;
    try {
      await api.delete(`/documents/${doc.id}/annotations/${noteId}`);
      await fetchNotes();
    } catch (err) {
      alert('Failed to delete note: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: 620, maxHeight: '90vh', background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>📝 Sticky Notes &amp; Comments (§8.10.18)</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Target: <strong>{doc?.title}</strong> ({doc?.id})</div>
          </div>
          <span style={{ cursor: 'pointer', fontSize: 18, color: '#94a3b8' }} onClick={onClose}>✕</span>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Notes List */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Active Notes &amp; Messages ({notes.length})</div>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Loading notes...</div>
            ) : notes.length === 0 ? (
              <div style={{ background: '#f8fafc', padding: 20, textAlign: 'center', borderRadius: 8, color: '#94a3b8', fontSize: 13 }}>
                No sticky notes recorded for this document. Add a note below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map(n => (
                  <div key={n.id} style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: 14, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#854d0e' }}>📌 {n.user_name || 'Author / Reviewer'}</span>
                      <span style={{ fontSize: 11, color: '#a16207' }}>{n.created_at}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#713f12', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.annotation_text}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTop: '1px dashed #fde047', paddingTop: 6 }}>
                      <span style={{ fontSize: 10, color: '#854d0e', fontStyle: 'italic' }}>{n.annotation_type}</span>
                      <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New Note Form */}
          <form onSubmit={handleAddNote} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Add New Sticky Note</div>
            <textarea
              className="modern-input"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter note or instruction for team members..."
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 12, color: '#475569' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showReviewer} onChange={(e) => setShowReviewer(e.target.checked)} />
                Show to Reviewer
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showApprover} onChange={(e) => setShowApprover(e.target.checked)} />
                Show to Approver
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showViewer} onChange={(e) => setShowViewer(e.target.checked)} />
                Show to Viewer
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showSignoff} onChange={(e) => setShowSignoff(e.target.checked)} />
                Show to Signoff Users
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showAllVersions} onChange={(e) => setShowAllVersions(e.target.checked)} />
                Show in all versions
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={noteToFile} onChange={(e) => setNoteToFile(e.target.checked)} />
                Note to file (include in export)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="submit" className="btn-primary" disabled={saving || !text.trim()}>
                {saving ? 'Posting Note...' : '+ Post Sticky Note'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
