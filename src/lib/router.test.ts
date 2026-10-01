import { describe, expect, it } from 'vitest'
import { href, parseRoute } from './router'

const id = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'

describe('parseRoute', () => {
  it.each([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/new', { name: 'new' }],
    [`#/sets/${id}`, { name: 'set', id }],
    [`#/sets/${id}/cards`, { name: 'cards', id }],
    [`#/sets/${id.toUpperCase()}`, { name: 'set', id }],
    ['#/sets/abc', { name: 'notFound' }], // id の形が違うものは DB に問い合わせる前に弾く
    ['#/unknown', { name: 'notFound' }],
  ])('%s', (hash, expected) => {
    expect(parseRoute(hash)).toEqual(expected)
  })

  it('href で作ったリンクは parseRoute で元に戻る', () => {
    expect(parseRoute(href({ name: 'cards', id }))).toEqual({ name: 'cards', id })
  })
})
