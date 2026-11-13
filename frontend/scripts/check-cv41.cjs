const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')

const base = path.join(__dirname, '..', 'src', 'features', 'rooms')
let sessionGeneration = 10
const makeElement = (type, props, key) => ({ type, props: props || {}, key })
const reactRuntime = { jsx: makeElement, jsxs: makeElement }
const react = {
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  useEffect: () => {},
  useRef: value => ({ current: value }),
  useState: value => [value, () => {}],
}
const modules = new Map()
const dependencies = {
  react,
  'react/jsx-runtime': reactRuntime,
  '../../store/hooks': { useAppSelector: selector => selector({ auth: { sessionGeneration } }) },
  '../../store': { store: { getState: () => ({ auth: { sessionGeneration } }) } },
  './roomMockServices': { mockJoinRoom: async name => ({ status: 'success', data: room(name) }) },
}
function loadModule(file) {
  if (modules.has(file)) return modules.get(file)
  const source = fs.readFileSync(path.join(base, file), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText
  const module = { exports: {} }
  modules.set(file, module.exports)
  const requireFile = name => {
    if (name in dependencies) return dependencies[name]
    if (name === './leaveRoomRequestState') return loadModule('leaveRoomRequestState.ts')
    if (name === './roomRequestState') return loadModule('roomRequestState.ts')
    throw new Error(`Unknown dependency ${name}`)
  }
  vm.runInNewContext(`(function(require, module, exports){${compiled}\n})`, {console})(requireFile, module, module.exports)
  return module.exports
}
const MemberList = loadModule('MemberList.tsx').default
const LeaveRoom = loadModule('LeaveRoom.tsx').default
const JoinRoom = loadModule('JoinRoom.tsx').default
const leaveState = loadModule('leaveRoomRequestState.ts')
const roomState = loadModule('roomRequestState.ts')

function nodes(root) {
  if (root == null || typeof root === 'boolean') return []
  if (Array.isArray(root)) return root.flatMap(nodes)
  if (typeof root !== 'object') return []
  return [root, ...nodes(root.props?.children)]
}
function text(root) {
  if (root == null || typeof root === 'boolean') return ''
  if (Array.isArray(root)) return root.map(text).join(' ')
  if (typeof root !== 'object') return String(root)
  return text(root.props?.children)
}
function find(root, type, label) {
  const hit = nodes(root).find(node => node.type === type && (!label || text(node).includes(label)))
  assert.ok(hit, `Missing ${type}: ${label}`)
  return hit
}
function report(label, fn) {
  return Promise.resolve().then(fn).then(() => { passed++; results.push(`PASS ${label}`); console.log(`PASS ${label}`) })
}
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return {promise, resolve}
}
function room(name, changes = {}) {
  return { name, owner:'man_demo', ownerKnown:true, members:['man_demo','khoi_demo','kiet_demo'], membersKnown:true, membership:'member', ...changes }
}
function leaveProps(r, changes = {}) {
  return {room:r, currentUser:'khoi_demo', hasDraft:false, onClose:()=>{}, onLeaveConfirmed:()=>{}, ...changes}
}
let passed = 0
const results = []
async function main() {
  await report('F15: hien ten phong va dung tong 3 thanh vien', () => {
    const tree = MemberList({room:room('nhom_hoc'),currentUser:'khoi_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{}})
    assert.match(text(tree), /Thành viên\s+· 3/)
    assert.match(text(tree), /nhom_hoc/)
  })
  await report('F15: chu phong la man_demo theo fixture, khong phai nguoi dang nhap', () => {
    const tree = MemberList({room:room('nhom_hoc'),currentUser:'khoi_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{}})
    const items = nodes(tree).filter(n=>n.type==='li')
    assert.match(text(items[0]), /man_demo.*Chủ phòng/)
    assert.match(text(items[1]), /khoi_demo.*Bạn · Thành viên/)
    assert.doesNotMatch(text(items[1]), /Chủ phòng/)
  })
  await report('F15: khong hien 0 khi chua ro danh sach', () => {
    const tree = MemberList({room:room('chua_ro',{membersKnown:false,members:undefined,ownerKnown:false,owner:undefined,membership:'unknown'}),currentUser:'khoi_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{}})
    assert.match(text(tree), /Chưa có thông tin danh sách thành viên/)
    assert.doesNotMatch(text(tree), /Thành viên\s+· 0/)
    assert.match(text(tree), /Chưa xác định được chủ phòng/)
  })
  await report('F15: mang rong da xac nhan moi hien danh sach trong', () => {
    const tree = MemberList({room:room('trong',{members:[]}),currentUser:'khoi_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{}})
    assert.match(text(tree), /Thành viên\s+· 0/)
    assert.match(text(tree), /Danh sách thành viên trống/)
  })
  await report('F15: membersKnown true nhung thieu mang khong gia tao 0', () => {
    const tree = MemberList({room:room('thieu',{members:undefined}),currentUser:'khoi_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{}})
    assert.doesNotMatch(text(tree), /Thành viên\s+· 0/)
  })
  await report('F15: dang tai lan dau co thong bao', () => {
    const tree = MemberList({room:room('load',{membersKnown:false,members:undefined}),currentUser:'khoi_demo',loading:true,error:null,onRefresh:()=>{},onClose:()=>{}})
    assert.match(text(tree), /Đang tải thành viên/)
    assert.equal(find(tree,'button','Đang tải').props.disabled,true)
  })
  await report('F15: loi lan dau hien retry khong gia du lieu', () => {
    let called
    const tree = MemberList({room:room('error',{membersKnown:false,members:undefined}),currentUser:'khoi_demo',loading:false,error:{kind:'connection',message:'Loi tai'},onRefresh:ref=>{called=ref},onClose:()=>{}})
    assert.match(text(tree), /Loi tai/)
    find(tree,'button','Thử lại').props.onClick()
    assert.deepEqual(JSON.parse(JSON.stringify(called)), {kind:'room',name:'error'})
  })
  await report('F15: loi lam moi giu du 3 thanh vien va canh bao cu', () => {
    const tree = MemberList({room:room('old'),currentUser:'khoi_demo',loading:false,error:{kind:'timeout',message:'Qua thoi gian'},onRefresh:()=>{},onClose:()=>{}})
    assert.equal(nodes(tree).filter(n=>n.type==='li').length,3)
    assert.match(text(tree), /có thể đã cũ/)
    assert.match(text(tree), /Thử lại/)
  })
  await report('F15: nhan Lam moi dung kind va name', () => {
    let ref
    const tree=MemberList({room:room('nhom_hoc'),currentUser:'khoi_demo',loading:false,error:null,onRefresh:x=>{ref=x},onClose:()=>{}})
    find(tree,'button','Làm mới').props.onClick()
    assert.deepEqual(JSON.parse(JSON.stringify(ref)),{kind:'room',name:'nhom_hoc'})
  })
  await report('F15: dong bang chi callback close, khong cham nhap', () => {
    let closed=0
    const tree=MemberList({room:room('nhom_hoc'),currentUser:'khoi_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{closed++}})
    find(tree,'button','Đóng').props.onClick()
    assert.equal(closed,1)
  })
  await report('F15: member co the yeu cau mo hop roi phong', () => {
    let ref
    const tree=MemberList({room:room('nhom_hoc'),currentUser:'khoi_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{},onRequestLeave:x=>{ref=x}})
    const button=find(tree,'button','Rời phòng')
    assert.equal(button.props.disabled,false)
    button.props.onClick()
    assert.deepEqual(JSON.parse(JSON.stringify(ref)),{kind:'room',name:'nhom_hoc'})
  })
  await report('F17: chu thuc te theo owner bi chan roi', () => {
    const tree=MemberList({room:room('owner'),currentUser:'man_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{},onRequestLeave:()=>{}})
    assert.equal(find(tree,'button','Rời phòng').props.disabled,true)
    assert.match(text(tree), /Chủ phòng không thể tự rời/)
  })
  await report('F17: membership owner cu nhung ownerKnown la nguoi khac khong tu chan', () => {
    const tree=MemberList({room:room('other',{membership:'owner'}),currentUser:'khoi_demo',loading:false,error:null,onRefresh:()=>{},onClose:()=>{},onRequestLeave:()=>{}})
    assert.equal(find(tree,'button','Rời phòng').props.disabled,false)
  })
  await report('F16: hop roi hien ten phong va canh bao nhap', () => {
    const tree=LeaveRoom(leaveProps(room('draft'),{hasDraft:true,draftPreview:'noi dung chua gui'}))
    assert.match(text(tree), /Rời phòng\s+draft/)
    assert.match(text(tree), /noi dung chua gui/)
    assert.match(text(tree), /chỉ bị xóa sau khi rời phòng thành công/)
  })
  await report('F16: huy truoc submit khong gui OUT_ROOM', () => {
    let count=0, closed=0
    const tree=LeaveRoom(leaveProps(room('cancel'),{leaveRoom:async()=>{count++;return {status:'success',data:{roomName:'cancel'}}}, onClose:()=>{closed++}}))
    find(tree,'button','Hủy').props.onClick()
    assert.equal(count,0)
    assert.equal(closed,1)
  })
  await report('F17: owner khong the submit va co ly do', async () => {
    let count=0
    const tree=LeaveRoom(leaveProps(room('owner-leave'),{currentUser:'man_demo', leaveRoom:async()=>{count++;return {status:'success',data:{roomName:'owner-leave'}}}}))
    assert.equal(find(tree,'button','Xác nhận rời phòng').props.disabled,true)
    assert.match(text(tree), /chủ phòng nên không thể tự rời/)
    await find(tree,'form').props.onSubmit({preventDefault(){}})
    assert.equal(count,0)
  })
  await report('F16: can dang nhap moi gui lenh', async () => {
    let count=0
    const tree=LeaveRoom(leaveProps(room('no-user'),{currentUser:null,leaveRoom:async()=>{count++;return {status:'success',data:{roomName:'no-user'}}}}))
    assert.equal(find(tree,'button','Xác nhận rời phòng').props.disabled,true)
    await find(tree,'form').props.onSubmit({preventDefault(){}})
    assert.equal(count,0)
  })
  await report('F16: submit thanh cong moi callback khoa composer', async () => {
    let result=0, statuses=[]
    const tree=LeaveRoom(leaveProps(room('confirm-success'),{leaveRoom:async()=>({status:'success',data:{roomName:'confirm-success'}}),onLeaveConfirmed:()=>{result++},onStatusChange:(_ref,status)=>statuses.push(status)}))
    assert.equal(result,0)
    await find(tree,'form').props.onSubmit({preventDefault(){}})
    assert.equal(result,1)
    assert.deepEqual(statuses,['pending','success'])
  })
  await report('F16: dang cho thi mo lai van khoa submit', async () => {
    const waiting=deferred()
    let count=0
    const props=leaveProps(room('pending'),{leaveRoom:()=>{count++;return waiting.promise}})
    const tree=LeaveRoom(props)
    const pending=find(tree,'form').props.onSubmit({preventDefault(){}})
    const reopened=LeaveRoom(props)
    assert.equal(find(reopened,'button','Đang rời').props.disabled,true)
    assert.match(text(reopened), /Đóng hộp không hủy yêu cầu/)
    await find(reopened,'form').props.onSubmit({preventDefault(){}})
    assert.equal(count,1)
    waiting.resolve({status:'success',data:{roomName:'pending'}})
    await pending
    assert.equal(count,1)
  })
  await report('F16: 2 submit dong thoi khong gui trung', async () => {
    const waiting=deferred()
    let count=0
    const tree=LeaveRoom(leaveProps(room('double-submit'),{leaveRoom:()=>{count++;return waiting.promise}}))
    const action=find(tree,'form').props.onSubmit
    const a=action({preventDefault(){}})
    const b=action({preventDefault(){}})
    assert.equal(count,1)
    waiting.resolve({status:'success',data:{roomName:'double-submit'}})
    await Promise.all([a,b])
  })
  await report('F16: timeout unknown khong xoa nhap hay tu gui lai', async () => {
    let confirmed=0, count=0
    const props=leaveProps(room('unknown'),{hasDraft:true,onLeaveConfirmed:()=>{confirmed++},leaveRoom:async()=>{count++;return {status:'unknown',error:{kind:'timeout',message:'Khong ro ket qua'}}}})
    await find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    const reopened=LeaveRoom(props)
    assert.equal(find(reopened,'button','Xác nhận rời phòng').props.disabled,true)
    assert.match(text(reopened), /Khong ro ket qua/)
    assert.match(text(reopened), /bản nháp chưa gửi/)
    assert.equal(confirmed,0)
    assert.equal(count,1)
  })
  await report('F16: loi nghiep vu cho gui lai an toan', async () => {
    let count=0
    const props=leaveProps(room('biz-retry'),{leaveRoom:async()=>{count++;return count===1?{status:'error',error:{kind:'business',message:'Khong du quyen'}}:{status:'success',data:{roomName:'biz-retry'}}}})
    await find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    const retry=LeaveRoom(props)
    assert.match(text(retry), /Khong du quyen/)
    assert.equal(find(retry,'button','Xác nhận rời phòng').props.disabled,false)
    await find(retry,'form').props.onSubmit({preventDefault(){}})
    assert.equal(count,2)
  })
  await report('F16: request throw loi cung la unknown', async () => {
    const props=leaveProps(room('throw'),{leaveRoom:async()=>{throw new Error('Connection failed')}})
    await find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    const tree=LeaveRoom(props)
    assert.match(text(tree), /Mất kết nối/)
    assert.equal(find(tree,'button','Xác nhận rời phòng').props.disabled,true)
  })
  await report('F16: success sai ten phong khong khoa nham composer', async () => {
    let confirmed=0
    const props=leaveProps(room('wrong-name'),{leaveRoom:async()=>({status:'success',data:{roomName:'other'}}),onLeaveConfirmed:()=>{confirmed++}})
    await find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    assert.equal(confirmed,0)
    assert.match(text(LeaveRoom(props)), /Phản hồi không khớp tên phòng/)
  })
  await report('F16: pending -> dong -> success van gui callback confirm', async () => {
    const waiting=deferred()
    let confirmed=0, closed=0
    const props=leaveProps(room('closed-success'),{onClose:()=>{closed++}, onLeaveConfirmed:()=>{confirmed++},leaveRoom:()=>waiting.promise})
    const promise=find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    find(LeaveRoom(props),'button','Đóng').props.onClick()
    assert.equal(closed,1)
    waiting.resolve({status:'success',data:{roomName:'closed-success'}})
    await promise
    assert.equal(confirmed,1)
  })
  await report('F16: phan hoi cu sau logout khong cap nhat B', async () => {
    const waiting=deferred()
    let confirmed=0, count=0
    const sameRoom=room('same-room')
    const props=leaveProps(sameRoom,{onLeaveConfirmed:()=>{confirmed++},leaveRoom:()=>{count++;return count===1?waiting.promise:Promise.resolve({status:'success',data:{roomName:'same-room'}})}})
    const a=find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    sessionGeneration += 1
    const bTree=LeaveRoom(props)
    assert.equal(find(bTree,'button','Xác nhận rời phòng').props.disabled,false)
    waiting.resolve({status:'success',data:{roomName:'same-room'}})
    await a
    assert.equal(confirmed,0)
    await find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    assert.equal(count,2)
    assert.equal(confirmed,1)
  })
  await report('F16: mock member roi thanh cong va unknown khong gia thanh cong', async () => {
    let confirmed=0
    const successProps=leaveProps(room('mock-member'),{onLeaveConfirmed:()=>{confirmed++}})
    await find(LeaveRoom(successProps),'form').props.onSubmit({preventDefault(){}})
    const unknownProps=leaveProps(room('mock-unknown',{membership:'unknown',ownerKnown:false}),{onLeaveConfirmed:()=>{confirmed++}})
    await find(LeaveRoom(unknownProps),'form').props.onSubmit({preventDefault(){}})
    assert.equal(confirmed,1)
    assert.match(text(LeaveRoom(unknownProps)), /Fixture chưa xác nhận quyền/)
  })
  await report('F17: LeaveRoom khong suy owner tu currentUser khi ownerKnown false', () => {
    const tree=LeaveRoom(leaveProps(room('no-owner',{ownerKnown:false,membership:'unknown'})))
    assert.equal(find(tree,'button','Xác nhận rời phòng').props.disabled,false)
  })
  await report('CV41: khong export ham mock tu TSX va khong comment source', () => {
    for(const file of ['MemberList.tsx','LeaveRoom.tsx']) {
      const content=fs.readFileSync(path.join(base,file),'utf8')
      assert.equal((content.match(/export default function /g)||[]).length,1)
      assert.equal((content.match(/export (?:const|function|async function) /g)||[]).length,0)
      assert.doesNotMatch(content,/\/\/|\/\*/)
    }
  })
  assert.equal(passed, 29)
  console.log('29/29 checks CV41 goc passed')

  await report('F16: nut Huy truoc gui, sau khi pending la Dong', async () => {
    const pending = deferred()
    let closed = 0
    const props = leaveProps(room('close-label'), {
      onClose: () => { closed++ },
      leaveRoom: () => pending.promise,
    })
    const original = LeaveRoom(props)
    const cancel = nodes(find(original, 'form')).find(n => n.type === 'button' && n.props.type === 'button')
    assert.equal(text(cancel), 'Hủy')
    const inFlight = find(original, 'form').props.onSubmit({ preventDefault() {} })
    const reopened = LeaveRoom(props)
    const close = nodes(find(reopened, 'form')).find(n => n.type === 'button' && n.props.type === 'button')
    assert.equal(text(close), 'Đóng')
    close.props.onClick()
    assert.equal(closed, 1)
    assert.equal(leaveState.getLeaveRequest(sessionGeneration, 'close-label')?.status, 'pending')
    pending.resolve({status:'success', data:{roomName:'close-label'}})
    await inFlight
    assert.equal(leaveState.getLeaveRequest(sessionGeneration, 'close-label')?.status, 'success')
  })

  await report('F16: timeout unknown van hien nut Dong va khong mat nhap', async () => {
    const props = leaveProps(room('unknown-close-label'), {
      hasDraft: true,
      leaveRoom: async () => ({status:'unknown',error:{kind:'timeout',message:'Chua ro ket qua'}}),
    })
    await find(LeaveRoom(props), 'form').props.onSubmit({ preventDefault() {} })
    const reopened = LeaveRoom(props)
    const close = nodes(find(reopened, 'form')).find(n => n.type === 'button' && n.props.type === 'button')
    assert.equal(text(close), 'Đóng')
    assert.match(text(reopened), /bản nháp chưa gửi/)
  })

  await report('CV41: dong mo hop sau roi success khong tu mo khoa', async () => {
    let count = 0
    const props = leaveProps(room('reopen-old-success'), {
      leaveRoom: async () => { count++; return {status:'success',data:{roomName:'reopen-old-success'}} },
    })
    await find(LeaveRoom(props), 'form').props.onSubmit({preventDefault(){}})
    const reopen = LeaveRoom(props)
    assert.equal(find(reopen, 'button', 'Xác nhận rời phòng').props.disabled, true)
    await find(reopen,'form').props.onSubmit({preventDefault(){}})
    assert.equal(count, 1)
  })

  await report('CV41: JOIN thanh cong -> LEAVE -> JOIN lai -> LEAVE lan nua', async () => {
    const name = 'cycle-join-leave'
    let currentRoom = room(name)
    const props = leaveProps(currentRoom)
    let joined = 0
    let left = 0
    const joinProps = {
      onClose: () => {},
      onJoined: joinedRoom => { joined++; currentRoom = joinedRoom },
      initialName: name,
      joinRoom: async () => ({status:'success',data:room(name)}),
    }
    props.onLeaveConfirmed = () => { left++; currentRoom = {...currentRoom, membership:'left'} }
    await find(JoinRoom(joinProps), 'form').props.onSubmit({preventDefault(){}})
    assert.equal(joined, 1)
    assert.equal(roomState.getRoomRequest('join',name,sessionGeneration)?.status, 'success')
    await find(LeaveRoom(props), 'form').props.onSubmit({preventDefault(){}})
    assert.equal(left, 1)
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,name)?.status, 'success')
    assert.equal(roomState.getRoomRequest('join',name,sessionGeneration), null)
    assert.equal(find(LeaveRoom({...props, room:currentRoom}), 'button', 'Xác nhận rời phòng').props.disabled, true)
    assert.equal(find(JoinRoom(joinProps), 'button', 'Tham gia phòng').props.disabled, false)
    await find(JoinRoom(joinProps), 'form').props.onSubmit({preventDefault(){}})
    assert.equal(joined, 2)
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,name), null)
    assert.equal(currentRoom.membership, 'member')
    assert.equal(find(LeaveRoom({...props, room:currentRoom}), 'button', 'Xác nhận rời phòng').props.disabled, false)
    await find(LeaveRoom({...props, room:currentRoom}), 'form').props.onSubmit({preventDefault(){}})
    assert.equal(left, 2)
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,name)?.status,'success')
  })

  await report('CV41: JOIN that bai khong xoa success roi phong cu', async () => {
    const name='join-failed-keep-leave'
    const props=leaveProps(room(name))
    await find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    const joinProps={initialName:name,onClose:()=>{},joinRoom:async()=>({status:'error',error:{kind:'business',message:'Khong tham gia duoc'}})}
    await find(JoinRoom(joinProps),'form').props.onSubmit({preventDefault(){}})
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,name)?.status,'success')
    assert.equal(find(LeaveRoom(props),'button','Xác nhận rời phòng').props.disabled,true)
  })

  await report('CV41: JOIN timeout khong xoa success roi phong cu', async () => {
    const name='join-unknown-keep-leave'
    const props=leaveProps(room(name))
    await find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    const joinProps={initialName:name,onClose:()=>{},joinRoom:async()=>({status:'unknown',error:{kind:'timeout',message:'Chua ro join'}})}
    await find(JoinRoom(joinProps),'form').props.onSubmit({preventDefault(){}})
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,name)?.status,'success')
  })

  await report('CV41: JOIN tra success sai ten khong mo khoa LEAVE cu', async () => {
    const name='join-wrong-name'
    const props=leaveProps(room(name))
    await find(LeaveRoom(props),'form').props.onSubmit({preventDefault(){}})
    const joinProps={initialName:name,onClose:()=>{},joinRoom:async()=>({status:'success',data:room('another-room')})}
    await find(JoinRoom(joinProps),'form').props.onSubmit({preventDefault(){}})
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,name)?.status,'success')
  })

  await report('CV41: reset phong A khong lam doi trang thai phong B', async () => {
    const a='independent-room-a', b='independent-room-b'
    const propsA=leaveProps(room(a)),propsB=leaveProps(room(b))
    await find(LeaveRoom(propsA),'form').props.onSubmit({preventDefault(){}})
    await find(LeaveRoom(propsB),'form').props.onSubmit({preventDefault(){}})
    await find(JoinRoom({initialName:a,onClose:()=>{},joinRoom:async()=>({status:'success',data:room(a)})}),'form').props.onSubmit({preventDefault(){}})
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,a),null)
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,b)?.status,'success')
  })

  await report('CV41: phan hoi JOIN phien cu khong mo khoa phien moi', async () => {
    const name='stale-join-leave'
    const propsA=leaveProps(room(name))
    await find(LeaveRoom(propsA),'form').props.onSubmit({preventDefault(){}})
    const currentA=sessionGeneration
    const delay=deferred()
    const joinA=find(JoinRoom({initialName:name,onClose:()=>{},joinRoom:()=>delay.promise}),'form').props.onSubmit({preventDefault(){}})
    sessionGeneration += 1
    const propsB=leaveProps(room(name))
    await find(LeaveRoom(propsB),'form').props.onSubmit({preventDefault(){}})
    delay.resolve({status:'success',data:room(name)})
    await joinA
    assert.equal(leaveState.getLeaveRequest(sessionGeneration,name)?.status,'success')
    assert.equal(leaveState.getLeaveRequest(currentA,name)?.status,'success')
  })

  console.log(`${passed-29}/${passed-29} checks bo sung passed`)
  const conclusion=`${passed}/${passed} checks passed`
  console.log(conclusion)
  console.log(`Node.js ${process.version}`)
}
main().catch(error=>{console.error('FAILED',error); process.exitCode=1})
