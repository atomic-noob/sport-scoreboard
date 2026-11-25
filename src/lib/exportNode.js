import { toPng } from 'html-to-image'

/** Anything inside the exported area marked data-no-capture="true" (buttons and so on) is left out. */
const keep = (node) => !(node.dataset && node.dataset.noCapture)

export function fileSlug(text, fallback = 'sylve') {
  const s = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return s || fallback
}

/** Turns an element into a PNG and downloads it. */
export async function saveNodeAsImage(node, filename, background = '#050a05') {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: background, filter: keep })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Opens a clean window with a black-on-white copy of the element and the print dialog
 * ("Save as PDF" is one of its choices). Returns false if the browser blocked the window.
 */
export function printNode(node, title) {
  const w = window.open('', '_blank')
  if (!w) return false
  const clone = node.cloneNode(true)
  clone.querySelectorAll('[data-no-capture]').forEach((el) => el.remove())
  w.document.open()
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${String(title).replace(/</g, '&lt;')}</title>${document.head.innerHTML}
<style>
  html, body { background: #fff !important; color: #000 !important; margin: 0; }
  body { padding: 24px; font-family: system-ui, "Segoe UI", Roboto, sans-serif; }
  * { color: #000 !important; background: transparent !important; border-color: #888 !important; box-shadow: none !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; }
  a { text-decoration: none; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; }
  tr, .break-avoid { break-inside: avoid; }
</style></head><body></body></html>`)
  w.document.close()
  w.document.body.appendChild(w.document.importNode(clone, true))
  const go = () => { w.focus(); w.print() }
  if (w.document.readyState === 'complete') setTimeout(go, 500)
  else w.addEventListener('load', () => setTimeout(go, 500))
  return true
}
