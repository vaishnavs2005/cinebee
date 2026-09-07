import { registerAc3Decoder } from '@mediabunny/ac3';
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
      decodersRegistered = true;
      console.log('✅ Mediabunny AC-3 & E-AC-3 WASM decoders registered');
    } catch (e) {
      console.warn('Failed to register AC-3 decoder:', e);
    }
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
  let target;
  let chunks = [];
  let format;

  if (isLargeFile) {
    const writable = new WritableStream({
      write(chunk) {
        if (chunk && chunk.data) {
          chunks.push(chunk.data);
        }
      },
    });
    target = new StreamTarget(writable, {
      chunked: true,
      chunkSize: 8 * 1024 * 1024,
    });
    format = new Mp4OutputFormat({ fastStart: 'fragmented' });
  } else {
    target = new BufferTarget();
    format = new Mp4OutputFormat({ fastStart: 'in-memory' });
  }

  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  const output = new Output({
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
        // Keep the selected audio track, transcode to AAC
        const trackIdx = (n !== undefined ? n - 1 : 0);
        if (trackIdx === selectedAudioTrackIdx || trackIdx === 0) {
          return {
            codec: 'aac',
            forceTranscode: true,
          };
        }
        return { discard: true };
      },
      showWarnings: false,
    });
  } catch (err) {
    console.warn('Initial conversion init with audio filter failed, trying primary tracks:', err);
    conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: {
        forceTranscode: false,
      },
      audio: {
        codec: 'aac',
        forceTranscode: true,
      },
      showWarnings: false,
    });
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

