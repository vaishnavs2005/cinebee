/**
 * Matroska (MKV / WebM) In-Browser EBML Parser
 * Extracts all Video, Audio tracks (settings, codecs, channels, languages),
 * and Subtitle tracks from local MKV files directly in the browser without server upload.
 */

// Common ISO-639 language code mapping
const LANGUAGE_NAMES = {
  eng: 'English',
  en: 'English',
  spa: 'Spanish',
  es: 'Spanish',
  fra: 'French',
  fre: 'French',
  fr: 'French',
  deu: 'German',
  ger: 'German',
  de: 'German',
  ita: 'Italian',
  it: 'Italian',
  jpn: 'Japanese',
  ja: 'Japanese',
  kor: 'Korean',
  ko: 'Korean',
  zho: 'Chinese',
  chi: 'Chinese',
  zh: 'Chinese',
  hin: 'Hindi',
  hi: 'Hindi',
  rus: 'Russian',
  ru: 'Russian',
  por: 'Portuguese',
  pt: 'Portuguese',
  ara: 'Arabic',
  ar: 'Arabic',
  ben: 'Bengali',
  bn: 'Bengali',
  tam: 'Tamil',
  ta: 'Tamil',
  tel: 'Telugu',
  te: 'Telugu',
  und: 'Undetermined',
  zxx: 'No Subtitles',
};

export function formatLanguage(langCode) {
  if (!langCode) return 'Default';
  const clean = langCode.trim().toLowerCase();
  return LANGUAGE_NAMES[clean] || langCode.toUpperCase();
}

export function formatCodecName(codecId) {
  if (!codecId) return 'Unknown';
  const id = codecId.trim();

  // Video Codecs
  if (id.includes('MPEG4/ISO/AVC') || id.includes('AVC')) return 'H.264 (AVC)';
  if (id.includes('MPEGH/ISO/HEVC') || id.includes('HEVC')) return 'H.265 (HEVC)';
  if (id.includes('VP9')) return 'VP9';
  if (id.includes('VP8')) return 'VP8';
  if (id.includes('AV1')) return 'AV1';
  if (id.includes('MPEG2')) return 'MPEG-2';

  // Audio Codecs
  if (id.includes('AAC')) return 'AAC';
  if (id.includes('AC3') && !id.includes('EAC3')) return 'Dolby Digital (AC-3)';
  if (id.includes('EAC3')) return 'Dolby Digital Plus (E-AC-3)';
  if (id.includes('DTS')) return 'DTS Surround';
  if (id.includes('OPUS')) return 'Opus';
  if (id.includes('VORBIS')) return 'Vorbis';
  if (id.includes('TRUEHD')) return 'Dolby TrueHD';
  if (id.includes('FLAC')) return 'FLAC Lossless';
  if (id.includes('MPEG/L3')) return 'MP3';
  if (id.includes('PCM')) return 'PCM Audio';

  // Subtitle Codecs
  if (id.includes('TEXT/UTF8')) return 'SubRip (SRT)';
  if (id.includes('TEXT/ASS') || id.includes('TEXT/SSA')) return 'Advanced SubStation (ASS)';
  if (id.includes('VOBSUB')) return 'VobSub (DVD)';
  if (id.includes('HDMV/PGS')) return 'Blu-ray (PGS)';
  if (id.includes('TEXT/WEBVTT')) return 'WebVTT';

  return id.replace(/^[A-Z]_\w+\//, '');
}

export function formatChannels(channels) {
  if (!channels || channels <= 0) return 'Stereo';
  if (channels === 1) return 'Mono (1.0)';
  if (channels === 2) return 'Stereo (2.0)';
  if (channels === 6) return '5.1 Surround';
  if (channels === 8) return '7.1 Surround';
  return `${channels} Channels`;
}

// Read an EBML Element ID from DataView
function readElementId(dataView, offset, limit) {
  if (offset >= limit) return null;
  const byte = dataView.getUint8(offset);
  let len = 1;
  let mask = 0x80;
  while ((byte & mask) === 0 && len <= 4) {
    mask >>= 1;
    len++;
  }
  if (len > 4 || offset + len > limit) return null;

  let id = 0;
  for (let i = 0; i < len; i++) {
    id = (id * 256) + dataView.getUint8(offset + i);
  }
  return { id, length: len };
}

// Read an EBML Variable-Length Integer (VINT) for data size
function readVintSize(dataView, offset, limit) {
  if (offset >= limit) return null;
  const byte = dataView.getUint8(offset);
  let len = 1;
  let mask = 0x80;
  while ((byte & mask) === 0 && len <= 8) {
    mask >>= 1;
    len++;
  }
  if (len > 8 || offset + len > limit) return null;

  let val = byte & (mask - 1);
  for (let i = 1; i < len; i++) {
    val = (val * 256) + dataView.getUint8(offset + i);
  }
  return { value: val, length: len };
}

function safeReadUint(dataView, offset, length, limit = dataView.byteLength) {
  if (offset + length > limit || offset < 0) return 0;
  let val = 0;
  for (let i = 0; i < length; i++) {
    val = (val * 256) + dataView.getUint8(offset + i);
  }
  return val;
}

function safeReadUtf8(dataView, offset, length, limit = dataView.byteLength) {
  const actualLen = Math.min(length, Math.max(0, limit - offset));
  if (actualLen <= 0 || offset < 0) return '';
  const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset + offset, actualLen);
  let end = actualLen;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return new TextDecoder('utf-8').decode(bytes.subarray(0, end));
}

