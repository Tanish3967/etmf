import React, { useState } from 'react';
import api from '../../api';

const DIA_ZONES_CONFIG = [
  { code: '01', name: '01 Trial Management', sectionsCount: 3, artifactCount: 4, desc: 'Trial master file plan, monitoring plan, governance & team handovers' },
  { code: '02', name: '02 Central Trial Documents', sectionsCount: 3, artifactCount: 4, desc: 'Protocol & amendments, Investigator Brochure, ICF, patient diaries' },
  { code: '03', name: '03 Regulatory', sectionsCount: 2, artifactCount: 3, desc: 'CTA applications, health authority approvals, regulatory correspondence' },
  { code: '04', name: '04 IRB / IEC', sectionsCount: 2, artifactCount: 3, desc: 'Central & local ethics committee approvals and safety reports' },
  { code: '05', name: '05 Site Management', sectionsCount: 3, artifactCount: 4, desc: 'Feasibility surveys, SIV reports, Delegation of Authority (DOA) log' },
  { code: '06', name: '06 IP & Trial Supplies', sectionsCount: 2, artifactCount: 3, desc: 'Drug shipment receipts, Certificate of Analysis (CoA), destruction logs' },
  { code: '07', name: '07 Safety Reporting', sectionsCount: 2, artifactCount: 3, desc: 'Serious adverse events (SAEs), CIOMS forms, SUSARs & alerts' },
  { code: '08', name: '08 Central & Local Testing', sectionsCount: 2, artifactCount: 2, desc: 'Laboratory certifications (CLIA/CAP), reference ranges, director CV' },
  { code: '09', name: '09 Third Parties', sectionsCount: 2, artifactCount: 2, desc: 'Clinical trial agreements (CTAs), vendor master agreements & SLAs' },
  { code: '10', name: '10 Data Management', sectionsCount: 2, artifactCount: 2, desc: 'Data management plan (DMP), eCRF completion guidelines, edit checks' },
  { code: '11', name: '11 Statistics', sectionsCount: 2, artifactCount: 2, desc: 'Statistical analysis plan (SAP), mock shells, blind review minutes' }
];

