import React, { useState } from 'react';
import api from '../../api';

/**
 * 21 CFR Part 11 §3 Password Complexity Validator
 */
export function checkPasswordPolicy(pwd) {
  if (!pwd || typeof pwd !== 'string') {
    return { minLength: false, hasUpper: false, hasLower: false, hasNumber: false, hasSpecial: false, isValid: false };
  }
  const minLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);
  return {
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial
  };
}

export default function LoginScreen({ onLogin, sessionExpiredNotice }) {
  const [email, setEmail] = useState("e.vasquez@pharma.com");
  const [password, setPassword] = useState("Admin1234!");
  const [enterprise, setEnterprise] = useState("AcmeCorp");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lockoutInfo, setLockoutInfo] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(null);

  // MFA Challenge State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  // Mandatory First-Time Password Reset State (must_change_password)
  const [pendingReset, setPendingReset] = useState(null);
  const [resetCurrentPassword, setResetCurrentPassword] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const policy = checkPasswordPolicy(resetNewPassword);

  const submit = async (e) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      setErr("");
      setLockoutInfo(null);
      const res = await api.post("/auth/login", {
        email,
        password,
        mfaCode: mfaRequired ? mfaCode.trim() : undefined
      });

      if (res.data.requiresMFA) {
        setMfaRequired(true);
        setErr("Two-factor authentication required. Please enter your 6-digit TOTP code or emergency backup code.");
        return;
      }

      // Check mandatory password reset
      if (res.data.mustChangePassword || res.data.user?.must_change_password) {
        setPendingReset({ user: res.data.user, token: res.data.token });
        setResetCurrentPassword(password);
        return;
      }

      onLogin(res.data.user, res.data.token);
    } catch (error) {
      if (error.response?.status === 423 || error.response?.data?.code === 'LOCKED') {
        setLockoutInfo({
          message: error.response.data.error || 'Account locked for 30 minutes due to 3 consecutive failed login attempts (§3 & §8.5.3.1).',
          remainingMinutes: error.response.data.remainingMinutes || 30
        });
        setErr("");
      } else if (error.response?.data?.attemptsLeft !== undefined) {
        setAttemptsLeft(error.response.data.attemptsLeft);
        setErr(`Invalid credentials. ${error.response.data.attemptsLeft} attempt(s) remaining before a 30-minute account lockout.`);
      } else {
        setErr(error.response?.data?.error || "Invalid Credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetError("");

    if (!resetCurrentPassword) {
      setResetError("Current password is required");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("New passwords do not match");
      return;
    }
    if (!policy.isValid) {
      setResetError("Password does not satisfy the 21 CFR Part 11 complexity policy (min 8 chars, uppercase, lowercase, number, special character).");
      return;
    }

    try {
      setResetLoading(true);
      await api.post("/auth/change-password", {
        currentPassword: resetCurrentPassword,
        newPassword: resetNewPassword
      }, {
        headers: { Authorization: `Bearer ${pendingReset.token}` }
      });

      alert("Password successfully updated in compliance with 21 CFR Part 11. Proceeding to workspace.");
      onLogin({ ...pendingReset.user, must_change_password: 0 }, pendingReset.token);
    } catch (err) {
      setResetError(err.response?.data?.error || "Failed to update password. Ensure it does not match your last 5 passwords.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)', padding: 20 }}>
      <div className="glass-panel" style={{ width: 440, padding: 36, background: '#ffffff', borderRadius: 16, boxShadow: '0 20px 40px rgba(15,23,42,0.12)' }}>
        
        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, justifyContent: "center" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #0284c7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 22 }}>T</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#0f172a" }}>eTMF<span style={{ color: "#0284c7" }}>Pro</span></div>
        </div>
        <h2 style={{ fontSize: 15, color: "#475569", marginBottom: 20, textAlign: "center", fontWeight: 600 }}>
          {pendingReset ? "Mandatory Password Initialization" : "21 CFR Part 11 Secure Access Gateway"}
        </h2>

        {/* Inactivity Session Timeout Warning Banner */}
        {sessionExpiredNotice && (
          <div style={{
            color: "#92400e",
            background: "#fef3c7",
            padding: "12px 14px",
            marginBottom: 18,
            borderRadius: 8,
            fontSize: 12.5,
            border: "1px solid #fcd34d",
            lineHeight: 1.4
          }}>
            ⏱️ <strong>Session Revoked:</strong> {sessionExpiredNotice}
          </div>
        )}

        {/* Account Lockout Banner (HTTP 423) */}
        {lockoutInfo && (
          <div style={{
            color: "#991b1b",
            background: "#fee2e2",
            padding: "14px 16px",
            marginBottom: 18,
            borderRadius: 8,
            fontSize: 12.5,
            border: "1px solid #f87171",
            lineHeight: 1.4
          }}>
            🔒 <strong>ACCOUNT LOCKED:</strong> {lockoutInfo.message}
          </div>
        )}

        {/* Failed Attempt Warning Badge */}
        {attemptsLeft !== null && !lockoutInfo && (
          <div style={{
            color: "#b45309",
            background: "#fffbeb",
            padding: "8px 12px",
            marginBottom: 14,
            borderRadius: 6,
            fontSize: 12,
            border: "1px solid #fde68a",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}>
            <span>⚠️</span>
            <span>Security Warning: {attemptsLeft} login attempt(s) remaining before 30-minute account lockout.</span>
          </div>
        )}

        {/* General Error Banner */}
        {err && (
          <div style={{
            color: "#dc2626",
            background: "#fee2e2",
            padding: "12px 14px",
            marginBottom: 18,
            borderRadius: 8,
            fontSize: 12.5,
            border: "1px solid #fca5a5"
          }}>
            {err}
          </div>
        )}

        {/* MANDATORY FIRST-TIME PASSWORD RESET VIEW */}
        {pendingReset ? (
          <form onSubmit={handlePasswordReset}>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 16, lineHeight: 1.4 }}>
              Per regulatory security standards (§3 &amp; §8.5.3.1), your temporary password has expired and you must set a new compliant password.
            </div>

            {resetError && (
              <div style={{ color: "#dc2626", background: "#fee2e2", padding: "10px 12px", marginBottom: 14, borderRadius: 6, fontSize: 12, border: "1px solid #fca5a5" }}>
                {resetError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>CURRENT PASSWORD *</label>
              <input
                type="password"
                className="modern-input"
                value={resetCurrentPassword}
                onChange={e => setResetCurrentPassword(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>NEW PASSWORD *</label>
              <input
                type="password"
                className="modern-input"
                value={resetNewPassword}
                onChange={e => setResetNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                required
                style={{ width: "100%" }}
              />
            </div>

            {/* Live Password Policy Badges */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 14,
              fontSize: 11
            }}>
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: 6 }}>PASSWORD COMPLEXITY CHECKLIST (§3):</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <span style={{ color: policy.minLength ? '#16a34a' : '#94a3b8' }}>
                  {policy.minLength ? '✓' : '○'} Min 8 characters
                </span>
                <span style={{ color: policy.hasUpper ? '#16a34a' : '#94a3b8' }}>
                  {policy.hasUpper ? '✓' : '○'} Uppercase letter
                </span>
                <span style={{ color: policy.hasLower ? '#16a34a' : '#94a3b8' }}>
                  {policy.hasLower ? '✓' : '○'} Lowercase letter
                </span>
                <span style={{ color: policy.hasNumber ? '#16a34a' : '#94a3b8' }}>
                  {policy.hasNumber ? '✓' : '○'} Numeric digit
                </span>
                <span style={{ color: policy.hasSpecial ? '#16a34a' : '#94a3b8', gridColumn: 'span 2' }}>
                  {policy.hasSpecial ? '✓' : '○'} Special character (!@#$%^&amp;*...)
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>CONFIRM NEW PASSWORD *</label>
              <input
                type="password"
                className="modern-input"
                value={resetConfirmPassword}
                onChange={e => setResetConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                required
                style={{ width: "100%" }}
              />
            </div>

            <button
              type="submit"
              disabled={resetLoading || !policy.isValid}
              className="btn-primary"
              style={{ width: "100%", opacity: (!policy.isValid || resetLoading) ? 0.6 : 1 }}
            >
              {resetLoading ? "Updating Password & Vault..." : "Set New Compliant Password"}
            </button>
          </form>
        ) : (
          /* STANDARD LOGIN VIEW */
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>ENTERPRISE TENANT ID</label>
              <input
                className="modern-input"
                value={enterprise}
                onChange={e => setEnterprise(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>WORK EMAIL / USERNAME *</label>
              <input
                className="modern-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: mfaRequired ? 14 : 22 }}>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                PASSWORD * <span style={{ color: "#0ea5e9", cursor: "pointer", fontWeight: 500 }}>Forgot?</span>
              </label>
              <input
                type="password"
                className="modern-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            {/* MFA TOTP Challenge Input */}
            {mfaRequired && (
              <div style={{ marginBottom: 20, background: '#f0f9ff', border: '1px solid #bae6fd', padding: '12px 14px', borderRadius: 8 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#0369a1", marginBottom: 4 }}>
                  MFA SECURITY CODE (TOTP / RECOVERY) *
                </label>
                <input
                  type="text"
                  className="modern-input"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  placeholder="Enter 6-digit code or XXXX-XXXX"
                  required
                  autoFocus
                  style={{ width: "100%", background: '#fff' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (lockoutInfo?.isLocked)}
              className="btn-primary"
              style={{ width: "100%", opacity: (loading || lockoutInfo?.isLocked) ? 0.6 : 1 }}
            >
              {loading ? "Authenticating Identity..." : (mfaRequired ? "Verify Code & Sign In" : "Secure Log In")}
            </button>

            <div style={{ textAlign: "center", marginTop: 20, fontSize: 11.5, color: "#94a3b8" }}>
              21 CFR Part 11 &amp; Annex 11 Certified Audit Environment
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
