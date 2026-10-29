import { normalizeCanvasUrl } from '../canvasUrl'

describe('normalizeCanvasUrl', () => {
  it('returns an empty string for blank input', () => {
    expect(normalizeCanvasUrl('   ')).toBe('')
  })

  it('adds https and trims trailing slashes', () => {
    expect(normalizeCanvasUrl(' school.instructure.com// ')).toBe('https://school.instructure.com')
  })

  it('keeps an existing scheme', () => {
    expect(normalizeCanvasUrl('http://canvas.example.edu/')).toBe('http://canvas.example.edu')
  })
})
