import React, { useState } from 'react';
import api from '../../api';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("e.vasquez@pharma.com");
  const [password, setPassword] = useState("Admin1234!");
  const [enterprise, setEnterprise] = useState("AcmeCorp");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await api.post("/auth/login", { email, password });
      onLogin(res.data.user, res.data.token);
    } catch (e) {
      setErr(e.response?.data?.error || "Invalid Credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)' }}>
      <div className="glass-panel" style={{ width: 420, padding: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30, justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #0284c7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20 }}>T</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "#0f172a" }}>eTMF<span style={{ color: "#0284c7" }}>Pro</span></div>
        </div>
        <h2 style={{ fontSize: 16, color: "#475569", marginBottom: 24, textAlign: "center", fontWeight: 500 }}>Secure Access Gateway</h2>

        {err && <div style={{ color: "#dc2626", background: "#fee2e2", padding: "12px 16px", marginBottom: 20, borderRadius: 10, fontSize: 13, border: "1px solid #fca5a5" }}>{err}</div>}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>ENTERPRISE ID</label>
          <input className="modern-input" value={enterprise} onChange={e => setEnterprise(e.target.value)} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>WORK EMAIL</label>
          <input className="modern-input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
            PASSWORD <span style={{ color: "#0ea5e9", cursor: "pointer" }}>Forgot?</span>
          </label>
          <input type="password" className="modern-input" value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        <button onClick={submit} disabled={loading} className="btn-primary" style={{ width: "100%" }}>
          {loading ? "Authenticating Biometrics..." : "Secure Log In"}
        </button>
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#94a3b8" }}>
          Part 11 Compliant Environment
        </div>
      </div>
    </div>
  );
}
