// Copies the OCR engine into public/ocr so the app serves it itself.
//
// tesseract.js fetches its worker, its WebAssembly core and the English
// language data from a CDN unless told otherwise. Served from here instead,
// reading a screenshot makes no request to anyone else — the picture and the
// text in it never leave the phone. Run before dev and build; the copies are
// not committed.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'ocr')
mkdirSync(out, { recursive: true })

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // LSTM-only builds, the three the worker picks between by what the device
  // supports. Only the one it picks is downloaded.
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  // The integer "best" model: the accuracy of the full one at a quarter the size.
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]

for (const [from, to] of files) {
  const src = join(root, from)
  if (!existsSync(src)) {
    console.error(`copy-ocr: missing ${from} — run npm install`)
    process.exit(1)
  }
  copyFileSync(src, join(out, to))
}
console.log(`copy-ocr: ${files.length} files → public/ocr`)
