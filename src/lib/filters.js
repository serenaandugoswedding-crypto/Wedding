// ── Pixel-level filter engine ────────────────────────────────────
// Replaces ctx.filter API which is broken/weak on iOS Safari (WebKit).
// All filters use getImageData / putImageData for cross-browser parity.

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

// RGB (0-255) → HSL (all in [0,1])
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
  const l   = (max + min) * 0.5;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else                h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 0.1667) return p + (q - p) * 6 * t;
  if (t < 0.5)    return q;
  if (t < 0.6667) return p + (q - p) * (0.6667 - t) * 6;
  return p;
}

// HSL (all in [0,1]) → RGB (0-255 integers)
function hslToRgb255(h, s, l) {
  if (s === 0) { const v = clamp255(Math.round(l * 255)); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    clamp255(Math.round(hue2rgb(p, q, h + 0.3333) * 255)),
    clamp255(Math.round(hue2rgb(p, q, h)           * 255)),
    clamp255(Math.round(hue2rgb(p, q, h - 0.3333)  * 255)),
  ];
}

// Adjust saturation and hue in a single HSL round-trip
function hslAdjust(r, g, b, satMul, hueDelta) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const newH = ((h + hueDelta) % 1 + 1) % 1;
  const newS = s * satMul < 0 ? 0 : s * satMul > 1 ? 1 : s * satMul;
  return hslToRgb255(newH, newS, l);
}

// Adjust saturation only
function saturateOnly(r, g, b, satMul) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const newS = s * satMul < 0 ? 0 : s * satMul > 1 ? 1 : s * satMul;
  return hslToRgb255(h, newS, l);
}

// Soft-light blend (W3C composite spec): source (sr,sg,sb) with alpha `a` over backdrop (r,g,b)
function softLightPixel(r, g, b, sr, sg, sb, a) {
  function sl(cb, cs) {
    if (cs <= 0.5) return cb - (1 - 2 * cs) * cb * (1 - cb);
    const d = cb <= 0.25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb);
    return cb + (2 * cs - 1) * (d - cb);
  }
  const cbr = r/255, cbg = g/255, cbb = b/255;
  const csr = sr/255, csg = sg/255, csb = sb/255;
  return [
    clamp255(Math.round(((1-a)*cbr + a*sl(cbr, csr)) * 255)),
    clamp255(Math.round(((1-a)*cbg + a*sl(cbg, csg)) * 255)),
    clamp255(Math.round(((1-a)*cbb + a*sl(cbb, csb)) * 255)),
  ];
}

// ── Per-filter pixel loops ───────────────────────────────────────

function processPixels(data, filterId) {
  const n = data.length;

  switch (filterId) {

    // B&N: grayscale → brightness(0.95) → contrast(1.25)
    case 'bn_drama':
      for (let i = 0; i < n; i += 4) {
        const lum = (0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]) * 0.95;
        const v   = clamp255((lum - 128) * 1.25 + 128);
        data[i] = data[i+1] = data[i+2] = v;
      }
      break;

    // SEPIA: sepia(60%) → contrast(1.1) → saturate(0.7) → brightness(1.05)
    case 'sepia_editorial':
      for (let i = 0; i < n; i += 4) {
        const r0 = data[i], g0 = data[i+1], b0 = data[i+2];
        const sr = clamp255(r0*0.393 + g0*0.769 + b0*0.189);
        const sg = clamp255(r0*0.349 + g0*0.686 + b0*0.168);
        const sb = clamp255(r0*0.272 + g0*0.534 + b0*0.131);
        // blend 60% sepia + 40% original
        let r = r0 + (sr - r0)*0.6;
        let g = g0 + (sg - g0)*0.6;
        let b = b0 + (sb - b0)*0.6;
        // contrast(1.1)
        r = (r - 128)*1.1 + 128;
        g = (g - 128)*1.1 + 128;
        b = (b - 128)*1.1 + 128;
        // saturate(0.7)
        const [tr, tg, tb] = saturateOnly(clamp255(r), clamp255(g), clamp255(b), 0.7);
        // brightness(1.05)
        data[i]   = clamp255(tr * 1.05);
        data[i+1] = clamp255(tg * 1.05);
        data[i+2] = clamp255(tb * 1.05);
      }
      break;

    // BLOOM: saturate(0.85) + hueRotate(-5deg) → contrast(1.05) → brightness(1.05) → soft-light overlay (232,196,196,0.12)
    case 'bloom_cipria':
      for (let i = 0; i < n; i += 4) {
        let [r, g, b] = hslAdjust(data[i], data[i+1], data[i+2], 0.85, -5/360);
        r = clamp255((r - 128)*1.05 + 128);
        g = clamp255((g - 128)*1.05 + 128);
        b = clamp255((b - 128)*1.05 + 128);
        r = clamp255(r * 1.05);
        g = clamp255(g * 1.05);
        b = clamp255(b * 1.05);
        const [fr, fg, fb] = softLightPixel(r, g, b, 232, 196, 196, 0.12);
        data[i] = fr; data[i+1] = fg; data[i+2] = fb;
      }
      break;

    // VINTAGE: contrast(0.95) → saturate(0.85) → brightness(1.05) → sepia(15%)
    case 'vintage_polaroid':
      for (let i = 0; i < n; i += 4) {
        const r0 = data[i], g0 = data[i+1], b0 = data[i+2];
        // contrast(0.95)
        let r = (r0 - 128)*0.95 + 128;
        let g = (g0 - 128)*0.95 + 128;
        let b = (b0 - 128)*0.95 + 128;
        // saturate(0.85)
        const [tr, tg, tb] = saturateOnly(clamp255(r), clamp255(g), clamp255(b), 0.85);
        // brightness(1.05)
        const r2 = tr * 1.05, g2 = tg * 1.05, b2 = tb * 1.05;
        // sepia(15%)
        const sr = clamp255(r2*0.393 + g2*0.769 + b2*0.189);
        const sg = clamp255(r2*0.349 + g2*0.686 + b2*0.168);
        const sb = clamp255(r2*0.272 + g2*0.534 + b2*0.131);
        data[i]   = clamp255(r2 + (sr - r2)*0.15);
        data[i+1] = clamp255(g2 + (sg - g2)*0.15);
        data[i+2] = clamp255(b2 + (sb - b2)*0.15);
      }
      break;

    // INCHIOSTRO: grayscale → brightness(1.15) → contrast(1.4)  — high contrast ink look
    case 'inchiostro':
      for (let i = 0; i < n; i += 4) {
        const lum = (0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]) * 1.15;
        const v   = clamp255((lum - 128) * 1.4 + 128);
        data[i] = data[i+1] = data[i+2] = v;
      }
      break;

    // NOTTE: saturate(1.1) + hueRotate(8deg) → brightness(0.95) → contrast(1.1) → multiply overlay (255,180,100,0.08)
    case 'notte_party':
      for (let i = 0; i < n; i += 4) {
        let [r, g, b] = hslAdjust(data[i], data[i+1], data[i+2], 1.1, 8/360);
        r = clamp255((r * 0.95 - 128)*1.1 + 128);
        g = clamp255((g * 0.95 - 128)*1.1 + 128);
        b = clamp255((b * 0.95 - 128)*1.1 + 128);
        // multiply blend: result = (1-a)*Cb + a*(Cb × Cs)  — warm amber tint
        data[i]   = clamp255(0.92*r + 0.08*(r * 1.0));        // Cs_r = 255/255 = 1.0
        data[i+1] = clamp255(0.92*g + 0.08*(g * 0.706));      // Cs_g = 180/255
        data[i+2] = clamp255(0.92*b + 0.08*(b * 0.392));      // Cs_b = 100/255
      }
      break;

    default:
      break; // originale — no-op
  }
}

