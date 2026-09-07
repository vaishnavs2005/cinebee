import React from 'react';
import { RotateCw, CheckCircle2, AlertCircle, FileVideo, Clock, Upload } from 'lucide-react';

function formatDuration(sec) {
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export default function SyncStatusBar({
  isConnected,
  drift = 0,
  partnerFileInfo,
  myFileInfo,
  partnerPresent,
  onManualResync,
  onChangeVideo,
}) {
  const status = getSyncStatus();
  const StatusIcon = status.icon;

  function getSyncStatus() {
    if (!isConnected) {
      return { text: 'Disconnected', color: 'var(--status-error)', icon: AlertCircle };
    }
    if (!partnerPresent) {
      return { text: 'Waiting for partner to join...', color: 'var(--status-warning)', icon: AlertCircle };
    }
    if (Math.abs(drift) > 1.5) {
      return { text: `Correcting drift (${drift.toFixed(1)}s)`, color: 'var(--status-syncing)', icon: RotateCw };
    }
    return { text: `In Sync (±${Math.abs(drift).toFixed(2)}s)`, color: 'var(--status-connected)', icon: CheckCircle2 };
  }

  return (
    <div className="stage-footer">
      <div className="sync-indicators">
        <div className="sync-badge" style={{ color: status.color }}>
          <StatusIcon size={16} />
          <span>{status.text}</span>
        </div>

        {partnerPresent && (
          <div className="partner-file-badge">
            <FileVideo size={14} />
            <span>
              {partnerFileInfo
                ? `Partner: ${partnerFileInfo.fileName} (${formatDuration(partnerFileInfo.duration)})`
                : 'Partner hasn’t loaded a video yet'}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onManualResync}
          className="resync-btn"
          title="Force playback synchronization with your partner"
        >
          <RotateCw size={13} />
          <span>Resync</span>
        </button>
      </div>
    </div>
  );
}
