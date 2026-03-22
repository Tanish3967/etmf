import { useState, useEffect } from 'react';
import api from '../api';
import { Activity, BrainCircuit, RefreshCw } from 'lucide-react';

export default function AIGovernance() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGovernance() {
      try {
        const res = await api.get('/ai/governance');
        setMetrics(res.data);
      } catch (err) {
        console.error('Failed to fetch governance stats', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGovernance();
  }, []);

  const handleRetrain = async (artifactCode) => {
    try {
      await api.post('/ai/governance/retrain', { artifact_code: artifactCode, reason: 'Manual Bias Retraining Trigger' });
      alert(`Model retraining queued for artifact: ${artifactCode}`);
    } catch (err) {
      alert('Failed to trigger retraining pipeline.');
    }
  };

  if (loading) return <div className="animate-in" style={{ textAlign: 'center', marginTop: '40px' }}>Loading AI Telemetry...</div>;

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1>AI Governance & Bias Monitoring</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Tracking semantic drift and manual NLP overrides.</p>
        </div>
        <div style={{ padding: '8px 16px', borderRadius: '8px', background: metrics?.monitoringStatus.includes('Healthy') ? 'var(--sla-green)' : 'var(--sla-red)', color: metrics?.monitoringStatus.includes('Healthy') ? 'var(--sla-green-text)' : 'var(--sla-red-text)', fontWeight: 600 }}>
          {metrics?.monitoringStatus || 'Unknown'} Status
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'Total Vector Audits', value: metrics?.governanceMetrics.totalPredictions, icon: BrainCircuit },
          { label: 'Manual Overrides', value: metrics?.governanceMetrics.overriddenClassifications, icon: Activity },
          { label: 'Override Drift Rate', value: `${metrics?.governanceMetrics.overrideRate}%`, color: 'var(--sla-red-text)' },
          { label: 'Avg AI Confidence', value: `${metrics?.governanceMetrics.averageConfidence}%`, color: 'var(--accent-blue)' }
        ].map((stat, i) => (
          <div key={i} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
            <span style={{ fontSize: '32px', fontWeight: 600, color: stat.color || 'white' }}>{stat.value || 0}</span>
          </div>
        ))}
      </div>

      <h2>Artifact Bias Alerts (Top 10 Overrides)</h2>
      <div className="glass-panel" style={{ padding: '0' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Artifact Node</th>
              <th>Prediction Occurrences</th>
              <th>Human Correction Count</th>
              <th>Bias Drift Percentage</th>
              <th>Calibrate Model</th>
            </tr>
          </thead>
          <tbody>
            {(metrics?.artifactAlerts || []).map((alert) => (
              <tr key={alert.suggested_code}>
                <td style={{ fontWeight: 500 }}>{alert.suggested_code}</td>
                <td>{alert.occurrences}</td>
                <td>{alert.override_count}</td>
                <td style={{ color: 'var(--sla-red-text)', fontWeight: 500 }}>{alert.biasPercentage}%</td>
                <td>
                  <button onClick={() => handleRetrain(alert.suggested_code)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={12} /> Retrain
                  </button>
                </td>
              </tr>
            ))}
            {(metrics?.artifactAlerts || []).length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>No bias alerts detected in the data stream.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
