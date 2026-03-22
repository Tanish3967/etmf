import { useState } from 'react';
import api from '../api';
import { Lock, User } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('e.vasquez@pharma.com');
  const [password, setPassword] = useState('Admin1234!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/auth/login', { email, password });
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw' }}>
      <div className="glass-panel" style={{ width: '400px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'var(--accent-blue)', fontSize: '28px', marginBottom: '8px' }}>eTMF Pro</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Clinical Quality Engine</p>
        </div>

        {error && (
          <div style={{ padding: '12px', background: 'var(--sla-red)', color: 'var(--sla-red-text)', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-secondary)' }} />
            <input 
              type="email" 
              className="input-field" 
              style={{ paddingLeft: '44px' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required 
            />
          </div>
          
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-secondary)' }} />
            <input 
              type="password" 
              className="input-field" 
              style={{ paddingLeft: '44px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required 
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '8px', padding: '12px' }}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
        
        <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Protected by 21 CFR Part 11 MFA Protocol.
        </p>
      </div>
    </div>
  );
}
