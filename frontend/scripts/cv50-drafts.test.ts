import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TextRun } from '../src/types/message'
const holder = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => [holder.value, (next: Record<string, unknown> | ((old: Record<string, unknown>) => Record<string, unknown>)) => {
    holder.value = typeof next === 'function' ? next(holder.value) : next
  }],
}))
import { useChatDrafts } from '../src/features/chat/useChatDrafts'
const people = {kind:'people',name:'CV50_DUPLICATE'} as const
const room = {kind:'room',name:'CV50_DUPLICATE'} as const
const other = {kind:'people',name:'CV50_OTHER'} as const
const line = (text: string): TextRun[] => [{text,bold:true,italic:false,size:18}]
type DraftHookResult = ReturnType<typeof useChatDrafts>

function DraftHarness({ capture }: { capture: (value: DraftHookResult) => void }) {
  const drafts = useChatDrafts()
  capture(drafts)
  return null
}

function renderDrafts(): DraftHookResult {
  let result: DraftHookResult | undefined
  renderToStaticMarkup(createElement(DraftHarness, {
    capture: (value) => { result = value },
  }))
  if (!result) throw new Error('DraftHarness did not render')
  return result
}
beforeEach(() => { holder.value = {} })
describe('CV50 — nháp riêng theo loại và tên hội thoại', () => {
  it('người/phòng cùng tên không dùng chung nháp, xóa một không xóa bên kia', () => {
    renderDrafts().updateDraft(people, line('nháp chat riêng 😊'))
    renderDrafts().updateDraft(room, line('nháp phòng 🎉'))
    expect(renderDrafts().getDraft(people)).toEqual(line('nháp chat riêng 😊'))
    expect(renderDrafts().getDraft(room)).toEqual(line('nháp phòng 🎉'))
    renderDrafts().clearDraft(people)
    expect(renderDrafts().getDraft(people)).toEqual([])
    expect(renderDrafts().getDraft(room)).toEqual(line('nháp phòng 🎉'))
  })
  it('chuyển A → B → phòng cùng tên → A vẫn giữ nháp độc lập', () => {
    renderDrafts().updateDraft(people,line('A'))
    renderDrafts().updateDraft(other,line('B'))
    renderDrafts().updateDraft(room,line('Phòng'))
    expect(renderDrafts().getDraft(people)).toEqual(line('A'))
    expect(renderDrafts().getDraft(other)).toEqual(line('B'))
    expect(renderDrafts().getDraft(room)).toEqual(line('Phòng'))
    expect(renderDrafts().hasAnyDraft()).toBe(true)
    renderDrafts().clearDraft(people)
    renderDrafts().clearDraft(other)
    renderDrafts().clearDraft(room)
    expect(renderDrafts().hasAnyDraft()).toBe(false)
  })
  it('không có nháp lưu vĩnh viễn ngoài state của phiên hiện tại', () => {
    renderDrafts().updateDraft(people,line('chỉ trong phiên'))
    holder.value = {} // kết thúc/unmount phiên; state hook mới
    expect(renderDrafts().getDraft(people)).toEqual([])
  })
})
