import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/app'

const PHONE = { width: 375, height: 812 }
const ROUTES = ['/dashboard', '/grades', '/planner', '/study', '/future', '/ai', '/settings']

// Collects every on-screen interactive element and every element that floats
// over the page (absolute/fixed and outside normal flow), then reports pairs
// where a floating element covers part of an interactive one it doesn't contain.
async function findOverlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const visible = (r: DOMRect) =>
      r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw

    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>('[role="button"], [role="tab"], button, input, textarea, a[href]'),
    ).filter((el) => visible(el.getBoundingClientRect()))

    const floating = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((el) => {
      const style = getComputedStyle(el)
      if (style.position !== 'fixed' && style.position !== 'absolute') return false
      // pointer-events is not checked: RN's box-none wrappers render as pointer-events:none
      // while their buttons still capture taps.
      if (style.opacity === '0' || style.visibility === 'hidden') return false
      const r = el.getBoundingClientRect()
      if (!visible(r)) return false
      // Full-screen navigator containers are absolute too; only small overlays matter.
      return r.width < vw * 0.9 && r.height < vh * 0.5 && el.querySelector('[role="button"], button, [role="tab"]') !== null
    })

    const label = (el: HTMLElement) =>
      el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.tagName

    const out: string[] = []
    for (const f of floating) {
      const fr = f.getBoundingClientRect()
      for (const el of interactive) {
        if (f.contains(el) || el.contains(f)) continue
        const er = el.getBoundingClientRect()
        const ix = Math.min(fr.right, er.right) - Math.max(fr.left, er.left)
        const iy = Math.min(fr.bottom, er.bottom) - Math.max(fr.top, er.top)
        if (ix > 4 && iy > 4) out.push(`"${label(f)}" covers "${label(el)}"`)
      }
    }
    return Array.from(new Set(out))
  })
}

// Words split across two lines ("Classwo / rk") mean a container is too narrow for its label.
async function findBrokenWords(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      const re = /\S{4,}/g
      for (let m = re.exec(text); m; m = re.exec(text)) {
        range.setStart(node, m.index)
        range.setEnd(node, m.index + m[0].length)
        const tops = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top)))
        if (tops.size > 1) out.push(`word "${m[0]}" breaks across lines`)
      }
    }
    return Array.from(new Set(out))
  })
}

async function scrollableHeights(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.max(
      0,
      ...Array.from(document.querySelectorAll<HTMLElement>('*'))
        .filter((el) => el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflowY !== 'visible')
        .map((el) => el.scrollHeight - el.clientHeight),
    ),
  )
}

async function scrollAllTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      if (el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflowY !== 'visible') {
        el.scrollTop = top
      }
    }
  }, y)
  await page.waitForTimeout(150)
}

for (const route of ROUTES) {
  test(`no floating UI covers controls on ${route} (phone)`, async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(route)
    await page.getByRole('tab').first().waitFor()
    await page.waitForTimeout(800)

    await page.screenshot({ path: test.info().outputPath(`overlap${route.replace(/\//g, '-')}.png`) })
    const problems = await findBrokenWords(page)
    const max = await scrollableHeights(page)
    for (let y = 0; y <= max + 120; y += 120) {
      await scrollAllTo(page, y)
      problems.push(...(await findOverlaps(page)).map((p) => `${p} (scrollTop ${y})`))
    }

    expect(Array.from(new Set(problems)), problems.join('\n')).toEqual([])
  })
}
