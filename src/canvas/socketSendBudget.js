// Keep reliable sends retryable; ephemeral traffic yields to queued host data.
export class SocketSendBudget {
  constructor(){this.socket=null;this.sent=[];}
  send(socket,payload,now=performance.now()){
    if(!socket || socket.readyState!==1)return false;
    const ephemeral=['cursor','laser','editor_presence'].includes(payload?.payload?.type);
    if(socket.bufferedAmount>(ephemeral?64*1024:256*1024))return false;
    if(this.socket!==socket){this.socket=socket;this.sent=[];}
    this.sent=this.sent.filter(time=>now-time<1000);
    if(this.sent.length>=(ephemeral?140:180))return false;
    try{socket.send(JSON.stringify(payload));this.sent.push(now);return true;}catch{return false;}
  }
}
