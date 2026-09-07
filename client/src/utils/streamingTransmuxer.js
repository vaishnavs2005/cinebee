import { registerAc3Decoder } from '@mediabunny/ac3';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import {
  Input,
  Output,
  Conversion,
  ALL_FORMATS,
  BlobSource,
  Mp4OutputFormat,
  StreamTarget,
  EncodedPacketSink,
} from 'mediabunny';

let decodersRegistered = false;

export function ensureDecodersRegistered() {
  if (!decodersRegistered) {
    try {
      registerAc3Decoder();
    } catch (e) {
      console.warn('AC-3 decoder registration note:', e);
    }
    try {
      registerAacEncoder();
    } catch (e) {
      console.warn('AAC encoder registration note:', e);
    }
    decodersRegistered = true;
  }
}

/**
 * Progressive streaming controller using MediaSource Extensions (MSE)
 * and fragmented MP4 (fMP4) chunks.
 *
 * - Begins playback immediately after ~1.5-2 seconds of buffering.
 * - Streams and converts audio/video progressively in the background.
 * - Supports on-demand instant seeking to arbitrary timestamps (e.g. 1 hour ahead)
 *   by starting a fresh segment at the target timestamp.
 */
export class MseStreamController {
  constructor(file, options = {}) {
    this.file = file;
    this.options = options;
    this.selectedAudioTrackIndex = options.selectedAudioTrackIndex ?? 0;
    this.videoElement = options.videoElement ?? null;
    this.onStatus = options.onStatus ?? (() => {});
    this.onError = options.onError ?? (() => {});
    this.onReady = options.onReady ?? (() => {});

    this.mediaSource = new MediaSource();
    this.mediaUrl = URL.createObjectURL(this.mediaSource);
    this.sourceBuffer = null;
    this.appendQueue = [];
    this.isAppending = false;

    this.currentAbortController = null;
    this.currentConversion = null;
    this.isDestroyed = false;
    this.hasStartedPlayback = false;
    this.shouldBePlaying = true;
    this.isAwaitingSeekBuffer = false;
    this.totalDuration = options.duration || 0;
    this.currentStreamOffset = 0;

    ensureDecodersRegistered();
    this.bindVideoListeners();

    this.sourceOpenTimer = setTimeout(() => {
      if (!this.sourceBuffer && !this.isDestroyed) {
        console.warn('MediaSource sourceopen timeout (4s). Falling back to direct remuxing.');
        this.onError(new Error('MediaSource sourceopen timeout'));
      }
    }, 4000);

    const onOpen = () => {
      if (this.sourceOpenTimer) {
        clearTimeout(this.sourceOpenTimer);
        this.sourceOpenTimer = null;
      }
      this.handleSourceOpen();
    };

    if (this.mediaSource.readyState === 'open') {
      onOpen();
    } else {
      this.mediaSource.addEventListener('sourceopen', onOpen, { once: true });
    }
  }

  getMediaUrl() {
    return this.mediaUrl;
  }

  setVideoElement(el) {
    if (this.videoElement === el) return;
    this.videoElement = el;
    this.bindVideoListeners();
  }

  bindVideoListeners() {
    if (!this.videoElement || this.listenersBound) return;
    this.videoElement.addEventListener('play', () => {
      this.shouldBePlaying = true;
    });
    this.videoElement.addEventListener('pause', () => {
      this.shouldBePlaying = false;
    });
    this.listenersBound = true;
  }

  setTotalDuration(duration) {
    if (duration > 0 && isFinite(duration)) {
      this.totalDuration = duration;
      try {
        if (this.mediaSource && this.mediaSource.readyState === 'open') {
          this.mediaSource.duration = duration;
        }
      } catch (e) {
        console.warn('Set mediaSource duration note:', e);
      }
    }
  }

