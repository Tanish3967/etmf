import React, { useState } from 'react';

export const DIA_TMF_ZONES = [
  {
    id: "zone-01",
    code: "01",
    name: "01 Trial Management",
    sections: [
      { id: "sec-01.01", code: "01.01", name: "01.01 Trial Oversight", artifacts: ["01.01.01 Trial Master File Plan", "01.01.02 Monitoring Plan"] },
      { id: "sec-01.02", code: "01.02", name: "01.02 Team Handovers", artifacts: ["01.02.01 Handover Notes", "01.02.02 Transition Log"] },
      { id: "sec-01.03", code: "01.03", name: "01.03 Financial Tracking", artifacts: ["01.03.01 Budget Template", "01.03.02 Payment Schedule"] }
    ]
  },
  {
    id: "zone-02",
    code: "02",
    name: "02 Central Trial Documents",
    sections: [
      { id: "sec-02.01", code: "02.01", name: "02.01 Protocol & Amendments", artifacts: ["02.01.01 Approved Protocol", "02.01.02 Protocol Amendment Form"] },
      { id: "sec-02.02", code: "02.02", name: "02.02 Investigator Brochure", artifacts: ["02.02.01 Current IB", "02.02.02 IB Addendum"] },
      { id: "sec-02.03", code: "02.03", name: "02.03 Subject Information & Consent", artifacts: ["02.03.01 Master ICF", "02.03.02 Patient Diary"] }
    ]
  },
  {
    id: "zone-03",
    code: "03",
    name: "03 Regulatory",
    sections: [
      { id: "sec-03.01", code: "03.01", name: "03.01 Competent Authority", artifacts: ["03.01.01 CTA Application", "03.01.02 Regulatory Approval Letter"] },
      { id: "sec-03.02", code: "03.02", name: "03.02 Regulatory Correspondence", artifacts: ["03.02.01 Clarification Letters", "03.02.02 Annual Safety Reports"] }
    ]
  },
  {
    id: "zone-04",
    code: "04",
    name: "04 IRB / IEC",
    sections: [
      { id: "sec-04.01", code: "04.01", name: "04.01 Central Ethics Committee", artifacts: ["04.01.01 Initial IRB Submission", "04.01.02 IRB Favourable Opinion"] },
      { id: "sec-04.02", code: "04.02", name: "04.02 Local Ethics Committee", artifacts: ["04.02.01 Site Ethics Clearance", "04.02.02 Annual Re-approvals"] }
    ]
  },
  {
    id: "zone-05",
    code: "05",
    name: "05 Site Management",
    sections: [
      { id: "sec-05.01", code: "05.01", name: "05.01 Feasibility & Selection", artifacts: ["05.01.01 Site Feasibility Survey", "05.01.02 Pre-Study Visit Report"] },
      { id: "sec-05.02", code: "05.02", name: "05.02 Site Initiation", artifacts: ["05.02.01 SIV Report", "05.02.02 Delegation of Authority Log"] },
      { id: "sec-05.03", code: "05.03", name: "05.03 Monitoring Visit Reports", artifacts: ["05.03.01 Interim Monitoring Report", "05.03.02 Closeout Visit Report"] }
    ]
  },
  {
    id: "zone-06",
    code: "06",
    name: "06 IP & Trial Supplies",
    sections: [
      { id: "sec-06.01", code: "06.01", name: "06.01 Product Accountability", artifacts: ["06.01.01 IP Shipping Receipt", "06.01.02 IP Destruction Certificate"] },
      { id: "sec-06.02", code: "06.02", name: "06.02 Certificate of Analysis", artifacts: ["06.02.01 Batch CoA", "06.02.02 Temperature Excursion Logs"] }
    ]
  },
  {
    id: "zone-07",
    code: "07",
    name: "07 Safety Reporting",
    sections: [
      { id: "sec-07.01", code: "07.01", name: "07.01 Serious Adverse Events (SAEs)", artifacts: ["07.01.01 Initial SAE Form", "07.01.02 Follow-up SAE Form"] },
      { id: "sec-07.02", code: "07.02", name: "07.02 SUSARs & Safety Alerts", artifacts: ["07.02.01 CIOMS-I Reports", "07.02.02 DSUR Annual Report"] }
    ]
  },
  {
    id: "zone-08",
    code: "08",
    name: "08 Central & Local Testing",
    sections: [
      { id: "sec-08.01", code: "08.01", name: "08.01 Laboratory Certifications", artifacts: ["08.01.01 CLIA Certificate", "08.01.02 CAP Accreditation"] },
      { id: "sec-08.02", code: "08.02", name: "08.02 Normal Reference Ranges", artifacts: ["08.02.01 Lab Reference Ranges", "08.02.02 Lab Director CV"] }
    ]
  },
  {
    id: "zone-09",
    code: "09",
    name: "09 Third Parties",
    sections: [
      { id: "sec-09.01", code: "09.01", name: "09.01 Contracts & Agreements", artifacts: ["09.01.01 Clinical Trial Agreement (CTA)", "09.01.02 CRO Master Services Agreement"] },
      { id: "sec-09.02", code: "09.02", name: "09.02 Vendor Oversight", artifacts: ["09.02.01 Vendor Audit Report", "09.02.02 Service Level Agreements"] }
    ]
  },
  {
    id: "zone-10",
    code: "10",
    name: "10 Data Management",
    sections: [
      { id: "sec-10.01", code: "10.01", name: "10.01 Data Management Plan", artifacts: ["10.01.01 Approved DMP", "10.01.02 Data Validation Plan"] },
      { id: "sec-10.02", code: "10.02", name: "10.02 Case Report Form (CRF)", artifacts: ["10.02.01 Annotated eCRF", "10.02.02 eCRF Completion Guidelines"] }
    ]
  },
  {
    id: "zone-11",
    code: "11",
    name: "11 Statistics",
    sections: [
      { id: "sec-11.01", code: "11.01", name: "11.01 Statistical Analysis Plan", artifacts: ["11.01.01 Approved SAP", "11.01.02 Mock Shells & Tables"] },
      { id: "sec-11.02", code: "11.02", name: "11.02 Data Blind Review", artifacts: ["11.02.01 Blind Review Meeting Minutes", "11.02.02 Database Lock Signoff"] }
    ]
  }
];

