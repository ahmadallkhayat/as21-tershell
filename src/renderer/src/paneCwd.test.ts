import { describe, expect, it } from 'vitest'
import { getPaneCwd, parseOsc7, registerPaneCwd } from './paneCwd'

describe('parseOsc7', () => {
  it('parses an empty-host Windows URL', () => {
    expect(parseOsc7('file:///C:/Users/ahmad/projects')).toBe('C:\\Users\\ahmad\\projects')
  })

  it('discards a named host', () => {
    expect(parseOsc7('file://DESKTOP-01/C:/work')).toBe('C:\\work')
  })

  it('decodes percent-escaped path segments', () => {
    expect(parseOsc7('file:///C:/Program%20Files/Git')).toBe('C:\\Program Files\\Git')
  })

  it('keeps a POSIX path from a WSL distro intact', () => {
    expect(parseOsc7('file://Ubuntu/home/ahmad')).toBe('/home/ahmad')
  })

  it('returns null for non-file payloads', () => {
    expect(parseOsc7('https://example.com/x')).toBeNull()
    expect(parseOsc7('')).toBeNull()
  })

  it('returns null when there is no path at all', () => {
    expect(parseOsc7('file://host')).toBeNull()
    expect(parseOsc7('file:///')).toBeNull()
  })

  it('falls back to the raw text on malformed percent-escapes', () => {
    // decodeURIComponent throws on a lone '%'; the raw path is still more
    // useful than dropping the update entirely.
    expect(parseOsc7('file:///C:/bad%path')).toBe('C:\\bad%path')
  })
})

describe('pane cwd registry', () => {
  it('stores and clears a pane’s directory', () => {
    registerPaneCwd('pane-1', 'C:\\a')
    expect(getPaneCwd('pane-1')).toBe('C:\\a')
    registerPaneCwd('pane-1', null)
    expect(getPaneCwd('pane-1')).toBeUndefined()
  })
})
