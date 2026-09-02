import { describe, it, expect } from 'vitest'
import { fitWithin } from './image'

describe('fitWithin', () => {
  it('scales a landscape photo down by its longest edge', () => {
    // A typical 12MP phone photo in landscape.
    expect(fitWithin(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 })
  })

  it('scales a portrait photo down by its longest edge', () => {
    expect(fitWithin(3024, 4032, 1024)).toEqual({ width: 768, height: 1024 })
  })

  it('preserves aspect ratio on an awkward ratio', () => {
    const { width, height } = fitWithin(4000, 1000, 1024)
    expect(width).toBe(1024)
    expect(height).toBe(256)
  })

  it('never enlarges an image already under the cap', () => {
    // Upscaling would produce a bigger file carrying no more detail.
    expect(fitWithin(640, 480, 1024)).toEqual({ width: 640, height: 480 })
  })

  it('leaves an image exactly at the cap alone', () => {
    expect(fitWithin(1024, 768, 1024)).toEqual({ width: 1024, height: 768 })
  })

  it('never rounds a very thin image down to zero', () => {
    // 5000x3 would scale to 0.6px tall. A zero dimension makes canvas throw.
    expect(fitWithin(5000, 3, 1024).height).toBe(1)
  })

  it('is safe on degenerate input', () => {
    expect(fitWithin(0, 0, 1024)).toEqual({ width: 1, height: 1 })
    expect(fitWithin(Number.NaN, 100, 1024)).toEqual({ width: 1, height: 1 })
  })
})
