import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './version'

const pkg = JSON.parse(
  Object.values(import.meta.glob('../../package.json', { query: '?raw', import: 'default', eager: true }))[0] as string,
) as { version: string }

describe('APP_VERSION', () => {
  it('package.json の version と同じ', () => {
    expect(APP_VERSION).toBe(pkg.version)
  })

  it('ベータ版の間は 0.y.z の形', () => {
    expect(APP_VERSION).toMatch(/^0\.\d+\.\d+$/)
  })
})
