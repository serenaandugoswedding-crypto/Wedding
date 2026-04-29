export const FILTERS = [
  {
    id:      'originale',
    label:   'ORIGINALE',
    css:     'none',
    overlay: null,
    vignette: false,
  },
  {
    id:      'bn_drama',
    label:   'B&N',
    css:     'grayscale(100%) contrast(1.25) brightness(0.95)',
    overlay: null,
    vignette: false,
  },
  {
    id:      'sepia_editorial',
    label:   'SEPIA',
    css:     'sepia(60%) contrast(1.1) saturate(0.7) brightness(1.05)',
    overlay: null,
    vignette: false,
  },
  {
    id:      'bloom_cipria',
    label:   'BLOOM',
    css:     'saturate(0.85) contrast(1.05) brightness(1.05) hue-rotate(-5deg)',
    overlay: { color: 'rgba(232,196,196,0.12)', blendMode: 'soft-light' },
    vignette: false,
  },
  {
    id:      'vintage_polaroid',
    label:   'VINTAGE',
    css:     'contrast(0.95) saturate(0.85) brightness(1.05) sepia(15%)',
    overlay: null,
    vignette: true,
  },
  {
    id:      'inchiostro',
    label:   'INCHIOSTRO',
    css:     'grayscale(100%) brightness(1.15) contrast(1.4)',
    overlay: null,
    vignette: false,
  },
  {
    id:      'notte_party',
    label:   'NOTTE',
    css:     'saturate(1.1) brightness(0.95) contrast(1.1) hue-rotate(8deg)',
    overlay: { color: 'rgba(255,180,100,0.08)', blendMode: 'multiply' },
    vignette: false,
  },
];

function applyVignette(ctx, w, h) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export function applyFilterToCanvas(imageElement, filter) {
  const canvas  = document.createElement('canvas');
  canvas.width  = imageElement.naturalWidth  || imageElement.width;
  canvas.height = imageElement.naturalHeight || imageElement.height;
  const ctx     = canvas.getContext('2d');

  // Step 1: CSS filter chain
  ctx.filter = filter.css === 'none' ? 'none' : filter.css;
  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

  // Step 2: overlay
  if (filter.overlay) {
    ctx.filter = 'none';
    ctx.globalCompositeOperation = filter.overlay.blendMode;
    ctx.fillStyle = filter.overlay.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Step 3: vignette
  if (filter.vignette) {
    applyVignette(ctx, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  return canvas;
}

export function canvasToBase64(canvas, quality = 0.92) {
  return canvas.toDataURL('image/jpeg', quality);
}

// Render a 60×60 thumbnail preview of a filter onto an existing <img>
export function renderThumbnail(imageElement, filter, size = 60) {
  const canvas  = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx     = canvas.getContext('2d');

  const iw = imageElement.naturalWidth  || imageElement.width;
  const ih = imageElement.naturalHeight || imageElement.height;
  const scale = Math.max(size / iw, size / ih);
  const sw    = iw * scale;
  const sh    = ih * scale;
  const ox    = (size - sw) / 2;
  const oy    = (size - sh) / 2;

  ctx.filter = filter.css === 'none' ? 'none' : filter.css;
  ctx.drawImage(imageElement, ox, oy, sw, sh);

  if (filter.overlay) {
    ctx.filter = 'none';
    ctx.globalCompositeOperation = filter.overlay.blendMode;
    ctx.fillStyle = filter.overlay.color;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (filter.vignette) {
    applyVignette(ctx, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }

  return canvas.toDataURL('image/jpeg', 0.75);
}
