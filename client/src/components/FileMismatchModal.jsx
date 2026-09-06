import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export default function FileMismatchModal({
  myFileInfo,
  partnerFileInfo,
  onDismiss,
}) {
  if (!myFileInfo || !partnerFileInfo) return null;

  const diff = Math.abs((myFileInfo.duration || 0) - (partnerFileInfo.duration || 0));
  // If difference is less than 3 seconds, files are considered identical
  if (diff < 3) return null;

  return (
    <div className="mismatch-banner" role="alert">
      <div className="mismatch-info">
        <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
        <div>
          <strong>Different Video Duration Detected:</strong>
          <span style={{ marginLeft: '6px' }}>
            Your file is <strong>{formatDuration(myFileInfo.duration)}</strong>, but your partner's is <strong>{formatDuration(partnerFileInfo.duration)}</strong> ({Math.round(diff)}s difference). You might have different cuts or releases of the film.
          </span>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="mismatch-dismiss"
        title="Dismiss warning"
        aria-label="Dismiss warning"
      >
        <X size={18} />
      </button>
    </div>
  );
}
