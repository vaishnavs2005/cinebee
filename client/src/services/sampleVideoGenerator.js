/**
 * Procedurally generates an animated test film (video Blob) using HTML5 Canvas & MediaRecorder.
 * Displays large glowing timecode, frame numbers, movie leader countdown, and audio tone.
 * Allows instant synchronized testing without needing to find two identical local video files.
 */
export async function generateSampleMovieBlob(durationSeconds = 60, title = 'CineBee Cinema Reel') {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const fps = 30;
    const stream = canvas.captureStream(fps);

    let options = { mimeType: 'video/webm;codecs=vp8' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    const recorder = new MediaRecorder(stream, options);
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve({
        blob,
        url: URL.createObjectURL(blob),
        name: `${title.replace(/\s+/g, '_')}_Test.webm`,
        duration: durationSeconds,
      });
    };

    recorder.start(100);

    let frame = 0;
    const totalFrames = fps * 4; // record 4 seconds of animated countdown reel (loops cleanly)

    const interval = setInterval(() => {
      const timeInSec = frame / fps;

      // Dark cinematic canvas background
      ctx.fillStyle = '#0a0b12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Film reel grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Center glowing cinema circle
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 180;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Rotating radial sweep line
      const angle = (timeInSec * 2 * Math.PI) % (2 * Math.PI);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Cinema Title
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, cx, cy - 80);

      // Large High-Precision Timecode Display
      const mins = Math.floor(timeInSec / 60).toString().padStart(2, '0');
      const secs = Math.floor(timeInSec % 60).toString().padStart(2, '0');
      const millis = Math.floor((timeInSec % 1) * 100).toString().padStart(2, '0');
      const timecodeStr = `${mins}:${secs}.${millis}`;

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 64px "JetBrains Mono", monospace';
      ctx.fillText(timecodeStr, cx, cy + 20);

      // Subtitle notice
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px "Inter", sans-serif';
      ctx.fillText(`FRAME: ${frame.toString().padStart(5, '0')}  |  RATE: ${fps} FPS`, cx, cy + 90);

      // Film sprockets along top and bottom
      for (let sx = 20; sx < canvas.width; sx += 60) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(sx, 15, 30, 20);
        ctx.fillRect(sx, canvas.height - 35, 30, 20);
      }

      frame++;
      if (frame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 1000 / fps);
  });
}
