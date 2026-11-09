import React from 'react';

// Sprint 1: Document Action Modals (Clinevo eTMF 4.3 §8.10)
import MetadataEditorModal from './MetadataEditorModal';
import RedactionModal from './RedactionModal';
import StickyNotesModal from './StickyNotesModal';
import BlindingModal from './BlindingModal';
import RaiseQueryModal from './RaiseQueryModal';
import LinkDocumentModal from './LinkDocumentModal';
import DocumentHistoryModal from './DocumentHistoryModal';
import CompliantDownloadModal from './CompliantDownloadModal';

// Sprint 3: Workflow & 21 CFR Part 11 Electronic Signature (Clinevo eTMF 4.3 §8.11–§8.13)
import WorkflowAdvanceModal from '../workflow/WorkflowAdvanceModal';
import ESignatureModal from '../workflow/ESignatureModal';
import AuditHistoryModal from '../workflow/AuditHistoryModal';

export default function DocumentModalContainer({
  activeModal,
  user,
  onClose,
  onRefresh,
  onSelectVersion,
  onRequireESig,
  onDocumentUpdated
}) {
  if (!activeModal) return null;

  const { type, doc } = activeModal;

  return (
    <>
      {type === 'metadata' && (
        <MetadataEditorModal
          doc={doc}
          onClose={onClose}
          onSaved={() => { onClose(); onRefresh(); }}
        />
      )}
      {type === 'redact' && (
        <RedactionModal
          doc={doc}
          onClose={onClose}
          onRedacted={() => { onClose(); onRefresh(); }}
        />
      )}
      {type === 'notes' && (
        <StickyNotesModal
          doc={doc}
          onClose={onClose}
        />
      )}
      {type === 'blind' && (
        <BlindingModal
          doc={doc}
          onClose={onClose}
          onUpdated={() => { onClose(); onRefresh(); }}
        />
      )}
      {type === 'query' && (
        <RaiseQueryModal
          doc={doc}
          onClose={onClose}
          onQueryRaised={() => { onClose(); onRefresh(); }}
        />
      )}
      {type === 'link' && (
        <LinkDocumentModal
          doc={doc}
          onClose={onClose}
          onLinked={() => { onClose(); onRefresh(); }}
        />
      )}
      {type === 'history' && (
        <DocumentHistoryModal
          doc={doc}
          onClose={onClose}
          onSelectVersion={(v) => {
            onClose();
            if (onSelectVersion) onSelectVersion(v, doc);
          }}
        />
      )}
      {type === 'download' && (
        <CompliantDownloadModal
          doc={doc}
          onClose={onClose}
        />
      )}
      {type === 'advance_workflow' && (
        <WorkflowAdvanceModal
          doc={doc}
          user={user}
          onClose={onClose}
          onAdvanced={(updatedDoc) => {
            onRefresh();
            if (onDocumentUpdated) onDocumentUpdated(updatedDoc);
          }}
          onRequireESig={onRequireESig}
        />
      )}
      {type === 'esignature' && (
        <ESignatureModal
          doc={doc}
          user={user}
          onClose={onClose}
          onSigned={(updatedDoc) => {
            onRefresh();
            if (onDocumentUpdated) onDocumentUpdated(updatedDoc);
          }}
        />
      )}
      {type === 'audit_history' && (
        <AuditHistoryModal
          doc={doc}
          onClose={onClose}
        />
      )}
    </>
  );
}
