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

export async function processSubtitleFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  const text = await file.text();

  if (extension === 'vtt') {
    const blob = new Blob([text], { type: 'text/vtt' });
    return { url: URL.createObjectURL(blob), name: file.name };
  }

  // Convert SRT
  return {
    url: convertSrtToVtt(text),
    name: file.name,
  };
}
