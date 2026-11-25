(()=>{
 const trace=[];const stats={requests:{},responses:{},joinPending:false,sendAttempts:0};
 const emit=(kind,event,payload,extra={})=>{const entry={seq:trace.length+1,t:Date.now(),direction:kind,event,payload,...extra};trace.push(entry);console.info('[CV49_TRACE] '+JSON.stringify(entry));};
 window.__cv49={trace,stats};
 class MockSocket extends EventTarget {
  static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
  CONNECTING=0;OPEN=1;CLOSING=2;CLOSED=3;
  readyState=0;
  constructor(url, protocols){super();if(!String(url).includes('chat.longapp.io.vn'))throw new Error('Unexpected WebSocket URL in isolated test');this.url=url;setTimeout(()=>{this.readyState=1;this.onopen?.(new Event('open'));this.dispatchEvent(new Event('open'))},15)}
  send(body){
   let obj=JSON.parse(body),event=obj.data?.event,data=obj.data?.data||{};
   if(!event)throw Error('Bad socket request');
   stats.requests[event]=(stats.requests[event]||0)+1;
   if(event==='SEND_CHAT'){stats.sendAttempts++;emit('client_request',event,data);return}
   emit('client_request',event,data,{count:stats.requests[event]});
   let response;
   switch(event){
    case 'RE_LOGIN':response={event,status:'success',data:{RE_LOGIN_CODE:'fresh_123'}};break;
    case 'GET_USER_LIST':response={event,status:'success',data:[{name:'CV49TimeoutRoom',type:1,actionTime:'2026-11-23 15:45:00'}]};break;
    case 'GET_ROOM_CHAT_MES':response={event,status:'success',data:{id:506,name:'CV49TimeoutRoom',own:'Owner49',userList:[{name:'Owner49'},{name:'Khoi'}],chatData:[],page:1}};break;
    case 'JOIN_ROOM':response={event,status:'success',data:{id:506,name:data.name,own:'Owner49',userList:[{name:'Owner49'},{name:'Khoi'}]}};break;
    case 'OUT_ROOM':emit('mock_drop_response',event,{reason:'intentional silence; real client timeout'});return;
    default:response={event,status:'success',data:{}};break;
   }
   const delay=event==='JOIN_ROOM'?150:40;
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
 window.__cv49MockLabel='CV49 MOCK SOCKET; REAL APP /chat + actual Redux';
})();