  async handleSourceOpen() {
    if (this.isDestroyed) return;

    try {
      const mimeType = await this.detectMimeType();
      this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeType);
      this.sourceBuffer.mode = 'segments';

      this.sourceBuffer.addEventListener('updateend', () => {
        this.isAppending = false;
        if (this.sourceBuffer && this.sourceBuffer.buffered && this.sourceBuffer.buffered.length > 0) {
          const buffered = this.sourceBuffer.buffered;
          // Bridge any keyframe or pre-frame gap so player doesn't stall waiting for missing frames
          if (this.videoElement) {
            const cur = this.videoElement.currentTime;
            for (let i = 0; i < buffered.length; i++) {
              const bStart = buffered.start(i);
              const bEnd = buffered.end(i);
              if (cur < bStart && bStart - cur < 6.0) {
                this.videoElement.currentTime = bStart + 0.02;
                break;
              }
            }

            // Only auto-play on the initial seek chunk landing if user was actively playing
            if (this.isAwaitingSeekBuffer) {
              this.isAwaitingSeekBuffer = false;
              if (this.shouldBePlaying && this.videoElement.paused) {
                this.videoElement.play().catch((err) => {
                  console.warn('Playback resume note:', err);
                });
              }
            }
          }

          if (!this.hasStartedPlayback) {
            this.hasStartedPlayback = true;
            this.onReady();
          } else {
            // Dismiss seek buffering indicator once buffer has landed
            this.onStatus({ status: 'streaming' });
          }
        }
        this.processAppendQueue();
      });

      this.sourceBuffer.addEventListener('error', (e) => {
        console.error('SourceBuffer error event:', e);
      });

      if (this.totalDuration > 0 && isFinite(this.totalDuration)) {
        try {
          this.mediaSource.duration = this.totalDuration;
        } catch (e) {
          console.warn('MediaSource initial duration note:', e);
        }
      }

      // Start stream segment from 00:00
      this.startStreamSegment(0);
    } catch (err) {
      console.error('Failed to initialize SourceBuffer:', err);
      this.onError(err);
    }
  }

  async detectMimeType() {
    try {
      const input = new Input({
        source: new BlobSource(this.file),
        formats: ALL_FORMATS,
      });
      const videoTrack = await input.getPrimaryVideoTrack();
      if (videoTrack) {
        const codec = await videoTrack.getCodec();
        if (codec === 'hevc') {
          const hevcCandidates = [
            'video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"',
            'video/mp4; codecs="hev1.1.6.L93.B0, mp4a.40.2"',
            'video/mp4; codecs="hvc1, mp4a.40.2"',
            'video/mp4; codecs="hvc1.1.6.L93.B0"',
          ];
          for (const cand of hevcCandidates) {
            if (MediaSource.isTypeSupported(cand)) return cand;
          }
          throw new Error('HEVC playback via MediaSource is not supported by your browser');
        } else if (codec === 'avc') {
          return 'video/mp4; codecs="avc1.640028, mp4a.40.2"';
        } else if (codec === 'vp9') {
          return 'video/mp4; codecs="vp09.00.10.08, mp4a.40.2"';
        }
      }
    } catch (e) {
      console.warn('Codec detection note:', e);
    }

    const fallbacks = [
      'video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"',
      'video/mp4; codecs="avc1.640028, mp4a.40.2"',
      'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    ];
    for (const fb of fallbacks) {
      if (MediaSource.isTypeSupported(fb)) return fb;
    }
    return 'video/mp4; codecs="avc1.640028, mp4a.40.2"';
  }

  queueChunk(data) {
    if (this.isDestroyed || !data || data.byteLength === 0) return;
    this.appendQueue.push(data);
    this.processAppendQueue();
  }

  processAppendQueue() {
    if (
      this.isDestroyed ||
      !this.sourceBuffer ||
      this.isAppending ||
      this.sourceBuffer.updating ||
      this.appendQueue.length === 0
    ) {
      return;
    }

    const nextChunk = this.appendQueue.shift();
    try {
      this.isAppending = true;
      this.sourceBuffer.appendBuffer(nextChunk);
    } catch (err) {
      this.isAppending = false;
      console.error('Error appending chunk to SourceBuffer:', err);
      if (err.name === 'QuotaExceededError') {
        this.evictBuffer();
      }
    }
  }

  evictBuffer() {
    if (!this.sourceBuffer || this.sourceBuffer.updating) return;
    try {
      const buffered = this.sourceBuffer.buffered;
      if (buffered.length > 0 && buffered.end(0) - buffered.start(0) > 120) {
        this.sourceBuffer.remove(buffered.start(0), buffered.start(0) + 60);
      }
    } catch (e) {
      console.warn('Buffer eviction note:', e);
    }
  }

  /**
   * Start generating fragmented MP4 stream from a given start timestamp.
   * Can be called whenever the user seeks on-demand.
   */
  async startStreamSegment(startTime = 0) {
    if (this.isDestroyed) return;

    // Abort any currently running conversion worker
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    this.currentStreamOffset = startTime;
    this.onStatus({
      status: 'buffering',
      startTime,
      message: startTime === 0 ? 'Buffering start for instant playback...' : `Jumping to ${Math.round(startTime)}s...`,
    });

    try {
      const writable = new WritableStream({
        write: (chunk) => {
          if (signal.aborted || this.isDestroyed) return;
          if (chunk && chunk.data) {
            this.queueChunk(chunk.data);
          }
        },
      });

      const target = new StreamTarget(writable, {
        chunked: false, // Stream fragments immediately as soon as ready!
      });

      const format = new Mp4OutputFormat({
        fastStart: 'fragmented',
        minimumFragmentDuration: 1.0, // 1.0s fragments for near-instant responsiveness
      });

      const input = new Input({
        source: new BlobSource(this.file),
        formats: ALL_FORMATS,
      });

      const output = new Output({
        format,
        target,
      });

      const conversionOptions = {
        input,
        output,
        video: {
          forceTranscode: false, // Stream passthrough - zero re-encoding loss
        },
        audio: (track, n) => {
          const trackIdx = track.number !== undefined ? track.number - 1 : (n !== undefined ? n - 1 : 0);
          if (trackIdx === this.selectedAudioTrackIndex || trackIdx === 0) {
            return {
              numberOfChannels: 2, // Downmix 5.1/7.1 to 2-channel stereo for universal browser support
              forceTranscode: true,
            };
          }
          return { discard: true };
        },
        showWarnings: false,
      };

      if (startTime > 0) {
        conversionOptions.trim = {
          start: startTime,
        };
      }

      this.currentConversion = await Conversion.init(conversionOptions);

      if (signal.aborted || this.isDestroyed) return;

      this.currentConversion.onProgress = (progress, processedTime) => {
        if (!signal.aborted && !this.isDestroyed) {
          this.onStatus({
            status: 'streaming',
            progress: Math.min(100, Math.round(progress * 100)),
            processedTime: (startTime || 0) + (processedTime || 0),
          });
        }
      };

      await this.currentConversion.execute({ pauseSignal: signal });

      if (!signal.aborted && !this.isDestroyed) {
        this.onStatus({ status: 'complete' });
      }
    } catch (err) {
      if (!signal.aborted && !this.isDestroyed) {
        console.error('Streaming conversion error:', err);
        this.onError(err);
      }
    }
  }

  /**
   * On-demand seek: jumps directly to the target timestamp without waiting for full conversion.
   */
  async seek(targetTime) {
    if (this.isDestroyed) return true;

    if (this.videoElement) {
      this.shouldBePlaying = !this.videoElement.paused;
    }

    // 1. Check if targetTime is already inside a buffered range
    if (this.sourceBuffer && this.sourceBuffer.buffered) {
      const buffered = this.sourceBuffer.buffered;
      for (let i = 0; i < buffered.length; i++) {
        if (targetTime >= buffered.start(i) && targetTime <= buffered.end(i) - 0.5) {
          if (this.videoElement) {
            this.videoElement.currentTime = targetTime;
            if (this.shouldBePlaying && this.videoElement.paused) {
              this.videoElement.play().catch(() => {});
            }
          }
          this.onStatus({ status: 'streaming' });
          return true;
        }
      }
    }

    this.isAwaitingSeekBuffer = true;

    // 2. Find closest preceding keyframe timestamp for clean, instantaneous start
    let keyframeTime = targetTime;
    try {
      const input = new Input({
        source: new BlobSource(this.file),
        formats: ALL_FORMATS,
      });
      const videoTrack = await input.getPrimaryVideoTrack();
      if (videoTrack) {
        const sink = new EncodedPacketSink(videoTrack);
        const keyPacket = await sink.getKeyPacket(targetTime);
        if (keyPacket && isFinite(keyPacket.timestamp)) {
          keyframeTime = Math.max(0, keyPacket.timestamp);
        }
      }
    } catch (e) {
      console.warn('Keyframe packet lookup note:', e);
    }

    // 3. Clear unplayed append queue
    this.appendQueue = [];

    // 4. Abort ongoing conversion worker
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }

    // 5. Wait for sourceBuffer to finish any current update
    if (this.sourceBuffer && this.sourceBuffer.updating) {
      await new Promise((resolve) => {
        const onUpdateEnd = () => {
          this.sourceBuffer.removeEventListener('updateend', onUpdateEnd);
          resolve();
        };
        this.sourceBuffer.addEventListener('updateend', onUpdateEnd, { once: true });
      });
    }

    // 6. Abort parser state and set timestampOffset to keyframeTime
    try {
      if (this.sourceBuffer && this.mediaSource.readyState === 'open') {
        this.sourceBuffer.abort();
        this.sourceBuffer.timestampOffset = keyframeTime;
      }
    } catch (e) {
      console.warn('SourceBuffer offset note:', e);
    }

    // Prime the video element playhead to the keyframe so the first fragment starts playing immediately
    if (this.videoElement) {
      this.videoElement.currentTime = keyframeTime;
    }

    // 7. Start new segment from keyframeTime
    await this.startStreamSegment(keyframeTime);
    return false;
  }

  destroy() {
    this.isDestroyed = true;
    if (this.sourceOpenTimer) {
      clearTimeout(this.sourceOpenTimer);
      this.sourceOpenTimer = null;
    }
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.appendQueue = [];
    try {
      if (this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream();
      }
    } catch (e) {}
    try {
      URL.revokeObjectURL(this.mediaUrl);
    } catch (e) {}
  }
}
