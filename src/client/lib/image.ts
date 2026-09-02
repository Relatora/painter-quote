import { PHOTO_MAX_EDGE } from '../../shared/types'

/**
 * Scales dimensions so the longest edge is at most `maxEdge`, preserving aspect ratio.
 * Never enlarges: a photo already smaller than the cap is uploaded as it is rather than
 * being blown up into a bigger file with no extra detail.
 *
 * Separated out and exported so the arithmetic is testable without a canvas.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 }
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export interface PreparedImage {
  blob: Blob
  width: number
  height: number
}

/**
 * Decodes, re-orients, downscales, and re-encodes a photo before upload.
 *
 * Resizing on the client rather than the Worker matters for three reasons: a painter on a
 * truck's cell connection uploads roughly a tenth as many bytes, R2 stores a tenth as
 * much, and the vision model later reads a tenth as many image tokens.
 *
 * EXIF orientation is the trap. A phone camera almost never rotates pixels; it records the
 * rotation as metadata and expects the viewer to apply it. Drawing such a file straight to
 * a canvas discards that metadata, so a photo taken in portrait arrives on the customer's
 * quote lying on its side. `createImageBitmap` with `imageOrientation: 'from-image'` bakes
 * the rotation into the pixels, which is exactly what we want before stripping metadata.
 */
export async function prepareImage(
  file: File,
  maxEdge: number = PHOTO_MAX_EDGE,
): Promise<PreparedImage> {
  const source = await decode(file)
  const { width, height } = fitWithin(source.width, source.height, maxEdge)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare this photo on this device.')

  // Job photos are dim interiors and detailed surfaces, so resampling quality is worth
  // the cost. This is one image at a time, not a batch.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source.image, 0, 0, width, height)

  if ('close' in source.image) source.image.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    // 0.82 keeps surface texture and cracked caulk legible while cutting size hard.
    canvas.toBlob(resolve, 'image/jpeg', 0.82),
  )
  if (!blob) throw new Error('Could not prepare this photo on this device.')

  return { blob, width, height }
}

type Decoded = { image: ImageBitmap | HTMLImageElement; width: number; height: number }

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { image: bitmap, width: bitmap.width, height: bitmap.height }
    } catch {
      // Older Safari rejects the options argument outright. Fall through.
    }
  }

  // Fallback path. Browsers apply EXIF orientation when rendering an <img>, and the
  // naturalWidth/naturalHeight reported are the oriented ones, so drawing this element
  // to a canvas is correct on every engine that lacks the bitmap option.
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('That file could not be read as an image.'))
      image.src = url
    })
    return { image, width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}
