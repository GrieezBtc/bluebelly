/** Pick a voice-note format every phone can play back: MP4/AAC where the browser can record it. */
export function pickVoiceMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function isUniversalAudio(type: string) {
  return /^audio\/(mp4|aac|mpeg|wav|x-wav|x-m4a)/.test(type);
}

/**
 * Chrome on older Android can only record WebM/Opus, which iPhones cannot play. In that case the
 * recording is converted on the device to a small 16 kHz mono WAV file that plays everywhere.
 */
export async function toUniversalAudio(blob: Blob): Promise<{ blob: Blob; durationSec: number | null }> {
  const type = blob.type.split(";")[0];
  if (isUniversalAudio(type)) return { blob: new Blob([blob], { type }), durationSec: null };
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new Ctx();
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    void context.close().catch(() => undefined);

    const rate = 16000;
    const frames = Math.max(1, Math.ceil(decoded.duration * rate));
    const offline = new OfflineAudioContext(1, frames, rate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return { blob: encodeWav(rendered.getChannelData(0), rate), durationSec: decoded.duration };
  } catch {
    // Could not convert: send the original rather than losing the recording.
    return { blob: new Blob([blob], { type: type || "audio/webm" }), durationSec: null };
  }
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
