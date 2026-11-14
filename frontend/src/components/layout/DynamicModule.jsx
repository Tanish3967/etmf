import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function DynamicModule({ activeMenu }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    let endpoint = "";
    if (activeMenu === "Security Administration") endpoint = "/users";
    else if (activeMenu === "Quality Control") endpoint = "/audit";
    else if (activeMenu === "My Tasks") endpoint = "/workflow/tasks";
    else if (activeMenu === "Reports") endpoint = "/reports/timeliness";
    else if (activeMenu === "Application Administration") endpoint = "/admin/functional-roles";
    else if (activeMenu === "System Administration") endpoint = "/admin/system-codelists";
    else if (activeMenu === "Forms/Logs") endpoint = "/forms/schemas";
    else if (activeMenu === "Manage Enterprise") endpoint = "/admin/user-groups";

    if (!endpoint) {
      setData([]);
      setLoading(false);
      return;
    }

    Promise.resolve().then(() => {
      if (!ignore) setLoading(true);
      return api.get(endpoint);
    }).then(res => {
      if (ignore) return;
      const raw = res.data;
      const list = raw.users || raw.tasks || raw.audits || raw.logs || raw.roles || raw.groups || raw.metrics || raw.inventory || raw.templates || raw.codelists || raw.schemas || (Array.isArray(raw) ? raw : []);
      setData(list);
    }).catch(e => {
      if (ignore) return;
      console.error("Error fetching", e);
      setData([]);
    }).finally(() => {
      if (!ignore) setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [activeMenu]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Loading backend endpoints...</div>;

  return (
    <div className="glass-panel" style={{ background: "#fff", overflow: "hidden", minHeight: 400 }}>
      <div style={{ padding: 24, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{activeMenu} Records</h3>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Rendering live data from connected Node.js SQLite API.</div>
        </div>
        <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>+ Create New Entry</button>
      </div>

      <div style={{ padding: 24 }}>
        {Array.isArray(data) && data.length > 0 ? (
          <table className="modern-table">
            <thead>
              <tr>
                {Object.keys(data[0]).filter(k => !['id', 'password_hash', 'tenant_id'].includes(k)).slice(0, 6).map(k => (
                  <th key={k}>{k.replace('_', ' ')}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {Object.entries(row).filter(([k]) => !['id', 'password_hash', 'tenant_id'].includes(k)).slice(0, 6).map(([k, v]) => (
                    <td key={k}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                  ))}
                  <td><button className="btn-secondary" style={{ padding: "4px 8px" }}>⚙ Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            No records found for this module in the database, or endpoint not heavily populated.
          </div>
        )}
      </div>
    </div>
  );
}
