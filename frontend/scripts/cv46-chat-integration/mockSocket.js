(()=>{
 const NativeWebSocket = window.WebSocket;
 const trace=[];const stats={requests:{},responses:{},joinPending:false,sendAttempts:0};
 const emit=(kind,event,payload,extra={})=>{const entry={seq:trace.length+1,t:Date.now(),direction:kind,event,payload,...extra};trace.push(entry);console.info('[CV46_TRACE] '+JSON.stringify(entry));};
 window.__cv46={trace,stats};
 class MockSocket extends EventTarget {
  static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
  CONNECTING=0;OPEN=1;CLOSING=2;CLOSED=3;
  readyState=0;
  constructor(url, protocols){super();if(!String(url).includes('chat.longapp.io.vn'))return new NativeWebSocket(url,protocols);this.url=url;setTimeout(()=>{this.readyState=1;this.onopen?.(new Event('open'));this.dispatchEvent(new Event('open'))},15)}
  send(body){
   let obj=JSON.parse(body),event=obj.data?.event,data=obj.data?.data||{};
   if(!event)throw Error('Bad socket request');
   stats.requests[event]=(stats.requests[event]||0)+1;
   if(event==='SEND_CHAT'){stats.sendAttempts++;emit('client_request',event,data);return}
   emit('client_request',event,data,{count:stats.requests[event]});
   let response;
   switch(event){
    case 'RE_LOGIN':response={event,status:'success',data:{RE_LOGIN_CODE:'fresh_123'}};break;
    case 'GET_USER_LIST':response={event,status:'success',data:[{name:'TestKhoi46',type:1,actionTime:'2026-11-23 15:45:00'}]};break;
    case 'GET_ROOM_CHAT_MES':response={event,status:'success',data:{id:506,name:'TestKhoi46',own:'Owner46',userList:[{name:'Owner46'},{name:'Khoi'}],chatData:[],page:1}};break;
    case 'JOIN_ROOM':response={event,status:'success',data:{id:506,name:data.name,own:'Owner46',userList:[{name:'Owner46'},{name:'Khoi'}]}};break;
    case 'OUT_ROOM':response={event,status:'error',data:{mes:'CV46_SIMULATED_BUSINESS_ERROR - blocked by test socket'}};break;
    default:response={event,status:'success',data:{}};break;
   }
   if(event==='JOIN_ROOM'){stats.joinPending=true; if(stats.requests.JOIN_ROOM===2)setTimeout(()=>{const dialog=document.querySelector('[role=dialog][aria-labelledby=cv40-join-title]');const button=dialog?.querySelector('button[type=submit]');stats.pendingSnapshot={dialogVisible:!!dialog,buttonDisabled:button?.disabled===true,requestsBeforeAttempt:stats.requests.JOIN_ROOM};button?.click();stats.pendingSnapshot.requestsAfterAttempt=stats.requests.JOIN_ROOM;},150);}
   const delay=event==='JOIN_ROOM'?(stats.requests.JOIN_ROOM===1?650:4500): event==='OUT_ROOM'?180:40;
   setTimeout(()=>{
    if(this.readyState!==1)return;
    if(event==='JOIN_ROOM')stats.joinPending=false;
    stats.responses[event]=(stats.responses[event]||0)+1;
    emit('mock_server_response',event,response,{count:stats.responses[event]});
    this.onmessage?.({data:JSON.stringify(response)});
   },delay);
  }
  close(){this.readyState=3;setTimeout(()=>{this.onclose?.(new Event('close'));this.dispatchEvent(new Event('close'))},2)}
 }
 window.WebSocket=MockSocket;
 const saved = new Map();
 const fakeStorage={getItem:key=>saved.has(key)?saved.get(key):null,setItem:(key,val)=>saved.set(key,String(val)),removeItem:key=>saved.delete(key),clear:()=>saved.clear()};
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:fakeStorage});
 window.sessionStorage.setItem('appchat.session',JSON.stringify({username:'Khoi',reLoginCode:'fake_login_code'}));
 window.__cv46MockLabel='MOCKED SOCKET; REAL APP /chat + actual Redux';
})();
