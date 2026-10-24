"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Overlay, Spinner } from "@/components/ui";

/* ------------------------------------------------------------------ *
 * Media editor: crop / rotate photos and trim videos before sending.
 * Everything happens on the device. Nothing is uploaded until "Use".
 * ------------------------------------------------------------------ */

/** Photos we can safely re-draw on a canvas (GIFs would lose their animation). */
export function canEditFile(file: File) {
  if (file.type.startsWith("video/")) return true;
  return file.type.startsWith("image/") && file.type !== "image/gif" && file.type !== "image/svg+xml";
}

export function MediaEditor({
  file,
  onCancel,
  onDone,
}: {
  file: File | null;
  onCancel: () => void;
  onDone: (file: File) => void;
}) {
  const isVideo = Boolean(file?.type.startsWith("video/"));
  return (
    <Overlay open={Boolean(file)} onClose={onCancel} title={isVideo ? "Trim video" : "Edit photo"}>
      {file ? (
        isVideo ? (
          <VideoEditor key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onCancel={onCancel} onDone={onDone} />
        ) : (
          <ImageEditor key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onCancel={onCancel} onDone={onDone} />
        )
      ) : null}
    </Overlay>
  );
}

/* ----------------------------- Photos ------------------------------ */

type Crop = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";
type Aspect = "free" | "1:1" | "4:3" | "16:9";

const ASPECTS: { value: Aspect; label: string; ratio: number | null }[] = [
  { value: "free", label: "Free", ratio: null },
  { value: "1:1", label: "Square", ratio: 1 },
  { value: "4:3", label: "4:3", ratio: 4 / 3 },
  { value: "16:9", label: "16:9", ratio: 16 / 9 },
];

