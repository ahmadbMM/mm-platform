// Reading a ticket's QR code with the phone's camera. The browser's own reader where it has one
// (BarcodeDetector), else jsQR, fetched the first time and only then (iPhones). The booking app's
// ticket reads MMC-<number>-<ref>, or MMC-<ref> without a number.

type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
type JsQr = (d: Uint8ClampedArray, w: number, h: number, o?: { inversionAttempts?: string }) => { data: string } | null;
declare global {
  interface Window { jsQR?: JsQr; BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }
}

/** A ticket's reference and number, or null for anything else. */
export function parseTicket(txt: string): { ref: string; num: number | null } | null {
  const m = /^MMC-(?:(\d+)-)?([0-9a-zA-Z][0-9a-zA-Z-]{3,7})$/i.exec(txt.trim());
  return m ? { ref: m[2].toLowerCase(), num: m[1] == null ? null : Number(m[1]) } : null;
}

function loadJsQr(): Promise<JsQr> {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "/vendor/jsqr-1.4.0.min.js";
    s.onload = () => (window.jsQR ? res(window.jsQR) : rej(new Error("jsQR")));
    s.onerror = () => rej(new Error("jsQR"));
    document.head.appendChild(s);
  });
}

/** torch: present only where the camera says it has a light (a phone's back camera on Android, mostly); it answers
 *  whether the light did what was asked. */
export type Scanner = { stop(): void; torch?: (on: boolean) => Promise<boolean> };

/** Starts the camera in this video element. Calls onText for every code it reads, and onFail when it cannot start. */
export async function startScanner(video: HTMLVideoElement, onText: (txt: string) => void, onFail: () => void): Promise<Scanner> {
  let stopped = false;
  let stream: MediaStream | null = null;
  const stop = () => {
    stopped = true;
    stream?.getTracks().forEach((tr) => tr.stop());
    video.srcObject = null;
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    if (stopped) { stop(); return { stop }; }
    video.srcObject = stream;
    await video.play();
  } catch {
    stop();
    onFail();
    return { stop };
  }
  let detector: Detector | null = null;
  let jsqr: JsQr | null = null;
  // The browser's reader only where it says it reads QR codes: an Android phone without Google's services has the
  // reader but nothing behind it, and read nothing at all without a word.
  try {
    const BD = window.BarcodeDetector;
    const formats = BD && typeof BD.getSupportedFormats === "function" ? await BD.getSupportedFormats().catch(() => [] as string[]) : null;
    if (BD && (!formats || formats.includes("qr_code"))) detector = new BD({ formats: ["qr_code"] });
  } catch { detector = null; }
  if (!detector) {
    try { jsqr = await loadJsQr(); } catch { stop(); onFail(); return { stop }; }
  }
  // A reader that fails frame after frame gives way to jsQR.
  let misses = 0;
  const toJsQr = async () => {
    detector = null;
    try { jsqr = await loadJsQr(); } catch { if (!stopped) { stop(); onFail(); } }
  };
  // the camera's light, if the track says it has one (MediaTrackCapabilities.torch)
  const track: MediaStreamTrack | undefined = stream.getVideoTracks()[0];
  let torch: Scanner["torch"];
  try {
    const caps = (typeof track?.getCapabilities === "function" ? track.getCapabilities() : {}) as Record<string, unknown>;
    if (track && caps.torch === true) {
      torch = async (on: boolean) => {
        try { await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }); return true; } catch { return false; }
      };
    }
  } catch { torch = undefined; }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        if (detector) {
          let hits: { rawValue: string }[] = [];
          try { hits = await detector.detect(video); misses = 0; } catch { if (++misses >= 5) await toJsQr(); }
          if (hits[0]?.rawValue) onText(hits[0].rawValue);
        } else if (jsqr && ctx) {
          const scale = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hit = jsqr(px.data, px.width, px.height, { inversionAttempts: "attemptBoth" });
          if (hit?.data) onText(hit.data);
        }
      }
    } catch { /* a frame that could not be read: the next one */ }
    if (!stopped) window.setTimeout(() => void tick(), 180);
  };
  void tick();
  return { stop, torch };
}
