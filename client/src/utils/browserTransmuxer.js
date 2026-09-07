import { registerAc3Decoder } from '@mediabunny/ac3';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import {
  Input,
  Output,
  Conversion,
  ALL_FORMATS,
  BlobSource,
  Mp4OutputFormat,
  BufferTarget,
  StreamTarget,
} from 'mediabunny';

let decodersRegistered = false;

export function ensureDecodersRegistered() {
  if (!decodersRegistered) {
    try {
      registerAc3Decoder();
      console.log('✅ Mediabunny AC-3 & E-AC-3 WASM decoder registered');
    } catch (e) {
      console.warn('Failed to register AC-3 decoder:', e);
    }
    try {
      registerAacEncoder();
      console.log('✅ Mediabunny AAC WASM encoder registered');
    } catch (e) {
      console.warn('Failed to register AAC encoder:', e);
    }
    decodersRegistered = true;
  }
}

/**
 * In-browser remuxer that repackages MKV/HEVC/AC-3/E-AC-3 files directly on the user's laptop.
 * - The video track is copied directly (zero quality loss, super fast).
 * - Unsupported audio (Dolby E-AC-3, AC-3) is decoded via WASM and encoded to web-compatible AAC.
 * - Files under 1.8GB use fast in-memory BufferTarget.
 * - Larger files use chunked StreamTarget with fragmented MP4 to avoid memory limits.
 *
 * @param {File|Blob} file The input local video file
 * @param {Function} onProgress Callback (percentage: number 0-100, processedSeconds: number)
 * @param {AbortSignal} abortSignal Optional abort signal to cancel
 * @param {number} selectedAudioTrackIdx 0-indexed audio track to keep
 * @returns {Promise<{ url: string, blob: Blob }>}
 */
export async function transmuxForBrowser(file, onProgress, abortSignal, selectedAudioTrackIdx = 0) {
  ensureDecodersRegistered();

  const isLargeFile = file.size > 1.8 * 1024 * 1024 * 1024;
  let chunks = [];

  function createTargetAndFormat() {
    if (isLargeFile) {
      chunks = [];
      const writable = new WritableStream({
        write(chunk) {
          if (chunk && chunk.data) {
            chunks.push(chunk.data);
          }
        },
      });
      const target = new StreamTarget(writable, {
        chunked: true,
        chunkSize: 8 * 1024 * 1024,
      });
      return { target, format: new Mp4OutputFormat({ fastStart: 'fragmented' }) };
    } else {
      const target = new BufferTarget();
      return { target, format: new Mp4OutputFormat({ fastStart: 'in-memory' }) };
    }
  }

  let { target, format } = createTargetAndFormat();

  let input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  let output = new Output({
    format,
    target,
  });

  let conversion = null;

  try {
    conversion = await Conversion.init({
      input,
      output,
      video: {
        forceTranscode: false, // Copy video stream directly
      },
      audio: (track, n) => {
        const trackIdx = track.number !== undefined ? track.number - 1 : (n !== undefined ? n - 1 : 0);
        if (trackIdx === selectedAudioTrackIdx || trackIdx === 0) {
          return {
            numberOfChannels: 2, // Downmix 5.1 surround sound to 2-channel stereo for universal browser support
            forceTranscode: true,
          };
        }
        return { discard: true };
      },
      showWarnings: false,
    });
  } catch (err) {
    console.warn('Initial conversion init with audio filter failed, trying primary tracks with fresh output:', err);
    // Create completely fresh target, format, input, and output
    const fresh = createTargetAndFormat();
    target = fresh.target;
    format = fresh.format;

    input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });

    output = new Output({
      format,
      target,
    });

    conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: {
        forceTranscode: false,
      },
      audio: {
        numberOfChannels: 2,
        forceTranscode: true,
      },
      showWarnings: false,
    });
  }

  // Ensure audio was not discarded
  const discardedAudio = conversion.discardedTracks.find(
    (t) => t.track?.type === 'audio' && t.reason !== 'discarded_by_user'
  );
  const hasUtilizedAudio = conversion.utilizedTracks.some((t) => t.type === 'audio');
  if (discardedAudio && !hasUtilizedAudio) {
    console.error('Audio track was discarded! Reason:', discardedAudio.reason);
    throw new Error(`Audio track could not be encoded: ${discardedAudio.reason}`);
  }

  if (!conversion.isValid) {
    const reasons = conversion.discardedTracks.map((t) => `${t.reason}`).join(', ');
    throw new Error(`Video format conversion not supported for this file: ${reasons}`);
  }

  if (onProgress) {
    conversion.onProgress = (progress, processedTime) => {
      onProgress(Math.min(99, Math.round(progress * 100)), Math.round(processedTime));
    };
  }

  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      conversion.cancel().catch(() => {});
    });
  }

  await conversion.execute();

  if (onProgress) {
    onProgress(100, 0);
  }

  let finalBlob;
  if (isLargeFile) {
    finalBlob = new Blob(chunks, { type: 'video/mp4' });
  } else {
    finalBlob = new Blob([target.buffer], { type: 'video/mp4' });
  }

  const objectUrl = URL.createObjectURL(finalBlob);

  return {
    url: objectUrl,
    blob: finalBlob,
  };
}