export default function StudySetupWizardModal({ isOpen, onClose, onStudyCreated }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── STEP 1: PROTOCOL METADATA STATE ────────────────────────────────
  const [protocolData, setProtocolData] = useState({
    protocolNumber: '',
    title: '',
    phase: 'Phase III',
    therapeuticArea: 'Oncology',
    sponsorName: '',
    croName: '',
    startDate: new Date().toISOString().split('T')[0],
    plannedEndDate: '',
    tmfModelVersion: 'DIA v3.2'
  });

  // ── STEP 2: COUNTRIES & SITES STATE ────────────────────────────────
  const [countries, setCountries] = useState([]);
  const [newCountryInput, setNewCountryInput] = useState('');
  const [sites, setSites] = useState([]);
  const [newSite, setNewSite] = useState({
    siteCode: '',
    name: '',
    country: '',
    piName: '',
    activationDate: new Date().toISOString().split('T')[0]
  });

  // ── STEP 3: DIA TMF REFERENCE MODEL ZONES STATE ────────────────────
  const [selectedZones, setSelectedZones] = useState(DIA_ZONES_CONFIG.map(z => z.code));

  // ── STEP 4: SUMMARY & EDL INITIALIZATION STATE ─────────────────────
  const [initializeEDL, setInitializeEDL] = useState(true);

  // ── HANDLERS ───────────────────────────────────────────────────────
  const handleAddCountry = () => {
    if (!newCountryInput.trim()) return;
    const trimmed = newCountryInput.trim();
    if (!countries.includes(trimmed)) {
      setCountries([...countries, trimmed]);
      if (!newSite.country) setNewSite(s => ({ ...s, country: trimmed }));
    }
    setNewCountryInput('');
  };

  const handleAddSite = () => {
    const code = newSite.siteCode.trim();
    const name = newSite.name.trim();
    const country = newSite.country.trim() || countries[0] || 'United States';
    if (!code || !name) {
      alert('Please provide Site Code and Facility Name');
      return;
    }
    if (sites.some(s => s.siteCode.toLowerCase() === code.toLowerCase())) {
      alert(`Site Code "${code}" has already been added.`);
      return;
    }
    const addedSite = {
      ...newSite,
      siteCode: code,
      name,
      country
    };
    setSites([...sites, addedSite]);
    if (!countries.includes(country)) {
      setCountries([...countries, country]);
    }
    setNewSite({
      siteCode: '',
      name: '',
      country: country,
      piName: '',
      activationDate: new Date().toISOString().split('T')[0]
    });
  };

  const handleRemoveSite = (index) => {
    setSites(sites.filter((_, i) => i !== index));
  };

  const handleToggleZone = (code) => {
    if (selectedZones.includes(code)) {
      setSelectedZones(selectedZones.filter(c => c !== code));
    } else {
      setSelectedZones([...selectedZones, code]);
    }
  };

  const handleSelectAllZones = () => {
    setSelectedZones(DIA_ZONES_CONFIG.map(z => z.code));
  };

  const handleDeselectAllZones = () => {
    setSelectedZones([]);
  };

  const validateStep1 = () => {
    if (!protocolData.protocolNumber.trim()) {
      setErrorMsg('Protocol Number is required (e.g. CLIN-2026-001)');
      return false;
    }
    if (!protocolData.title.trim()) {
      setErrorMsg('Study Title is required');
      return false;
    }
    if (!protocolData.phase) {
      setErrorMsg('Study Phase is required');
      return false;
    }
    if (protocolData.startDate && protocolData.plannedEndDate && protocolData.plannedEndDate < protocolData.startDate) {
      setErrorMsg('Planned End Date cannot be earlier than Study Start Date');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const nextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    setErrorMsg('');
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setErrorMsg('');
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleFinishSetup = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        protocolNumber: protocolData.protocolNumber.trim(),
        title: protocolData.title.trim(),
        phase: protocolData.phase,
        therapeuticArea: protocolData.therapeuticArea,
        sponsorName: protocolData.sponsorName,
        croName: protocolData.croName,
        startDate: protocolData.startDate,
        plannedEndDate: protocolData.plannedEndDate,
        tmfModelVersion: protocolData.tmfModelVersion,
        countries: countries,
        sites: sites,
        initializeEDL: initializeEDL,
        zones: selectedZones
      };

      const res = await api.post('/studies', payload);
      alert(`🎉 Clinical Study Successfully Established!\n\nProtocol: ${protocolData.protocolNumber}\nTitle: ${protocolData.title}\nParticipating Sites: ${sites.length}\nEDL Placeholders Created: ${res.data.placeholdersCount || 'Active'}\n\nStudy is now active in eTMF repository.`);
      if (onStudyCreated) onStudyCreated(res.data.study);
      onClose();
    } catch (err) {
      console.error('Study setup creation failed:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to establish clinical study. Please check parameters.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 860, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}>
        
        {/* WIZARD HEADER */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderTopLeftRadius: 20, borderTopRightRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              <span>ICH GCP E6(R2) §5.0</span> • <span>DIA TMF v3.2 COMPLIANT</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              Study Setup Wizard (§8.5.2)
            </h2>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Establish a new clinical trial, map participating site structures, and auto-initialize the EDL hierarchy.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: '1px solid #cbd5e1', fontSize: 18, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* STEP PROGRESS INDICATOR */}
        <div style={{ display: 'flex', padding: '16px 32px', background: '#fff', borderBottom: '1px solid #f1f5f9', gap: 12 }}>
          {[
            { step: 1, label: '1. Protocol Metadata' },
            { step: 2, label: '2. Countries & Sites' },
            { step: 3, label: '3. DIA Folder Structure' },
            { step: 4, label: '4. Summary & EDL' }
          ].map(s => {
            const isCurrent = currentStep === s.step;
            const isCompleted = currentStep > s.step;
            return (
              <div
                key={s.step}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: isCurrent ? '#f0f9ff' : isCompleted ? '#f8fafc' : '#f8fafc',
                  border: `1px solid ${isCurrent ? '#0284c7' : isCompleted ? '#bbf7d0' : '#e2e8f0'}`,
                  color: isCurrent ? '#0284c7' : isCompleted ? '#16a34a' : '#64748b',
                  fontWeight: isCurrent || isCompleted ? 700 : 500,
                  fontSize: 12
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: isCurrent ? '#0284c7' : isCompleted ? '#16a34a' : '#cbd5e1',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700
                }}>
                  {isCompleted ? '✓' : s.step}
                </div>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* ERROR BANNER */}
        {errorMsg && (
          <div style={{ margin: '16px 32px 0 32px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* STEP CONTENT CONTAINER */}
        <div style={{ padding: '24px 32px', flex: 1 }}>

          {/* ── STEP 1: PROTOCOL METADATA ─────────────────────────────── */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Protocol Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLIN-2026-009"
                    value={protocolData.protocolNumber}
                    onChange={e => setProtocolData({ ...protocolData, protocolNumber: e.target.value })}
                    className="modern-input"
                  />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Unique identifier for regulatory filings</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Study Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A Multi-Center Phase III Trial of Investigational Product"
                    value={protocolData.title}
                    onChange={e => setProtocolData({ ...protocolData, title: e.target.value })}
                    className="modern-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Trial Phase *
                  </label>
                  <select
                    value={protocolData.phase}
                    onChange={e => setProtocolData({ ...protocolData, phase: e.target.value })}
                    className="modern-input"
                    style={{ background: '#fff' }}
                  >
                    <option value="Phase I">Phase I</option>
                    <option value="Phase I/II">Phase I/II</option>
                    <option value="Phase II">Phase II</option>
                    <option value="Phase II/III">Phase II/III</option>
                    <option value="Phase III">Phase III</option>
                    <option value="Phase IV">Phase IV</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Therapeutic Area
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Oncology / Immunology"
                    value={protocolData.therapeuticArea}
                    onChange={e => setProtocolData({ ...protocolData, therapeuticArea: e.target.value })}
                    className="modern-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    TMF Reference Standard
                  </label>
                  <select
                    value={protocolData.tmfModelVersion}
                    onChange={e => setProtocolData({ ...protocolData, tmfModelVersion: e.target.value })}
                    className="modern-input"
                    style={{ background: '#fff' }}
                  >
                    <option value="DIA v3.2">DIA TMF Reference Model v3.2</option>
                    <option value="DIA v3.1">DIA TMF Reference Model v3.1</option>
                    <option value="Custom Sponsor Standard">Custom Sponsor Standard</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Sponsor Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PharmaCo Ltd"
                    value={protocolData.sponsorName}
                    onChange={e => setProtocolData({ ...protocolData, sponsorName: e.target.value })}
                    className="modern-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    CRO Organization (if delegated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Global Clinical Solutions CRO"
                    value={protocolData.croName}
                    onChange={e => setProtocolData({ ...protocolData, croName: e.target.value })}
                    className="modern-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Study Start Date
                  </label>
                  <input
                    type="date"
                    value={protocolData.startDate}
                    onChange={e => setProtocolData({ ...protocolData, startDate: e.target.value })}
                    className="modern-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Planned End Date
                  </label>
                  <input
                    type="date"
                    value={protocolData.plannedEndDate}
                    onChange={e => setProtocolData({ ...protocolData, plannedEndDate: e.target.value })}
                    className="modern-input"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: COUNTRIES & SITES SETUP ───────────────────────── */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* COUNTRIES CONFIGURATION */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  Participating Countries ({countries.length})
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {countries.map(c => (
                    <span key={c} style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      🌐 {c}
                      <button
                        onClick={() => setCountries(countries.filter(x => x !== c))}
                        style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', padding: 0, fontSize: 13 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, maxWidth: 400 }}>
                  <input
                    type="text"
                    placeholder="Add country (e.g. France, Japan)..."
                    value={newCountryInput}
                    onChange={e => setNewCountryInput(e.target.value)}
                    className="modern-input"
                    style={{ padding: '6px 12px', fontSize: 13 }}
                  />
                  <button onClick={handleAddCountry} className="btn-secondary" style={{ padding: '6px 14px', whiteSpace: 'nowrap' }}>
                    + Add Country
                  </button>
                </div>
              </div>

              {/* SITES ADD FORM */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                  Add Investigational Site
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr', gap: 10, marginBottom: 10 }}>
                  <input
                    type="text"
                    placeholder="Site Code (e.g. Site-104)"
                    value={newSite.siteCode}
                    onChange={e => setNewSite({ ...newSite, siteCode: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <input
                    type="text"
                    placeholder="Site Facility Name (e.g. Mayo Clinic)"
                    value={newSite.name}
                    onChange={e => setNewSite({ ...newSite, name: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <input
                    list="studyCountriesList"
                    placeholder="Country (e.g. United States)"
                    value={newSite.country}
                    onChange={e => setNewSite({ ...newSite, country: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13, background: '#fff' }}
                  />
                  <datalist id="studyCountriesList">
                    {countries.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr auto', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Principal Investigator (e.g. Dr. Jane Goodall)"
                    value={newSite.piName}
                    onChange={e => setNewSite({ ...newSite, piName: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <input
                    type="date"
                    value={newSite.activationDate}
                    onChange={e => setNewSite({ ...newSite, activationDate: e.target.value })}
                    className="modern-input"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                  />
                  <button onClick={handleAddSite} className="btn-primary" style={{ padding: '8px 18px', fontSize: 13, whiteSpace: 'nowrap' }}>
                    + Add Site
                  </button>
                </div>
              </div>

              {/* SITES TABLE */}
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Facility Name</th>
                      <th>Country</th>
                      <th>Principal Investigator</th>
                      <th>Activation Date</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.length > 0 ? (
                      sites.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700, color: '#0284c7' }}>{s.siteCode}</td>
                          <td>{s.name}</td>
                          <td>{s.country}</td>
                          <td>{s.piName || '—'}</td>
                          <td>{s.activationDate || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleRemoveSite(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                            >
                              ✕ Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>
                          No clinical sites added yet. Add at least one site or proceed to configure later.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STEP 3: DIA TMF REFERENCE MODEL STRUCTURE ─────────────── */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    Select DIA TMF Reference Model v3.2 Applicable Zones
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Standard taxonomy covers all 11 ICH GCP zones. You can exclude non-applicable zones.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSelectAllZones} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Select All
                  </button>
                  <button onClick={handleDeselectAllZones} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Deselect All
                  </button>
                </div>
              </div>

              {/* ZONES GRID */}
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 2 }}>
                {DIA_ZONES_CONFIG.map(z => {
                  const isChecked = selectedZones.includes(z.code);
                  return (
                    <div
                      key={z.code}
                      onClick={() => handleToggleZone(z.code)}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: `1.5px solid ${isChecked ? '#0284c7' : '#e2e8f0'}`,
                        background: isChecked ? '#f0f9ff' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        style={{ marginTop: 3, pointerEvents: 'none' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: isChecked ? '#0284c7' : '#0f172a' }}>
                            {z.name}
                          </span>
                          <span style={{ fontSize: 11, background: isChecked ? '#bae6fd' : '#f1f5f9', color: isChecked ? '#0369a1' : '#64748b', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                            {z.sectionsCount} Sec • {z.artifactCount} Art
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>
                          {z.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 4: SUMMARY & EDL INITIALIZATION ──────────────────── */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                  Study Setup Summary & Validation Manifest
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Protocol</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{protocolData.protocolNumber}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Phase & Area</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{protocolData.phase} • {protocolData.therapeuticArea}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Sponsor / CRO</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{protocolData.sponsorName}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 16, paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Participating Countries</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{countries.join(', ') || 'None'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Sites Configured</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>{sites.length} Active Sites</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Active DIA Zones</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>{selectedZones.length} of 11 Zones</div>
                  </div>
                </div>
              </div>

              {/* EDL AUTO-INITIALIZE TOGGLE */}
              <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <input
                  type="checkbox"
                  id="edlInitToggle"
                  checked={initializeEDL}
                  onChange={e => setInitializeEDL(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="edlInitToggle" style={{ fontSize: 14, fontWeight: 700, color: '#065f46', cursor: 'pointer', display: 'block' }}>
                    Auto-Initialize Expected Document List (EDL) Hierarchy (§8.5.2)
                  </label>
                  <div style={{ fontSize: 12, color: '#047857', marginTop: 4, lineHeight: 1.4 }}>
                    Creates standard DIA TMF Reference Model v3.2 document placeholders across all selected zones. This enables real-time completeness tracking, missing document flags, and ICH GCP inspection readiness from Day 1.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* WIZARD FOOTER ACTIONS */}
        <div style={{ padding: '18px 32px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {currentStep > 1 && (
              <button onClick={prevStep} className="btn-secondary">
                ← Back
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            {currentStep < 4 ? (
              <button onClick={nextStep} className="btn-primary">
                Next: {currentStep === 1 ? 'Countries & Sites' : currentStep === 2 ? 'Folder Structure' : 'Summary & Launch'} →
              </button>
            ) : (
              <button
                onClick={handleFinishSetup}
                disabled={submitting}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}
              >
                {submitting ? 'Initializing Study...' : '🚀 Finalize & Launch Study (§8.5.2)'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
