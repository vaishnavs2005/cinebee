import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Upload,
  Subtitles,
  Film,
  Sparkles,
  Sun,
  Lock,
  Shield,
  Crown,
  AlertTriangle
} from 'lucide-react';
import FloatingReactions from './FloatingReactions';
import FullscreenChatOverlay from './FullscreenChatOverlay';
import { generateSampleMovieBlob } from '../services/sampleVideoGenerator';
import { processSubtitleFile } from '../services/subtitleHelper';

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds === null || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({
  onPlaybackAction, // (type: 'play' | 'pause' | 'seek', time: number)
  onMetadataLoaded, // (fileInfo: { fileName, duration, fileSize })
  onTimeUpdate,     // (currentTime: number)
  remoteAction,     // { type, time, timestamp }
  reactions = [],
  onShowToast,
  videoRefExternal,
  messages = [],
  currentUser,
  isHost,
  controlMode = 'co-op',
  onToggleControlMode,
  onRegisterChangeVideoTrigger,
  onSendMessage,
  onSendReaction,
  onSeekToTime,
}) {
  const localVideoRef = useRef(null);
  const videoRef = videoRefExternal || localVideoRef;
  const containerRef = useRef(null);
  const seekerRef = useRef(null);
  const fileInputRef = useRef(null);
  const subInputRef = useRef(null);
  const sampleDurationRef = useRef(null);
  const currentFileNameRef = useRef('Local Video');

  const [videoSrc, setVideoSrc] = useState(null);
  const [videoName, setVideoName] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ambientGlow, setAmbientGlow] = useState(true);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [videoError, setVideoError] = useState(null);

  // Seeker hover tooltip state
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  // Subtitle track
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  // Auto-hide controls after 5 seconds of inactivity
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef(null);
  const isHoveringControlsRef = useRef(false);

  // Register the external change video trigger callback
  useEffect(() => {
    if (onRegisterChangeVideoTrigger) {
      onRegisterChangeVideoTrigger(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
          fileInputRef.current.click();
        }
      });
    }
  }, [onRegisterChangeVideoTrigger]);

  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    if (isPlaying && !isHoveringControlsRef.current) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 5000);
    }
  }, [isPlaying]);

  const handleUserActivity = useCallback(() => {
    resetControlsTimer();
  }, [resetControlsTimer]);

  useEffect(() => {
    if (!isPlaying) {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = null;
      }
      setControlsVisible(true);
    } else {
      resetControlsTimer();
    }
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [isPlaying, resetControlsTimer]);

  // Guard flag to prevent local DOM events from echo-triggering remote actions
  const isApplyingRemote = useRef(false);

  // Handle Loading Local Video File
  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    setVideoError(null);
    sampleDurationRef.current = null;
    currentFileNameRef.current = file.name;

    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);
    setVideoName(file.name);
    setIsPlaying(false);

    if (onShowToast) onShowToast(`Loaded: ${file.name}`);
  }, [onShowToast]);

  // Handle Drag and Drop
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.match(/\.(srt|vtt)$/i)) {
        handleSubtitleSelect(file);
      } else {
        handleFileSelect(file);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Generate Sample Cinema Video for instant testing
  const handleGenerateSampleVideo = async () => {
    try {
      setIsGeneratingDemo(true);
      setVideoError(null);
      if (onShowToast) onShowToast('Generating animated cinema test reel (1-2s)...');

      const sample = await generateSampleMovieBlob(10, 'CineBee Cinema Reel');
      sampleDurationRef.current = sample.duration;
      currentFileNameRef.current = sample.name;

      setVideoSrc(sample.url);
      setVideoName(sample.name);
      setDuration(sample.duration);
      setIsPlaying(false);

      if (onShowToast) onShowToast('Cinema test reel ready! Press play to test sync.');
    } catch (err) {
      console.error('Failed to generate sample video:', err);
      if (onShowToast) onShowToast('Failed to generate sample reel');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  // Handle Subtitle File
  const handleSubtitleSelect = async (file) => {
    try {
      const sub = await processSubtitleFile(file);
      setSubtitleTrackUrl(sub.url);
      setSubtitlesEnabled(true);
      if (onShowToast) onShowToast(`Subtitles loaded: ${sub.name}`);
    } catch (err) {
      console.error('Subtitle parse error:', err);
      if (onShowToast) onShowToast('Failed to load subtitle file');
    }
  };

  // Listen for video duration and metadata
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    let dur = video.duration;
    if (!isFinite(dur) || isNaN(dur) || dur <= 0) {
      dur = sampleDurationRef.current || 0;
    }
    setDuration(dur);
    setVideoError(null);

    if (onMetadataLoaded) {
      onMetadataLoaded({
        fileName: currentFileNameRef.current || videoName || 'Local Video',
        duration: dur,
        fileSize: 0,
      });
    }
  };

  // Video Time & Progress Updates
  const handleNativeTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime;
    setCurrentTime(cur);
    if (onTimeUpdate) onTimeUpdate(cur);

    if (video.buffered.length > 0) {
      for (let i = video.buffered.length - 1; i >= 0; i--) {
        if (video.buffered.start(i) <= cur) {
          setBuffered(video.buffered.end(i));
          break;
        }
      }
    }
  };

  // Check if current user has permission to control playback
  const canControlPlayback = controlMode === 'co-op' || isHost;

  // Play / Pause Local Trigger
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    // Check host-only permission
    if (!canControlPlayback) {
      if (onShowToast) onShowToast('🔒 Host-Only Mode is active: Only the room host can control playback.');
      return;
    }

    if (video.paused) {
      video.play()
        .then(() => {
          setIsPlaying(true);
          setVideoError(null);
          if (!isApplyingRemote.current && onPlaybackAction) {
            onPlaybackAction('play', video.currentTime);
          }
        })
        .catch((err) => {
          console.warn('Playback play() was blocked or failed:', err);
          if (err.name === 'NotAllowedError') {
            if (onShowToast) onShowToast('⚠️ Autoplay blocked by browser. Click video to play.');
          } else {
            setVideoError('Browser could not play this format. Please select an MP4 (H.264) or WebM file.');
          }
        });
    } else {
      video.pause();
      setIsPlaying(false);
      if (!isApplyingRemote.current && onPlaybackAction) {
        onPlaybackAction('pause', video.currentTime);
      }
    }
  };

  // Relative Seek (-5s, +5s)
  const handleRelativeSeek = (delta) => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (!canControlPlayback) {
      if (onShowToast) onShowToast('🔒 Host-Only Mode is active: Only the room host can seek.');
      return;
    }

    const maxDuration = isFinite(duration) && duration > 0 ? duration : (video.duration || 0);
    const newTime = Math.max(0, Math.min(maxDuration, (video.currentTime || 0) + delta));
    if (!isFinite(newTime)) return;

    video.currentTime = newTime;
    setCurrentTime(newTime);

    if (!isApplyingRemote.current && onPlaybackAction) {
      onPlaybackAction('seek', newTime);
    }
  };

  // Seeker Click / Scrub
  const handleSeekClick = (e) => {
    const video = videoRef.current;
    const seeker = seekerRef.current;
    if (!video || !seeker || !duration || !isFinite(duration) || duration <= 0) return;

    if (!canControlPlayback) {
      if (onShowToast) onShowToast('🔒 Host-Only Mode: Only the room host can seek.');
      return;
    }

    const rect = seeker.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    if (!isFinite(targetTime)) return;

    video.currentTime = targetTime;
    setCurrentTime(targetTime);

    if (!isApplyingRemote.current && onPlaybackAction) {
      onPlaybackAction('seek', targetTime);
    }
  };

  // Seeker Hover for Tooltip
  const handleSeekerMouseMove = (e) => {
    const seeker = seekerRef.current;
    if (!seeker || !duration) return;
    const rect = seeker.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(e.clientX - rect.left);
    setHoverTime(pos * duration);
  };

  const handleSeekerMouseLeave = () => {
    setHoverTime(null);
  };

  // Volume & Mute
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(console.error);
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.error);
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  // Sync fullscreen state with document events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isNowFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Remote Action Handling (Applying peer's play/pause/seek)
  useEffect(() => {
    if (!remoteAction || !videoRef.current) return;
    const video = videoRef.current;

    isApplyingRemote.current = true;
    const targetTime = remoteAction.time;

    if (remoteAction.type === 'seek') {
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    } else if (remoteAction.type === 'play') {
      if (Math.abs(video.currentTime - targetTime) > 0.4) {
        video.currentTime = targetTime;
      }
      video.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn('Remote play blocked by browser:', err);
          // If browser blocked sound autoplay, mute and resume
          if (err.name === 'NotAllowedError') {
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => setIsPlaying(true)).catch(() => {});
            if (onShowToast) onShowToast('🔇 Partner started playback (click unmute to enable audio)');
          }
        });
    } else if (remoteAction.type === 'pause') {
      video.currentTime = targetTime;
      video.pause();
      setIsPlaying(false);
    }

    const t = setTimeout(() => {
      isApplyingRemote.current = false;
    }, 350);

    return () => clearTimeout(t);
  }, [remoteAction, onShowToast]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleRelativeSeek(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleRelativeSeek(5);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
      resetControlsTimer();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoSrc, isPlaying, duration, isMuted, canControlPlayback, resetControlsTimer]);

  const triggerOpenVideoPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="player-wrapper" onDrop={handleDrop} onDragOver={handleDragOver}>
      {/* Ambient backlight glow effect behind the player */}
      <div className={`ambient-glow ${!ambientGlow || !isPlaying ? 'dim' : ''}`} />

      <div
        className={`video-container ${!controlsVisible && isPlaying ? 'controls-hidden' : ''}`}
        ref={containerRef}
        onMouseMove={handleUserActivity}
        onTouchStart={handleUserActivity}
        onClick={handleUserActivity}
      >
        {/* Floating Reactions Overlay */}
        <FloatingReactions reactions={reactions} />

        {/* Fullscreen Interactive Chat Overlay */}
        <FullscreenChatOverlay
          isFullscreen={isFullscreen}
          messages={messages}
          currentUser={currentUser}
          currentVideoTime={currentTime}
          onSendMessage={onSendMessage}
          onSendReaction={onSendReaction}
          onSeekToTime={onSeekToTime}
        />

        {/* Top Header Bar inside Video Player */}
        {videoSrc && !videoError && (
          <div className={`player-top-bar ${controlsVisible || !isPlaying ? 'visible' : ''}`}>
            <div className="player-file-info">
              <Film size={15} color="#ff2a6d" />
              <span className="player-file-name" title={videoName}>{videoName}</span>
            </div>

            <div className="player-top-actions">
              {controlMode === 'host-only' && (
                <div
                  className={`player-mode-badge ${isHost ? 'host' : 'guest'}`}
                  title={isHost ? 'You have full playback control' : 'Only the host can control playback'}
                >
                  {isHost ? <Crown size={13} color="#f59e0b" /> : <Lock size={13} color="#ff2a6d" />}
                  <span>{isHost ? 'Host Controls Active' : 'Host-Only Mode (Locked)'}</span>
                </div>
              )}

              <button
                className="player-change-video-pill"
                onClick={triggerOpenVideoPicker}
                title="Choose a different video file"
              >
                <Upload size={13} />
                <span>Change Video</span>
              </button>
            </div>
          </div>
        )}

        {/* Video Element or Dropzone or Error View */}
        {videoSrc && !videoError ? (
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            onTimeUpdate={handleNativeTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
            onError={(e) => {
              console.error('HTML5 video playback error:', e);
              setVideoError('Unable to play this video format or codec in your browser (common with MKV / HEVC). Please select an MP4 (H.264) or WebM video file, or test with the Demo Reel.');
            }}
          >
            {subtitleTrackUrl && subtitlesEnabled && (
              <track
                kind="subtitles"
                src={subtitleTrackUrl}
                default
                label="English"
              />
            )}
          </video>
        ) : videoError ? (
          <div className="video-error-overlay">
            <div className="video-error-icon">
              <AlertTriangle size={42} color="#f43f5e" />
            </div>
            <h3 className="video-error-title">Unable to Play Video</h3>
            <p className="video-error-desc">{videoError}</p>
            <div className="video-error-actions">
              <button
                className="btn-file-select"
                onClick={triggerOpenVideoPicker}
              >
                <Upload size={18} /> Choose Another Video File (MP4/WebM)
              </button>
              <button
                className="dropzone-demo-btn"
                onClick={handleGenerateSampleVideo}
                disabled={isGeneratingDemo}
              >
                <Sparkles size={14} color="#ec4899" />
                {isGeneratingDemo ? 'Generating Reel...' : 'Test with Demo Reel'}
              </button>
            </div>
          </div>
        ) : (
          <div className="dropzone-overlay">
            <div className="dropzone-icon">
              <Film size={36} />
            </div>
            <h3 className="dropzone-title">Load Movie File</h3>
            <p className="dropzone-desc">
              Drag & drop your local video file here, or click to choose from your device.
              Files stay 100% on your device and are never uploaded.
            </p>

            <button
              className="btn-file-select"
              onClick={triggerOpenVideoPicker}
            >
              <Upload size={18} /> Choose Video File
            </button>

            <button
              className="dropzone-demo-btn"
              onClick={handleGenerateSampleVideo}
              disabled={isGeneratingDemo}
            >
              <Sparkles size={14} color="#ec4899" />
              {isGeneratingDemo ? 'Generating Reel...' : 'Generate Demo Reel (Instant Test)'}
            </button>
          </div>
        )}

        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="video/*,.mkv,.mp4,.webm,.mov,.m4v"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
        <input
          type="file"
          ref={subInputRef}
          style={{ display: 'none' }}
          accept=".srt,.vtt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSubtitleSelect(file);
          }}
        />

        {/* Cinema Controls Bar */}
        {videoSrc && !videoError && (
          <div
            className={`cinema-controls ${controlsVisible || !isPlaying ? 'visible' : ''}`}
            onMouseEnter={() => {
              isHoveringControlsRef.current = true;
              if (hideControlsTimerRef.current) {
                clearTimeout(hideControlsTimerRef.current);
                hideControlsTimerRef.current = null;
              }
              setControlsVisible(true);
            }}
            onMouseLeave={() => {
              isHoveringControlsRef.current = false;
              resetControlsTimer();
            }}
          >
            {/* Seeker / Progress */}
            <div
              className={`seeker-wrapper ${!canControlPlayback ? 'locked' : ''}`}
              ref={seekerRef}
              onClick={handleSeekClick}
              onMouseMove={handleSeekerMouseMove}
              onMouseLeave={handleSeekerMouseLeave}
              title={!canControlPlayback ? 'Seek locked: Host-Only Mode is active' : ''}
            >
              <div className="seeker-track">
                {/* Buffered bar */}
                <div
                  className="seeker-buffer"
                  style={{ width: `${isFinite(duration) && duration > 0 ? (buffered / duration) * 100 : 0}%` }}
                />
                {/* Current progress fill */}
                <div
                  className="seeker-fill"
                  style={{ width: `${isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* Scrubber thumb */}
                <div
                  className="seeker-thumb"
                  style={{ left: `${isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              {/* Hover Tooltip */}
              {hoverTime !== null && canControlPlayback && (
                <div className="seeker-tooltip" style={{ left: `${hoverPosition}px` }}>
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="controls-row">
              <div className="controls-left">
                <button
                  className={`ctrl-btn play-pause-btn ${!canControlPlayback ? 'locked-btn' : ''}`}
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  title={!canControlPlayback ? 'Host-Only Mode (Only host can play/pause)' : (isPlaying ? 'Pause' : 'Play')}
                >
                  {!canControlPlayback ? (
                    <Lock size={18} color="#ff2a6d" />
                  ) : isPlaying ? (
                    <Pause size={20} />
                  ) : (
                    <Play size={20} style={{ marginLeft: '2px' }} />
                  )}
                </button>

                <button
                  className={`ctrl-btn ${!canControlPlayback ? 'disabled' : ''}`}
                  onClick={() => handleRelativeSeek(-5)}
                  title={canControlPlayback ? 'Rewind 5 seconds' : 'Rewind locked to Host'}
                  disabled={!canControlPlayback}
                >
                  <RotateCcw size={17} />
                </button>

                <button
                  className={`ctrl-btn ${!canControlPlayback ? 'disabled' : ''}`}
                  onClick={() => handleRelativeSeek(5)}
                  title={canControlPlayback ? 'Forward 5 seconds' : 'Forward locked to Host'}
                  disabled={!canControlPlayback}
                >
                  <RotateCw size={17} />
                </button>

                <div className="volume-container">
                  <button className="ctrl-btn" onClick={toggleMute} title="Mute/Unmute">
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                  />
                </div>

                <div className="time-display">
                  <span className="time-current">{formatTime(currentTime)}</span>
                  <span> / </span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="controls-right">
                {/* Prominent Change Video Button */}
                <button
                  className="ctrl-btn ctrl-change-video-btn"
                  onClick={triggerOpenVideoPicker}
                  title="Choose or switch video file"
                >
                  <Upload size={15} />
                  <span>Change Video</span>
                </button>

                {/* Ambient glow toggle */}
                <button
                  className={`ctrl-btn ${ambientGlow ? 'active' : ''}`}
                  onClick={() => setAmbientGlow(!ambientGlow)}
                  title="Ambient Backlight Glow"
                >
                  <Sun size={17} />
                </button>

                {/* Subtitles toggle / loader */}
                <button
                  className={`ctrl-btn ${subtitleTrackUrl && subtitlesEnabled ? 'active' : ''}`}
                  onClick={() => {
                    if (subtitleTrackUrl) {
                      setSubtitlesEnabled(!subtitlesEnabled);
                    } else {
                      subInputRef.current?.click();
                    }
                  }}
                  title={subtitleTrackUrl ? 'Toggle Subtitles' : 'Load Subtitles (.srt, .vtt)'}
                >
                  <Subtitles size={17} />
                </button>

                {/* Fullscreen */}
                <button
                  className="ctrl-btn"
                  onClick={toggleFullscreen}
                  title="Toggle Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