function readUtf8(dataView, offset, length) {
  return safeReadUtf8(dataView, offset, length, dataView.byteLength);
}

function readUint(dataView, offset, length) {
  return safeReadUint(dataView, offset, length, dataView.byteLength);
}

function readFloat(dataView, offset, length) {
  if (offset + length > dataView.byteLength || offset < 0) return 0;
  if (length === 4) return dataView.getFloat32(offset);
  if (length === 8) return dataView.getFloat64(offset);
  return 0;
}

// Main Matroska Header Parser
export async function parseMkvMetadata(file) {
  if (!file) return null;

  // Read the first 4 MB which typically contains Header, Info, and Tracks
  const readSize = Math.min(file.size, 4 * 1024 * 1024);
  const slice = file.slice(0, readSize);
  const arrayBuffer = await slice.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  const limit = arrayBuffer.byteLength;

  let offset = 0;

  // Verify EBML Header (0x1A45DFA3)
  const rootId = readElementId(dataView, offset, limit);
  if (!rootId || rootId.id !== 0x1a45dfa3) {
    return null; // Not a Matroska/EBML file
  }

  const result = {
    isMkv: true,
    fileName: file.name,
    fileSize: file.size,
    title: null,
    duration: 0,
    timecodeScale: 1000000, // default 1ms
    videoTrack: null,
    audioTracks: [],
    subtitleTracks: [],
  };

  try {
    // Skip EBML Header element to find Segment
    const ebmlSize = readVintSize(dataView, offset + rootId.length, limit);
    if (!ebmlSize) return result;
    offset += rootId.length + ebmlSize.length + ebmlSize.value;

    // Now look for Segment (0x18538067)
    while (offset < limit - 4) {
      const segId = readElementId(dataView, offset, limit);
      if (!segId) break;

      if (segId.id === 0x18538067) {
        // Found Segment
        offset += segId.length;
        const segSize = readVintSize(dataView, offset, limit);
        if (!segSize) break;
        offset += segSize.length;
        break;
      }
      offset++;
    }

    // Parse children of Segment (e.g. Info: 0x1549A966, Tracks: 0x1654AE6B)
    while (offset < limit - 8) {
      const elem = readElementId(dataView, offset, limit);
      if (!elem) break;

      const sizeElem = readVintSize(dataView, offset + elem.length, limit);
      if (!sizeElem) break;

      const elemDataStart = offset + elem.length + sizeElem.length;
      const elemDataEnd = Math.min(limit, elemDataStart + sizeElem.value);

      if (elem.id === 0x1549a966) {
        // Info Element
        parseInfoElement(dataView, elemDataStart, elemDataEnd, result);
      } else if (elem.id === 0x1654ae6b) {
        // Tracks Element!
        parseTracksElement(dataView, elemDataStart, elemDataEnd, result);
      } else if (elem.id === 0x1f43b675) {
        // Cluster element reached — tracks are usually before first cluster
        break;
      }

      offset = elemDataEnd;
    }
  } catch (err) {
    console.warn('MKV partial parsing warning:', err);
  }

  return result;
}

