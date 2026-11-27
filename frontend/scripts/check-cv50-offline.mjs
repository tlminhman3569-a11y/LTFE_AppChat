import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
require.extensions['.ts'] = (module, file) => {
  const source = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  const fatal = code.diagnostics?.filter(x => x.category === ts.DiagnosticCategory.Error) ?? []
  if (fatal.length) throw new Error('Không biên dịch được ' + file + ': ' + fatal.map(d => d.messageText).join('; '))
  module._compile(code.outputText, file)
}
const src = path.resolve('src')
const { createConversationKey } = require(path.join(src, 'utils/conversationKey.ts'))
const { normalizeRecentConversations } = require(path.join(src, 'utils/normalizeRecentConversations.ts'))
const { filterRecentConversations } = require(path.join(src, 'utils/filterRecentConversations.ts'))
const { resolveLookupConversation } = require(path.join(src, 'utils/resolveLookupConversation.ts'))
const { createMessageId, serializeRichMessage, parseRichMessage } = require(path.join(src, 'utils/richMessage.ts'))
const { matchesOutgoing } = require(path.join(src, 'utils/matchesOutgoing.ts'))
const { replaceRuns, sliceRuns, findTextEdit } = require(path.join(src, 'features/editor/editRuns.ts'))
let passed = 0
function check(label, actual, expected) { assert.deepEqual(actual, expected, label); passed++; console.log('PASS', label) }
function truth(label, actual) { assert.ok(actual, label); passed++; console.log('PASS', label) }
const people = { kind: 'people', name: 'TrungTenCV50' }
const room = { kind: 'room', name: 'TrungTenCV50' }
truth('khóa người/phòng trùng tên tách biệt', createConversationKey(people) !== createConversationKey(room))
truth('khóa không va chạm với ký tự phân cách trong tên', createConversationKey({ kind:'people', name: 'a|room|b' }) !== createConversationKey({ kind:'room', name:'a|room|b' }))
const normalized = normalizeRecentConversations([
  { type: 0, name: people.name }, { type: 1, name: room.name }, { type: 0, name: people.name },
])
check('danh sách hai loại cùng tên không bị gộp', normalized.status, 'success')
if (normalized.status !== 'success') throw new Error('Không nhận danh sách')
check('số hội thoại cùng tên sau khử trùng theo loại', normalized.data.length, 2)
check('lọc theo tên hiển thị đủ hai loại', filterRecentConversations(normalized.data, 'trungten').length, 2)
check('lọc phòng không hiển thị user cùng tên', filterRecentConversations(normalized.data, 'trungten', 'room').map(x => x.kind), ['room'])
check('tra cứu username không nhầm sang phòng cùng tên', resolveLookupConversation(people.name, normalized.data), people)
const sizes = [12,14,16,18,24]
for (const size of sizes) {
  const runs = [{ text: `Xin chào 😊\nCỡ ${size}`, bold: true, italic: true, size }]
  const content = { version: 1, clientMessageId: 'CV50_' + size, runs }
  const encoded = serializeRichMessage(content)
  check(`serialize định dạng và size ${size}`, encoded.status, 'success')
  if (encoded.status === 'success') {
    truth(`escape Unicode bên trong mes size ${size}`, /^[\x00-\x7f]*$/.test(encoded.data))
    check(`parse giữ nguyên Unicode, cỡ và định dạng ${size}`, parseRichMessage(encoded.data), content)
  }
}
const make = (clientMessageId, kind='people', to=people.name) => {
  const content = { version:1, clientMessageId, runs: [{text:'giống hệt 😊',bold:false,italic:false,size:16}] }
  const mes = serializeRichMessage(content)
  if (mes.status !== 'success') throw Error('Không tạo được tin thử')
  return { name: 'khoi-test', kind, to, mes: mes.data }
}
truth('cùng chữ nhưng khác mã tin không gộp', !matchesOutgoing(make('a'), make('b')))
truth('cùng mã, khác loại hội thoại không gộp', !matchesOutgoing(make('a'), make('a', 'room')))
truth('cùng mã, khác đích nhận không gộp', !matchesOutgoing(make('a'), make('a','other')))
truth('tin khớp đủ mã/người/loại/đích thì đối chiếu được', matchesOutgoing(make('a'), make('a')))
check('JSON lỗi không được nhận là rich v1', parseRichMessage('APPCHAT_RICH_V1{oops'), null)
check('schema sai size không được nhận', parseRichMessage('APPCHAT_RICH_V1'+JSON.stringify({version:1,clientMessageId:'x',runs:[{text:'a',bold:false,italic:false,size:42}]})), null)
check('HTML thuần được giữ là text, không nhận rich', parseRichMessage('<img src=x onerror=alert(1)>'), null)
const massive = serializeRichMessage({version:1,clientMessageId:'x',runs:[{text:'😊'.repeat(300),bold:false,italic:false,size:16}]})
check('vượt giới hạn byte bị chặn thay vì cắt tin', massive.status, 'error')
const base = [{text:'abc',bold:false,italic:false,size:16},{text:'DEF',bold:true,italic:false,size:24}]
check('định dạng đoạn được giữ khi thay vùng chọn', replaceRuns(base, 2,4,[{text:'😊',bold:false,italic:true,size:18}]), [
  {text:'ab',bold:false,italic:false,size:16},{text:'😊',bold:false,italic:true,size:18},{text:'EF',bold:true,italic:false,size:24},
])
check('lấy vùng chọn không làm mất kiểu',sliceRuns(base,3,6),[{text:'DEF',bold:true,italic:false,size:24}])
check('vị trí thêm ký tự lặp đúng',findTextEdit('aa','aaa',2),{start:1,end:1,text:'a'})
truth('hai id tạo mới không trùng',createMessageId() !== createMessageId())
console.log(`CV50 OFFLINE: ${passed}/${passed} PASS; không thử API thật, không thử UI/bàn phím.`)
