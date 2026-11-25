/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Vitest runs from web/; jsdom makes import.meta.url non-file, so read by relative path
const css = readFileSync('src/index.css', 'utf8')

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!match) throw new Error(`missing --color-${name}`)
  return match[1]
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('palette', () => {
  it.each([
    ['ink', 'paper', 4.5], ['ink', 'paper-2', 4.5], ['muted', 'paper', 4.5], ['muted', 'paper-2', 4.5],
    ['accent', 'paper', 4.5], ['accent', 'paper-2', 4.5], ['cell-green', 'paper', 4.5], ['yellow-ink', 'paper', 4.5],
    ['cell-red', 'paper', 4.5], ['paper', 'cell-green', 4.5], ['paper', 'ink', 4.5], ['paper-2', 'binding', 4.5],
    ['ring', 'paper', 3],
  ])('%s on %s is at least %s:1', (fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min)
  })
})
