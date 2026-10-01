/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Build time and commit, injected by vite.config.ts. */
declare const __BUILD_STAMP__: string

// The self-contained ESM build of tesseract.js. Typed where it is used
// (src/lib/ocr.ts), to the few calls the app makes.
declare module 'tesseract.js/dist/tesseract.esm.min.js' {
  const tesseract: unknown
  export default tesseract
}