export default function FolderTree({ selectedNode, onSelectNode, onContextMenu }) {
  const [search, setSearch] = useState('');
  const [expandedZones, setExpandedZones] = useState({ "zone-01": true, "zone-02": true });
  const [expandedSections, setExpandedSections] = useState({ "sec-02.01": true });

  const toggleZone = (zoneId) => {
    setExpandedZones(prev => ({ ...prev, [zoneId]: !prev[zoneId] }));
  };

  const toggleSection = (secId) => {
    setExpandedSections(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

  const matchesSearch = (text) => {
    if (!search.trim()) return true;
    return text.toLowerCase().includes(search.toLowerCase());
  };

  return (
    <div style={{
      width: 310,
      background: '#fff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none'
    }}>
      {/* Search Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', letterSpacing: -0.3 }}>
            📁 DIA TMF Model v3.2
          </div>
          <button
            onClick={() => {
              const allExpanded = Object.keys(expandedZones).length > 5;
              if (allExpanded) {
                setExpandedZones({});
                setExpandedSections({});
              } else {
                const z = {};
                DIA_TMF_ZONES.forEach(zone => { z[zone.id] = true; });
                setExpandedZones(z);
              }
            }}
            style={{ fontSize: 11, background: '#f1f5f9', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
          >
            {Object.keys(expandedZones).length > 5 ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
        <input
          className="modern-input"
          placeholder="Filter zones & artifacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '6px 10px', fontSize: 12, height: 32 }}
        />
      </div>

      {/* Tree Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
        {/* All Documents Root Option */}
        <div
          onClick={() => onSelectNode(null)}
          onContextMenu={(e) => onContextMenu(e, { type: 'root', name: 'Master eTMF Root', code: '00' })}
          style={{
            padding: '7px 12px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: !selectedNode ? 700 : 500,
            color: !selectedNode ? '#0284c7' : '#334155',
            background: !selectedNode ? '#e0f2fe' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4
          }}
        >
          <span>🗂️</span>
          <span>All Documents & Artifacts</span>
        </div>

        {DIA_TMF_ZONES.filter(z => matchesSearch(z.name) || z.sections.some(s => matchesSearch(s.name) || s.artifacts.some(a => matchesSearch(a)))).map(zone => {
          const isZoneExpanded = expandedZones[zone.id] || Boolean(search.trim());
          const isZoneSelected = selectedNode?.type === 'zone' && selectedNode?.id === zone.id;

          return (
            <div key={zone.id} style={{ marginBottom: 2 }}>
              {/* Zone Header */}
              <div
                onClick={() => {
                  toggleZone(zone.id);
                  onSelectNode({ type: 'zone', id: zone.id, name: zone.name, code: zone.code });
                }}
                onContextMenu={(e) => onContextMenu(e, { type: 'zone', ...zone })}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: isZoneSelected ? '#0284c7' : '#1e293b',
                  background: isZoneSelected ? '#e0f2fe' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span style={{ fontSize: 10, width: 12, color: '#94a3b8' }}>
                  {isZoneExpanded ? '▼' : '▶'}
                </span>
                <span>📂</span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {zone.name}
                </span>
                <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 10 }}>
                  {zone.sections.length}
                </span>
              </div>

              {/* Sections List */}
              {isZoneExpanded && (
                <div style={{ marginLeft: 16, borderLeft: '1px solid #e2e8f0', paddingLeft: 6 }}>
                  {zone.sections.filter(s => matchesSearch(s.name) || s.artifacts.some(a => matchesSearch(a))).map(sec => {
                    const isSecExpanded = expandedSections[sec.id] || Boolean(search.trim());
                    const isSecSelected = selectedNode?.type === 'section' && selectedNode?.id === sec.id;

                    return (
                      <div key={sec.id} style={{ marginTop: 2 }}>
                        {/* Section Header */}
                        <div
                          onClick={() => {
                            toggleSection(sec.id);
                            onSelectNode({ type: 'section', id: sec.id, name: sec.name, code: sec.code, zoneCode: zone.code });
                          }}
                          onContextMenu={(e) => onContextMenu(e, { type: 'section', zone, ...sec })}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: isSecSelected ? 700 : 500,
                            color: isSecSelected ? '#0284c7' : '#334155',
                            background: isSecSelected ? '#f0f9ff' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <span style={{ fontSize: 9, width: 10, color: '#94a3b8' }}>
                            {isSecExpanded ? '▼' : '▶'}
                          </span>
                          <span>📁</span>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sec.name}
                          </span>
                        </div>

                        {/* Artifact Items */}
                        {isSecExpanded && (
                          <div style={{ marginLeft: 16, paddingLeft: 4 }}>
                            {sec.artifacts.filter(matchesSearch).map((art, aIdx) => {
                              const isArtSelected = selectedNode?.type === 'artifact' && selectedNode?.name === art;
                              return (
                                <div
                                  key={aIdx}
                                  onClick={() => onSelectNode({ type: 'artifact', name: art, sectionCode: sec.code, zoneCode: zone.code })}
                                  onContextMenu={(e) => onContextMenu(e, { type: 'artifact', name: art, sec, zone })}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    color: isArtSelected ? '#0284c7' : '#64748b',
                                    fontWeight: isArtSelected ? 600 : 400,
                                    background: isArtSelected ? '#f0f9ff' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  <span>📄</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{art}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
