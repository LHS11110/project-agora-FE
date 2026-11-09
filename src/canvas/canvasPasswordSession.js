import {readCanvasPasswordGrant,saveCanvasPasswordGrant} from './canvasAccess.js';
const active=new Map();
const FIVE_MINUTES=5*60*1000;
// Broker credentials reconnect every five minutes; renew before that boundary.
const RENEW_INTERVAL=2*60*1000;
export async function ensureCanvasPasswordGrant(key){
 const session=active.get(key),cached=readCanvasPasswordGrant(key);
 if(!session)return cached;
 if(cached){try{const payload=JSON.parse(atob(cached.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.exp*1000-Date.now()>FIVE_MINUTES)return cached;}catch{}}
 return session.renew();
}
export function startCanvasPasswordSession({key,grant,request,proof,connected,timers=globalThis,document=globalThis.document}){
 active.get(key)?.dispose();
 let alive=true,pending=null;
 const session={
  renew(){
   if(!alive||!connected())return Promise.resolve(readCanvasPasswordGrant(key));
   const connection=proof();if(!connection.connectionId||!connection.proof)return Promise.resolve(readCanvasPasswordGrant(key));
   if(pending)return pending;
   pending=(async()=>{try{const result=await request({...connection,passwordGrant:grant});if(!alive)return null;grant=result.canvas_password_token||null;saveCanvasPasswordGrant(key,grant);if(!grant)session.dispose();return grant;}catch(error){if(alive&&['CANVAS_004','CANVAS_005','ACCESS_DENIED'].includes(error.code))saveCanvasPasswordGrant(key,null);throw error;}finally{pending=null;}})();return pending;
  },
  dispose(){alive=false;timers.clearInterval(timer);document?.removeEventListener('visibilitychange',resume);if(active.get(key)===session)active.delete(key);},
 };
 const refresh=()=>session.renew().catch(()=>{}),resume=()=>{if(document?.visibilityState==='visible')refresh();};
 const timer=timers.setInterval(refresh,RENEW_INTERVAL);
 document?.addEventListener('visibilitychange',resume);active.set(key,session);
 return session;
}