const MIN_SIZE = 0.08;
const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function ImageEditor({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (file: File) => void }) {
  const [base, setBase] = useState<Blob>(file);
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Crop>(FULL);
  const [aspect, setAspect] = useState<Aspect>("free");
  const [rotated, setRotated] = useState(false);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ mode: "move" | Corner; startX: number; startY: number; start: Crop } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(base);
    setSrc(url);
    setNatural(null);
    return () => URL.revokeObjectURL(url);
  }, [base]);

  const ratioOf = (value: Aspect) => ASPECTS.find((item) => item.value === value)?.ratio ?? null;

  function fitAspect(value: Aspect, size: { w: number; h: number }): Crop {
    const ratio = ratioOf(value);
    if (!ratio) return crop;
    const widthPx = Math.min(size.w, size.h * ratio);
    const heightPx = widthPx / ratio;
    const w = widthPx / size.w;
    const h = heightPx / size.h;
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  }

  function chooseAspect(value: Aspect) {
    setAspect(value);
    if (natural) setCrop(value === "free" ? crop : fitAspect(value, natural));
  }

  function begin(event: React.PointerEvent<HTMLElement>, mode: "move" | Corner) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, start: crop };
  }

  function drag(event: React.PointerEvent<HTMLElement>) {
    const state = dragRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!state || !box || !natural) return;
    const dx = (event.clientX - state.startX) / box.width;
    const dy = (event.clientY - state.startY) / box.height;
    const s = state.start;

    if (state.mode === "move") {
      setCrop({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
      return;
    }

    // Resize: the opposite corner stays where it is.
    const left = state.mode === "nw" || state.mode === "sw";
    const top = state.mode === "nw" || state.mode === "ne";
    const fx = left ? s.x + s.w : s.x;
    const fy = top ? s.y + s.h : s.y;
    const movingX = (left ? s.x : s.x + s.w) + dx;
    const movingY = (top ? s.y : s.y + s.h) + dy;
    const availW = left ? fx : 1 - fx;
    const availH = top ? fy : 1 - fy;
    let w = clamp(Math.abs(movingX - fx), MIN_SIZE, Math.max(availW, MIN_SIZE));
    let h = clamp(Math.abs(movingY - fy), MIN_SIZE, Math.max(availH, MIN_SIZE));

    const ratio = ratioOf(aspect);
    if (ratio) {
      // Keep the chosen shape: width drives, height follows (in real pixels).
      const hFromW = (width: number) => (width * natural.w) / (ratio * natural.h);
      w = Math.min(w, availW, availH * ((ratio * natural.h) / natural.w));
      w = Math.max(w, MIN_SIZE);
      h = hFromW(w);
    }
    setCrop({ x: left ? fx - w : fx, y: top ? fy - h : fy, w, h });
  }

  function end() {
    dragRef.current = null;
  }

  async function rotate() {
    const img = imgRef.current;
    if (!img || !natural) return;
    const canvas = document.createElement("canvas");
    canvas.width = natural.h;
    canvas.height = natural.w;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    setRotated(true);
    setCrop(FULL);
    setAspect("free");
    setBase(blob);
  }

  async function finish() {
    const img = imgRef.current;
    if (!img || !natural) return;
    const untouched = !rotated && crop.x < 0.005 && crop.y < 0.005 && crop.w > 0.99 && crop.h > 0.99;
    if (untouched) {
      onDone(file);
      return;
    }
    setBusy(true);
    try {
      const sx = Math.round(crop.x * natural.w);
      const sy = Math.round(crop.y * natural.h);
      const sw = Math.max(1, Math.round(crop.w * natural.w));
      const sh = Math.max(1, Math.round(crop.h * natural.h));
      const scale = Math.min(1, 2560 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("export failed");
      const name = file.name.replace(/\.[^.]+$/, "") || "photo";
      onDone(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    } catch {
      // Fall back to the original rather than losing the photo.
      onDone(file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center rounded-md bg-black/80 p-2">
        <div ref={boxRef} className="relative inline-block max-w-full touch-none select-none overflow-hidden">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt="Photo to edit"
              draggable={false}
              className="block max-h-[52vh] max-w-full"
              onLoad={(event) => {
                const target = event.currentTarget;
                const size = { w: target.naturalWidth, h: target.naturalHeight };
                setNatural(size);
                setCrop(aspect === "free" ? FULL : fitAspect(aspect, size));
              }}
            />
          ) : null}
          {natural ? (
            <div
              className="absolute cursor-move border-2 border-white"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
              onPointerDown={(event) => begin(event, "move")}
              onPointerMove={drag}
              onPointerUp={end}
              onPointerCancel={end}
            >
              {(["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
                <span
                  key={corner}
                  role="presentation"
                  className="absolute h-7 w-7 touch-none rounded-full border-2 border-white bg-brand"
                  style={{
                    left: corner.endsWith("w") ? 0 : "100%",
                    top: corner.startsWith("n") ? 0 : "100%",
                    transform: "translate(-50%, -50%)",
                  }}
                  onPointerDown={(event) => begin(event, corner)}
                  onPointerMove={drag}
                  onPointerUp={end}
                  onPointerCancel={end}
                />
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <Spinner />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Crop shape">
        {ASPECTS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={aspect === item.value}
            className="chip"
            data-active={aspect === item.value}
            onClick={() => chooseAspect(item.value)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" className="chip ml-auto" onClick={() => void rotate()} disabled={!natural}>
          <Icon name="refresh" size={14} /> Rotate
        </button>
      </div>
      <p className="caption">Drag the box to move it and the corners to resize.</p>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void finish()} disabled={!natural || busy}>
          {busy ? <Spinner /> : <Icon name="check" size={16} />} Use photo
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Videos ------------------------------ */

type CaptureVideo = HTMLVideoElement & { captureStream?: () => MediaStream };

function canTrimVideo() {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") return false;
  return typeof (document.createElement("video") as CaptureVideo).captureStream === "function";
}

function pickVideoMime() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function clock(seconds: number) {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/** Re-records the chosen part of the video in real time, entirely on this device. */
async function trimVideo(file: File, start: number, end: number, onProgress: (fraction: number) => void): Promise<File> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video") as CaptureVideo;
  video.src = url;
  video.playsInline = true;
  video.preload = "auto";
  let audioContext: AudioContext | null = null;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video."));
    });
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = start;
    });

    const stream = video.captureStream?.();
    if (!stream) throw new Error("Trimming is not supported in this browser.");

    // Route the sound through Web Audio so it is recorded but not played aloud.
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new Ctx();
    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    const output = new MediaStream([...stream.getVideoTracks(), ...destination.stream.getAudioTracks()]);

    const mimeType = pickVideoMime();
    const recorder = new MediaRecorder(output, mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : { videoBitsPerSecond: 2_500_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(500);
    await video.play();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const done = video.currentTime >= end - 0.05 || video.ended;
        onProgress(clamp((video.currentTime - start) / Math.max(end - start, 0.1), 0, 1));
        if (done) {
          video.pause();
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
    recorder.stop();
    await finished;

    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    if (blob.size < 1000) throw new Error("The trimmed video came out empty.");
    const name = file.name.replace(/\.[^.]+$/, "") || "video";
    return new File([blob], `${name}-trimmed.webm`, { type: "video/webm" });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    void audioContext?.close().catch(() => undefined);
  }
}

function VideoEditor({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (file: File) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const supported = canTrimVideo();

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onMeta = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const value = event.currentTarget.duration;
    if (Number.isFinite(value) && value > 0) {
      setDuration(value);
      setRange([0, value]);
    }
  }, []);

  const [start, end] = range;
  const trimmed = duration !== null && (start > 0.05 || end < duration - 0.05);
  const busy = progress !== null;

  function changeStart(value: number) {
    if (duration === null) return;
    const next = clamp(value, 0, Math.max(end - 0.5, 0));
    setRange([next, end]);
    if (videoRef.current) videoRef.current.currentTime = next;
  }

  function changeEnd(value: number) {
    if (duration === null) return;
    const next = clamp(value, Math.min(start + 0.5, duration), duration);
    setRange([start, next]);
    if (videoRef.current) videoRef.current.currentTime = Math.max(next - 0.1, start);
  }

  async function previewRange() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = start;
    try {
      await video.play();
    } catch {
      return;
    }
    const stop = () => {
      if (video.currentTime >= end) {
        video.pause();
        video.removeEventListener("timeupdate", stop);
      }
    };
    video.addEventListener("timeupdate", stop);
  }

  async function finish() {
    if (!trimmed || duration === null) {
      onDone(file);
      return;
    }
    setError(null);
    setProgress(0);
    videoRef.current?.pause();
    try {
      const result = await trimVideo(file, start, end, setProgress);
      onDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trim this video.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={videoRef}
        src={src ?? undefined}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={onMeta}
        className="max-h-[48vh] w-full rounded-md bg-black"
      />

      {duration !== null && supported ? (
        <div className="flex flex-col gap-2">
          <label className="caption flex items-center gap-2">
            <span className="w-12 shrink-0">Start</span>
            <input
              type="range"
              className="flex-1"
              min={0}
              max={duration}
              step={0.1}
              value={start}
              disabled={busy}
              onChange={(event) => changeStart(Number(event.target.value))}
            />
            <span className="w-12 shrink-0 text-right numeric">{clock(start)}</span>
          </label>
          <label className="caption flex items-center gap-2">
            <span className="w-12 shrink-0">End</span>
            <input
              type="range"
              className="flex-1"
              min={0}
              max={duration}
              step={0.1}
              value={end}
              disabled={busy}
              onChange={(event) => changeEnd(Number(event.target.value))}
            />
            <span className="w-12 shrink-0 text-right numeric">{clock(end)}</span>
          </label>
          <div className="flex items-center justify-between gap-2">
            <p className="caption">
              Length {clock(end - start)}
              {trimmed ? " · trimming takes about as long as the clip" : ""}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void previewRange()} disabled={busy}>
              <Icon name="video" size={14} /> Preview
            </button>
          </div>
        </div>
      ) : duration !== null ? (
        <p className="caption">This browser cannot trim videos. You can still send the full video.</p>
      ) : null}

      {busy ? (
        <div role="status" className="flex flex-col gap-1">
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--line)]">
            <div className="h-full bg-brand" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
          <p className="caption">Trimming… keep this screen open.</p>
        </div>
      ) : null}
      {error ? <p className="body-sm text-coral">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void finish()} disabled={busy}>
          {busy ? <Spinner /> : <Icon name="check" size={16} />} {trimmed ? "Trim and use" : "Use video"}
        </button>
      </div>
    </div>
  );
}
