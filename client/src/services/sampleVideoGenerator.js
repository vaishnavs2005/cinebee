import fixWebmDuration from 'fix-webm-duration';

/**
 * Procedurally generates an animated cinematic test video Blob using HTML5 Canvas
 * and MediaRecorder.
 *
 * Displays:
 * - High-precision cinema timecode (MM:SS.ms)
 * - Radial countdown dial with glowing sweep
 * - Frame counter & FPS indicator
 * - Audio-synced visual pulse bars
 * - EBML duration metadata patching so HTML5 video duration is seekable and scrubbable!
 */
export async function generateSampleMovieBlob(durationSeconds = 10, title = 'Meowvie Cinema Reel') {
  return new Promise(async (resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');

      const fps = 30;
      const stream = canvas.captureStream(fps);

      // Select supported MIME type
      let selectedMimeType = 'video/webm';
      const candidateTypes = [
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/webm',
        'video/mp4',
      ];
      for (const t of candidateTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
          selectedMimeType = t;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const durationMs = durationSeconds * 1000;

      recorder.onstop = async () => {
        try {
          if (chunks.length === 0) {
            throw new Error('MediaRecorder produced no data chunks');
          }

          const rawBlob = new Blob(chunks, { type: selectedMimeType });

          // Patch duration header using fixWebmDuration
          // Note: 3rd arg must be undefined so it returns a Promise instead of expecting a callback
          let finalBlob = rawBlob;
          try {
            if (typeof fixWebmDuration === 'function' && rawBlob.size > 0) {
              finalBlob = await fixWebmDuration(rawBlob, durationMs, undefined, { logger: false });
            }
          } catch (fixErr) {
            console.warn('fixWebmDuration fallback to raw blob:', fixErr);
            finalBlob = rawBlob;
          }

          resolve({
            blob: finalBlob,
            url: URL.createObjectURL(finalBlob),
            name: `${title.replace(/\s+/g, '_')}.webm`,
            duration: durationSeconds,
          });
        } catch (err) {
          reject(err);
        }
      };

      recorder.start(40);

      // Fast frame rendering loop (~1.5s total to generate 60 frames)
      const totalFrames = 60;
      for (let frame = 0; frame <= totalFrames; frame++) {
        const progress = frame / totalFrames;
        const timeInSec = progress * durationSeconds;
        const currentSec = Math.floor(timeInSec);

        // Dark cinematic canvas background
        ctx.fillStyle = '#08060c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Film reel background grid pattern
        ctx.strokeStyle = 'rgba(255, 42, 109, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 80) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 80) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Center cinema radar circle
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = 180;

        // Outer glowing ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff2a6d';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ff2a6d';
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.65, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(5, 217, 232, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rotating radial cinema sweep
        const angle = progress * 4 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        ctx.strokeStyle = '#05d9e8';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#05d9e8';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Visual soundwave equalizer bars in center
        const bars = 16;
        const barWidth = 6;
        const spacing = 12;
        const startX = cx - (bars * spacing) / 2;
        for (let b = 0; b < bars; b++) {
          const h = 10 + Math.sin(frame * 0.3 + b * 0.5) * 28 + Math.cos(b * 0.8) * 15;
          ctx.fillStyle = b % 2 === 0 ? '#ff2a6d' : '#05d9e8';
          ctx.fillRect(startX + b * spacing, cy - h / 2, barWidth, h);
        }

        // Cinema Title
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 36px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, cx, cy - 90);

        // Large High-Precision Timecode Display
        const mins = Math.floor(timeInSec / 60).toString().padStart(2, '0');
        const secs = Math.floor(timeInSec % 60).toString().padStart(2, '0');
        const millis = Math.floor((timeInSec % 1) * 100).toString().padStart(2, '0');
        const timecodeStr = `${mins}:${secs}.${millis}`;

        ctx.fillStyle = '#05d9e8';
        ctx.font = 'bold 60px "JetBrains Mono", monospace';
        ctx.fillText(timecodeStr, cx, cy + 30);

        // Dynamic countdown banner
        const countdownVal = Math.max(1, durationSeconds - currentSec);
        ctx.fillStyle = '#ff2a6d';
        ctx.font = 'bold 24px "Outfit", sans-serif';
        ctx.fillText(`COUNTDOWN: ${countdownVal}s  •  SYNCHRONIZED TEST REEL`, cx, cy + 90);

        // Frame status
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillText(`FRAME: ${frame.toString().padStart(4, '0')}/${totalFrames}  |  30 FPS  |  DURATION: ${durationSeconds}s`, cx, cy + 125);

        // Film sprockets along top and bottom
        for (let sx = 20; sx < canvas.width; sx += 60) {
          ctx.fillStyle = 'rgba(255, 42, 109, 0.25)';
          ctx.fillRect(sx, 15, 30, 20);
          ctx.fillRect(sx, canvas.height - 35, 30, 20);
        }

        // Pace frames smoothly for MediaRecorder stream capture
        await new Promise((r) => setTimeout(r, 25));
      }

      // Stop recorder and finish
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    } catch (err) {
      reject(err);
    }
  });
}