function parseInfoElement(dataView, start, end, result) {
  let off = start;
  while (off < end - 4) {
    const elem = readElementId(dataView, off, end);
    if (!elem) break;
    const sizeElem = readVintSize(dataView, off + elem.length, end);
    if (!sizeElem) break;

    const valStart = off + elem.length + sizeElem.length;
    const valEnd = Math.min(end, valStart + sizeElem.value);

    if (elem.id === 0x2ad7b1) {
      // TimecodeScale
      result.timecodeScale = readUint(dataView, valStart, sizeElem.value);
    } else if (elem.id === 0x4489) {
      // Duration (float, in timecode scale units)
      const rawDur = readFloat(dataView, valStart, sizeElem.value);
      result.duration = (rawDur * result.timecodeScale) / 1000000000;
    } else if (elem.id === 0x7ba9) {
      // Segment Title
      result.title = readUtf8(dataView, valStart, sizeElem.value);
    }

    off = valEnd;
  }
}

function parseTracksElement(dataView, start, end, result) {
  let off = start;
  while (off < end - 4) {
    const elem = readElementId(dataView, off, end);
    if (!elem) break;
    const sizeElem = readVintSize(dataView, off + elem.length, end);
    if (!sizeElem) break;

    const valStart = off + elem.length + sizeElem.length;
    const valEnd = Math.min(end, valStart + sizeElem.value);

    if (elem.id === 0xae) {
      // TrackEntry
      const track = parseTrackEntry(dataView, valStart, valEnd);
      if (track) {
        if (track.type === 'video' && !result.videoTrack) {
          result.videoTrack = track;
        } else if (track.type === 'audio') {
          result.audioTracks.push(track);
        } else if (track.type === 'subtitle') {
          result.subtitleTracks.push(track);
        }
      }
    }

    off = valEnd;
  }
}

function parseTrackEntry(dataView, start, end) {
  let off = start;
  const track = {
    number: 1,
    uid: 0,
    type: 'unknown',
    codecId: '',
    codecName: '',
    name: '',
    language: 'und',
    languageName: 'Default',
    isDefault: false,
    isForced: false,
    // Audio specific
    channels: 2,
    channelString: 'Stereo',
    samplingFrequency: 48000,
    bitDepth: 16,
    // Video specific
    width: 0,
    height: 0,
  };

  while (off < end - 2) {
    const elem = readElementId(dataView, off, end);
    if (!elem) break;
    const sizeElem = readVintSize(dataView, off + elem.length, end);
    if (!sizeElem) break;

    const valStart = off + elem.length + sizeElem.length;
    const valEnd = Math.min(end, valStart + sizeElem.value);
    const valLen = sizeElem.value;

    switch (elem.id) {
      case 0xd7: // TrackNumber
        track.number = readUint(dataView, valStart, valLen);
        break;
      case 0x73c5: // TrackUID
        track.uid = readUint(dataView, valStart, valLen);
        break;
      case 0x83: // TrackType (1=video, 2=audio, 33=subtitle)
        const tType = readUint(dataView, valStart, valLen);
        if (tType === 1) track.type = 'video';
        else if (tType === 2) track.type = 'audio';
        else if (tType === 33 || tType === 0x11) track.type = 'subtitle';
        break;
      case 0x86: // CodecID
        track.codecId = readUtf8(dataView, valStart, valLen);
        track.codecName = formatCodecName(track.codecId);
        break;
      case 0x536e: // Name
        track.name = readUtf8(dataView, valStart, valLen);
        break;
      case 0x22b59c: // Language
        track.language = readUtf8(dataView, valStart, valLen);
        track.languageName = formatLanguage(track.language);
        break;
      case 0x88: // FlagDefault
        track.isDefault = readUint(dataView, valStart, valLen) === 1;
        break;
      case 0x55aa: // FlagForced
        track.isForced = readUint(dataView, valStart, valLen) === 1;
        break;
      case 0xe0: // VideoSettings
        parseVideoSettings(dataView, valStart, valEnd, track);
        break;
      case 0xe1: // AudioSettings
        parseAudioSettings(dataView, valStart, valEnd, track);
        break;
      default:
        break;
    }

    off = valEnd;
  }

  // Generate fallback name if none given in file
  if (!track.name) {
    if (track.type === 'audio') {
      track.name = `${track.languageName} (${track.channelString || 'Stereo'})`;
    } else if (track.type === 'subtitle') {
      track.name = `${track.languageName} [${track.codecName || 'Subtitles'}]`;
    } else {
      track.name = `${track.width}x${track.height} (${track.codecName})`;
    }
  }

  return track;
}

