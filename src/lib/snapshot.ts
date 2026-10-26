/**
 * Saves the current frame as a PNG with a small brand watermark.
 * Needs the WebGL canvas to be created with preserveDrawingBuffer.
 */
export async function saveSnapshot(): Promise<boolean> {
  const source = document.querySelector<HTMLCanvasElement>('#scene canvas');
  if (!source) return false;

  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0);

  const scale = out.height / 900;
  const pad = 28 * scale;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = `900 ${22 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(245,245,245,0.85)';
  const brand = 'SGX.GRAFFITI';
  ctx.fillText(brand, out.width - pad, out.height - pad);
  ctx.font = `600 ${11 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(253,204,13,0.9)';
  ctx.fillText('SPATIALGINEERS', out.width - pad, out.height - pad - 26 * scale);

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SGX-Graffiti-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
