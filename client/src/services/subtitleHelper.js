/**
 * Converts standard SRT subtitle text into WebVTT format and generates an Object URL.
 */
export function convertSrtToVtt(srtContent) {
  // Normalize line endings
  let vtt = srtContent.replace(/\r\n|\r/g, '\n');

  // Replace comma decimal separators in timestamps with dots (00:01:20,000 -> 00:01:20.000)
  vtt = vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  // Prefix with WEBVTT header
  vtt = 'WEBVTT\n\n' + vtt;

  const blob = new Blob([vtt], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}

/**
 * Parses raw SRT or WebVTT text into an array of cues with startMs, durationMs, and text
 */
export function parseSrtOrVttCues(rawText) {
  if (!rawText) return [];
  const cues = [];
  const normalized = rawText.replace(/\r\n|\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(/(\d{1,2}:)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) continue;

    const startH = parseInt(match[1] ? match[1].replace(':', '') : '0', 10);
    const startM = parseInt(match[2], 10);
    const startS = parseInt(match[3], 10);
    const startMs = parseInt(match[4], 10);
    const totalStartMs = (startH * 3600 + startM * 60 + startS) * 1000 + startMs;

    const endH = parseInt(match[5] ? match[5].replace(':', '') : '0', 10);
    const endM = parseInt(match[6], 10);
    const endS = parseInt(match[7], 10);
    const endMs = parseInt(match[8], 10);
    const totalEndMs = (endH * 3600 + endM * 60 + endS) * 1000 + endMs;

    const textLines = lines.slice(timeLineIdx + 1).join('\n').trim();
    if (textLines) {
      cues.push({
        startMs: totalStartMs,
        durationMs: Math.max(500, totalEndMs - totalStartMs),
        text: textLines.replace(/<[^>]+>/g, ''), // strip HTML tags
      });
    }
  }

  return cues;
}

export async function processSubtitleFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const text = await file.text();
  const cues = parseSrtOrVttCues(text);

  if (extension === 'vtt') {
    const blob = new Blob([text], { type: 'text/vtt' });
    return { url: URL.createObjectURL(blob), name: file.name, cues };
  }

  // Convert SRT
  return {
    url: convertSrtToVtt(text),
    name: file.name,
    cues,
  };
}