function parseVideoSettings(dataView, start, end, track) {
  let off = start;
  while (off < end - 2) {
    const elem = readElementId(dataView, off, end);
    if (!elem) break;
    const sizeElem = readVintSize(dataView, off + elem.length, end);
    if (!sizeElem) break;

    const valStart = off + elem.length + sizeElem.length;
    const valEnd = Math.min(end, valStart + sizeElem.value);
    const valLen = sizeElem.value;

    if (elem.id === 0xb0) {
      track.width = readUint(dataView, valStart, valLen);
    } else if (elem.id === 0xba) {
      track.height = readUint(dataView, valStart, valLen);
    }

    off = valEnd;
  }
}

function parseAudioSettings(dataView, start, end, track) {
  let off = start;
  while (off < end - 2) {
    const elem = readElementId(dataView, off, end);
    if (!elem) break;
    const sizeElem = readVintSize(dataView, off + elem.length, end);
    if (!sizeElem) break;

    const valStart = off + elem.length + sizeElem.length;
    const valEnd = Math.min(end, valStart + sizeElem.value);
    const valLen = sizeElem.value;

    if (elem.id === 0xb5) {
      track.samplingFrequency = readFloat(dataView, valStart, valLen);
    } else if (elem.id === 0x9f) {
      track.channels = readUint(dataView, valStart, valLen);
      track.channelString = formatChannels(track.channels);
    } else if (elem.id === 0x6264) {
      track.bitDepth = readUint(dataView, valStart, valLen);
    }

    off = valEnd;
  }
}

/**
 * Extracts embedded text subtitles (SRT / UTF-8 / WebVTT / ASS) from an MKV file
 * and returns a WebVTT Object URL and cue array to attach directly to HTML5 <video><track>
 */
