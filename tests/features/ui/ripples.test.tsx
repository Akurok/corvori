/// <reference types="bun-types" />
import { useRipples } from '@/hooks/ripples'
import { afterEach, beforeAll, expect, jest, test } from 'bun:test'
import { MotionConfig } from 'framer-motion'
import { act, useRef } from 'react'
import { type Root, createRoot } from 'react-dom/client'
import { setupReactDom } from '~/tests/setup/dom'

setupReactDom()

let root: Root | null = null

beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 200, 48)
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ''
  jest.useRealTimers()
})

function Harness() {
  const ref = useRef<HTMLDivElement>(null)
  const ripples = useRipples(ref)
  return (
    <div ref={ref} data-testid="row">
      {ripples}
      <div data-ripple-ignore>
        <button type="button">Configure</button>
      </div>
    </div>
  )
}

async function dispatchPointer(
  element: Element,
  type: string,
  options: PointerEventInit = {},
) {
  await act(async () => {
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        pointerType: 'mouse',
        ...options,
      }),
    )
  })
}

async function renderRow() {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root?.render(
      <MotionConfig skipAnimations>
        <Harness />
      </MotionConfig>,
    ),
  )

  return container.querySelector('[data-testid="row"]')!
}

function advanceTime(milliseconds: number) {
  act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

test('nested action areas do not trigger their containing ripple', async () => {
  const row = await renderRow()
  await dispatchPointer(row.querySelector('button')!, 'pointerdown')
  expect(row.querySelector('span')).toBeNull()

  await dispatchPointer(row, 'pointerdown')
  expect(row.querySelector('span')).not.toBeNull()
})

test('a long hold keeps the ripple until release elsewhere in the window', async () => {
  jest.useFakeTimers()
  const row = await renderRow()
  await dispatchPointer(row, 'pointerdown', { buttons: 1 })
  await dispatchPointer(row, 'pointermove', { buttons: 1 })
  advanceTime(30_000)
  expect(row.querySelector('span')).not.toBeNull()

  document.body.addEventListener(
    'pointerup',
    (event) => event.stopPropagation(),
    { once: true },
  )
  await dispatchPointer(document.body, 'pointerup')
  advanceTime(500)
  expect(row.querySelector('span')).toBeNull()
})

test('movement with no buttons pressed ends a press whose release was missed', async () => {
  jest.useFakeTimers()
  const row = await renderRow()
  await dispatchPointer(row, 'pointerdown', { buttons: 1 })

  await dispatchPointer(row, 'pointermove', { buttons: 0 })
  advanceTime(500)
  expect(row.querySelector('span')).toBeNull()
})

test('a new press fades the stale ripple and window blur fades the current one', async () => {
  jest.useFakeTimers()
  const row = await renderRow()
  await dispatchPointer(row, 'pointerdown', { buttons: 1 })
  const stale = row.querySelector('span')!

  await dispatchPointer(row, 'pointerdown', { buttons: 1 })
  advanceTime(500)
  expect(stale.isConnected).toBe(false)
  expect(row.querySelectorAll('span')).toHaveLength(1)

  await act(async () => {
    window.dispatchEvent(new Event('blur'))
  })
  advanceTime(500)
  expect(row.querySelector('span')).toBeNull()
})
