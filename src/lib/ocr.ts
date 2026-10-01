import type { OcrPage, OcrWord } from './screenshot'

/**
 * Reads the text off an image, on this device.
 *
 * The engine (tesseract.js) runs in a web worker, and every file it needs is
 * served by the app itself from /ocr — see scripts/copy-ocr.mjs. Left to its
 * defaults it would fetch them from a CDN. The image is never sent anywhere
 * and is not kept: it is drawn to a canvas, read, and dropped.
 */

interface TesseractWorker {
  setParameters(params: Record<string, string>): Promise<unknown>
  recognize(
    image: HTMLCanvasElement,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ): Promise<{
    data: {
      blocks: { paragraphs: { lines: { words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[] | null
    }
  }>
  terminate(): Promise<unknown>
}

interface TesseractModule {
  createWorker(
    langs: string,
    oem: number,
    options: Record<string, unknown>,
  ): Promise<TesseractWorker>
}

export type OcrProgress = { stage: 'loading' | 'reading'; progress: number }

let worker: Promise<TesseractWorker> | null = null
let report: ((p: OcrProgress) => void) | null = null

function getWorker(): Promise<TesseractWorker> {
  if (worker) return worker
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href
  worker = (async () => {
    // Loaded only when a screenshot is read, so the app itself stays small.
    const mod = (await import('tesseract.js/dist/tesseract.esm.min.js')).default as unknown as TesseractModule
    const w = await mod.createWorker('eng', 1 /* LSTM only */, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base,
      workerBlobURL: false,
      gzip: true,
      logger: (m: { status: string; progress: number }) =>
        report?.({ stage: m.status === 'recognizing text' ? 'reading' : 'loading', progress: m.progress }),
    })
    // Fully automatic page layout. The default — one uniform block — drops a
    // large headline figure, and on a bank screen that is the balance.
    await w.setParameters({ tessedit_pageseg_mode: '3' })
    return w
  })()
  // A failed load is not cached, so the next try starts over.
  worker.catch(() => {
    worker = null
  })
  return worker
}

/**
 * Grey, and dark text on light. The engine is trained on print; app screens
 * in dark mode are the reverse, and coloured figures (a red overdraft, a green
 * "Paid") read best once the colour is gone.
 */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser cannot draw the image to read it.')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  let sum = 0
  for (let i = 0; i < px.length; i += 4) {
    const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    px[i] = px[i + 1] = px[i + 2] = y
    sum += y
  }
  if (sum / (px.length / 4) < 128) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i]
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export async function readImage(file: Blob, onProgress?: (p: OcrProgress) => void): Promise<OcrPage> {
  report = onProgress ?? null
  try {
    const w = await getWorker()
    const canvas = await prepare(file)
    const { data } = await w.recognize(canvas, {}, { blocks: true, text: false })
    const words: OcrWord[] = []
    for (const b of data.blocks ?? [])
      for (const p of b.paragraphs)
        for (const l of p.lines)
          for (const x of l.words) words.push({ text: x.text, ...x.bbox })
    const page = { width: canvas.width, height: canvas.height, words }
    // Release the pixels now rather than whenever the collector gets to them;
    // a phone screenshot is ~12 MB decoded.
    canvas.width = canvas.height = 0
    return page
  } finally {
    report = null
  }
}

/** Frees the engine's memory once the screenshots are read. */
export async function closeReader(): Promise<void> {
  const w = worker
  worker = null
  if (w) await (await w).terminate()
}
