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
  Sun
} from 'lucide-react';
import FloatingReactions from './FloatingReactions';
import { generateSampleMovieBlob } from '../services/sampleVideoGenerator';
import { processSubtitleFile } from '../services/subtitleHelper';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return '00:00';
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
}) {
  const localVideoRef = useRef(null);
  const videoRef = videoRefExternal || localVideoRef;
  const containerRef = useRef(null);
  const seekerRef = useRef(null);
  const fileInputRef = useRef(null);
  const subInputRef = useRef(null);

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

  // Seeker hover tooltip state
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  // Subtitle track
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  // Echo guard flag to avoid sending back events that were triggered programmatically
  const isApplyingRemote = useRef(false);

  // Handle Loading Local Video File
  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|ogg|mkv|mov|m4v)$/i)) {
      if (onShowToast) onShowToast('Please select a valid video file (.mp4, .mkv, .webm)');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);
    setVideoName(file.name);

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
      if (onShowToast) onShowToast('Generating animated cinema test reel...');
      const sample = await generateSampleMovieBlob(120, 'Cine Nightly Test Reel');
      setVideoSrc(sample.url);
      setVideoName(sample.name);
      if (onShowToast) onShowToast('Test reel ready! Press play to test sync.');
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
    const dur = video.duration || 0;
    setDuration(dur);
    if (onMetadataLoaded) {
      onMetadataLoaded({
        fileName: videoName || 'Local Video',
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

  // Play / Pause Local Trigger
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (video.paused) {
      video.play().catch(console.error);
      setIsPlaying(true);
      if (!isApplyingRemote.current && onPlaybackAction) {
        onPlaybackAction('play', video.currentTime);
      }
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

    const newTime = Math.max(0, Math.min(duration, video.currentTime + delta));
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
    if (!video || !seeker || !duration) return;

    const rect = seeker.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;

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

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

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
      video.play().catch(console.error);
      setIsPlaying(true);
    } else if (remoteAction.type === 'pause') {
      video.currentTime = targetTime;
      video.pause();
      setIsPlaying(false);
    }

    // Release guard after small debounce
    const t = setTimeout(() => {
      isApplyingRemote.current = false;
    }, 350);

    return () => clearTimeout(t);
  }, [remoteAction]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input or textarea
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoSrc, isPlaying, duration, isMuted]);

  return (
    <div className="player-wrapper" onDrop={handleDrop} onDragOver={handleDragOver}>
      {/* Ambient backlight glow effect behind the player */}
      <div className={`ambient-glow ${!ambientGlow || !isPlaying ? 'dim' : ''}`} />

      <div className="video-container" ref={containerRef}>
        {/* Floating Reactions Overlay */}
        <FloatingReactions reactions={reactions} />

        {/* Video Element */}
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            onTimeUpdate={handleNativeTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
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
              onClick={() => fileInputRef.current?.click()}
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
          accept="video/*,.mkv,.mp4,.webm,.mov"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
        <input
          type="file"
          ref={subInputRef}
          style={{ display: 'none' }}
          accept=".srt,.vtt"
          onChange={(e) => handleSubtitleSelect(e.target.files?.[0])}
        />

        {/* Cinema Controls Bar */}
        {videoSrc && (
          <div className="cinema-controls">
            {/* Seeker / Progress */}
            <div
              className="seeker-wrapper"
              ref={seekerRef}
              onClick={handleSeekClick}
              onMouseMove={handleSeekerMouseMove}
              onMouseLeave={handleSeekerMouseLeave}
            >
              <div className="seeker-track">
                {/* Buffered bar */}
                <div
                  className="seeker-buffer"
                  style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
                />
                {/* Current progress fill */}
                <div
                  className="seeker-fill"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* Scrubber thumb */}
                <div
                  className="seeker-thumb"
                  style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              {/* Hover Tooltip */}
              {hoverTime !== null && (
                <div className="seeker-tooltip" style={{ left: `${hoverPosition}px` }}>
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="controls-row">
              <div className="controls-left">
                <button
                  className="ctrl-btn play-pause-btn"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '2px' }} />}
                </button>

                <button
                  className="ctrl-btn"
                  onClick={() => handleRelativeSeek(-5)}
                  title="Rewind 5 seconds"
                >
                  <RotateCcw size={17} />
                </button>

                <button
                  className="ctrl-btn"
                  onClick={() => handleRelativeSeek(5)}
                  title="Forward 5 seconds"
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

                {/* Change video button */}
                <button
                  className="ctrl-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Load a different video file"
                >
                  <Upload size={17} />
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