// ── Vignette (canvas gradient — fine on iOS, no ctx.filter used) ──

function applyVignette(ctx, w, h) {
  const grad = ctx.createRadialGradient(w/2, h/2, w*0.35, w/2, h/2, w*0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

// ── Public API ───────────────────────────────────────────────────

export const FILTERS = [
  { id: 'originale',        label: 'ORIGINALE', vignette: false },
  { id: 'bn_drama',         label: 'B&N',       vignette: false },
  { id: 'sepia_editorial',  label: 'SEPIA',     vignette: false },
  { id: 'bloom_cipria',     label: 'BLOOM',     vignette: false },
  { id: 'vintage_polaroid', label: 'VINTAGE',   vignette: true  },
  { id: 'inchiostro',       label: 'INCHIOSTRO',vignette: false },
  { id: 'notte_party',      label: 'NOTTE',     vignette: false },
];

// maxDim: optional — caps the canvas long-edge for preview performance (use 1200 for preview, omit for publish).
export function applyFilterToCanvas(imageElement, filter, maxDim) {
  let w = imageElement.naturalWidth  || imageElement.width;
  let h = imageElement.naturalHeight || imageElement.height;

  if (maxDim && (w > maxDim || h > maxDim)) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0, w, h);

  if (filter.id !== 'originale') {
    console.time(`filter:${filter.id}`);
    const imageData = ctx.getImageData(0, 0, w, h);
    processPixels(imageData.data, filter.id);
    ctx.putImageData(imageData, 0, 0);
    console.timeEnd(`filter:${filter.id}`);
  }

  if (filter.vignette) applyVignette(ctx, w, h);

  return canvas;
}

export function canvasToBase64(canvas, quality = 0.92) {
  return canvas.toDataURL('image/jpeg', quality);
}

// Resize canvas to maxDim on the long edge; returns original if already within limit.
export function resizeCanvasToMaxDimension(canvas, maxDim) {
  const { width, height } = canvas;
  if (width <= maxDim && height <= maxDim) return canvas;
  const scale = maxDim / Math.max(width, height);
  const out   = document.createElement('canvas');
  out.width   = Math.round(width  * scale);
  out.height  = Math.round(height * scale);
  out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

// 60×60 thumbnail preview of a filter (already small — fast on any device).
export function renderThumbnail(imageElement, filter, size = 60) {
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const iw = imageElement.naturalWidth  || imageElement.width;
  const ih = imageElement.naturalHeight || imageElement.height;
  const scale = Math.max(size / iw, size / ih);
  const sw = iw * scale, sh = ih * scale;
  const ox = (size - sw) / 2, oy = (size - sh) / 2;

  ctx.drawImage(imageElement, ox, oy, sw, sh);

  if (filter.id !== 'originale') {
    const imageData = ctx.getImageData(0, 0, size, size);
    processPixels(imageData.data, filter.id);
    ctx.putImageData(imageData, 0, 0);
  }

  if (filter.vignette) applyVignette(ctx, size, size);

  return canvas.toDataURL('image/jpeg', 0.75);
}