export async function extractEmbeddedSubtitles(file, targetTrackNumber) {
  if (!file) return null;

  try {
    const cues = [];
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB scan buffer
    let fileOffset = 0;
    let currentClusterTimecode = 0;

    // Locate Segment element in header
    const headerSlice = await file.slice(0, Math.min(128 * 1024, file.size)).arrayBuffer();
    const headerView = new DataView(headerSlice);
    const headerLimit = headerSlice.byteLength;

    let segStart = 0;
    for (let i = 0; i < headerLimit - 4; i++) {
      const elem = readElementId(headerView, i, headerLimit);
      if (elem && elem.id === 0x18538067) {
        const segSize = readVintSize(headerView, i + elem.length, headerLimit);
        if (segSize) {
          segStart = i + elem.length + segSize.length;
          break;
        }
      }
    }

    fileOffset = segStart;

    while (fileOffset < file.size) {
      const readLen = Math.min(CHUNK_SIZE, file.size - fileOffset);
      const sliceBuffer = await file.slice(fileOffset, fileOffset + readLen).arrayBuffer();
      const view = new DataView(sliceBuffer);
      const len = sliceBuffer.byteLength;

      let pos = 0;
      let advancedInFile = false;

      while (pos < len - 4) {
        const elem = readElementId(view, pos, len);
        if (!elem) {
          pos++;
          continue;
        }

        const sizeElem = readVintSize(view, pos + elem.length, len);
        if (!sizeElem) {
          break;
        }

        const dataStart = pos + elem.length + sizeElem.length;
        const elemSize = sizeElem.value;
        const dataEnd = dataStart + elemSize;

        // Container elements: step directly into their contents
        if (elem.id === 0x1f43b675 || elem.id === 0xa0 || elem.id === 0x18538067) {
          pos = dataStart;
          continue;
        }

        // If a leaf element extends past our current buffer
        if (dataEnd > len) {
          // If it's a video/audio block or other non-subtitle leaf, jump directly in file space!
          if (elem.id !== 0xe7 && elem.id !== 0x9b) {
            const tVint = (elem.id === 0xa3 || elem.id === 0xa1) ? readVintSize(view, dataStart, len) : null;
            if (!tVint || tVint.value !== targetTrackNumber) {
              fileOffset += dataEnd;
              advancedInFile = true;
              break;
            }
          }
          // If it is our subtitle block, slide buffer so it fits completely
          break;
        }

        // Cluster Timecode (0xE7)
        if (elem.id === 0xe7) {
          currentClusterTimecode = safeReadUint(view, dataStart, elemSize, len);
          pos = dataEnd;
          continue;
        }

        // SimpleBlock (0xA3) or Block (0xA1)
        if (elem.id === 0xa3 || elem.id === 0xa1) {
          const trackVint = readVintSize(view, dataStart, len);
          if (trackVint && trackVint.value === targetTrackNumber) {
            const headerOffset = dataStart + trackVint.length;
            if (headerOffset + 3 <= dataEnd) {
              const relTimecode = view.getInt16(headerOffset); // Signed 16-bit relative timecode
              const blockTimeMs = currentClusterTimecode + relTimecode;
              const textStart = headerOffset + 3; // Skip 2 bytes timecode + 1 byte flags
              if (textStart < dataEnd) {
                const subText = safeReadUtf8(view, textStart, dataEnd - textStart, len);
                const cleaned = cleanSubtitleText(subText);
                if (cleaned) {
                  cues.push({
                    startMs: Math.max(0, blockTimeMs),
                    durationMs: 3500, // default duration if BlockDuration not specified
                    text: cleaned,
                  });
                }
              }
            }
          }
          pos = dataEnd;
          continue;
        }

        // BlockDuration (0x9B) inside BlockGroup
        if (elem.id === 0x9b) {
          const duration = safeReadUint(view, dataStart, elemSize, len);
          if (cues.length > 0 && duration > 0) {
            cues[cues.length - 1].durationMs = duration;
          }
          pos = dataEnd;
          continue;
        }

        // All other leaf elements (SeekHead, Info, Tracks, Cues, video blocks)
        pos = dataEnd;
      }

      if (!advancedInFile) {
        if (pos === 0) {
          fileOffset += Math.min(1024, len);
        } else {
          fileOffset += pos;
        }
      }
    }

    if (cues.length === 0) return null;

    // Sort cues chronologically
    cues.sort((a, b) => a.startMs - b.startMs);

    // Build WebVTT string
    let vtt = 'WEBVTT\n\n';
    cues.forEach((cue, idx) => {
      const start = formatVttTime(cue.startMs);
      const end = formatVttTime(cue.startMs + cue.durationMs);
      vtt += `${idx + 1}\n${start} --> ${end}\n${cue.text}\n\n`;
    });

    const blob = new Blob([vtt], { type: 'text/vtt' });
    return {
      url: URL.createObjectURL(blob),
      count: cues.length,
      cues: cues,
    };
  } catch (err) {
    console.warn('Failed to extract embedded subtitles:', err);
    return null;
  }
}

function formatVttTime(millis) {
  const ms = Math.floor(millis % 1000).toString().padStart(3, '0');
  const totalSec = Math.floor(millis / 1000);
  const s = (totalSec % 60).toString().padStart(2, '0');
  const m = (Math.floor(totalSec / 60) % 60).toString().padStart(2, '0');
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function cleanSubtitleText(raw) {
  if (!raw) return '';
  // If ASS/SSA format (format has commas: ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text)
  const assMatch = raw.match(/^\d+,\d+,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,([\s\S]*)$/);
  let text = assMatch ? assMatch[1] : raw;
  // Replace ASS newline markers \N or \n
  text = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n');
  // Strip formatting tags like {\an8}, {\b1}, etc.
  text = text.replace(/\{[^}]+\}/g, '').trim();
  return text;
}

