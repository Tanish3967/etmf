import { useState, useEffect } from 'react';
import api from '../api';
import { Search, FileText, Download } from 'lucide-react';

export default function DocumentBrowser() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await api.get('/documents?studyId=study-001');
        setDocuments(res.data.documents || []);
      } catch (err) {
        console.error('Failed to fetch documents', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDocs();
  }, []);

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || 
    d.artifact_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1>TMF Repository / DIA Index</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Browse all clinical artifacts for Study: TRIAL-2024-001</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={16} /> Export TMF Bundle
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={18} style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-secondary)' }} />
        <input 
          type="text" 
          className="input-field" 
          placeholder="Search by title or artifact code (e.g., TMF-01.02.001)..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '44px' }}
        />
      </div>

      <div className="glass-panel" style={{ padding: '0' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Artifact Code</th>
              <th>Title</th>
              <th>Zone / Section</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>Loading TMF index...</td></tr>
            ) : filteredDocs.map((doc) => (
              <tr key={doc.id} style={{ cursor: 'pointer' }}>
                <td style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, color: 'var(--accent-blue)' }}>
                  <FileText size={16} /> {doc.artifact_code}
                </td>
                <td>{doc.title}</td>
                <td>{doc.zoneLabel} <span style={{color:'var(--text-secondary)'}}>→</span> {doc.sectionLabel}</td>
                <td>v{doc.version}</td>
                <td>
                  <span className={`sla-badge ${doc.status === 'Approved' ? 'sla-green' : 'sla-amber'}`}>
                    {doc.status}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && filteredDocs.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>No documents found matching "{search}"</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
