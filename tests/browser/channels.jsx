import React,{useState,useSyncExternalStore} from 'react';import {createRoot} from 'react-dom/client';
import CanvasChatPanel from '../../src/components/canvas/CanvasChatPanel.jsx';
import CanvasVoiceCall from '../../src/canvas/voice/CanvasVoiceCall.js';
import {listChannels,newChannel,newChannelId,nextChannelOrder} from '../../src/canvas/channels/channelModel.js';
const sent=[];window.channelFixture={sent};
const call=new CanvasVoiceCall({send:e=>{sent.push(e);return true;},media:{getUserMedia:async()=>{const t={enabled:true,stop(){}};return {getTracks:()=>[t],getAudioTracks:()=>[t]};}},Peer:class{constructor(){this.connectionState='new';this.iceConnectionState='new';this.signalingState='stable';}addTrack(){}close(){}restartIce(){}setLocalDescription(){return Promise.resolve();}},audio:()=>({pause(){},play:async()=>{}}),AudioContext:null});
call.handle({type:'rtc_peers',self_peer_id:'me',peers:[{peer_id:'p1',nickname:'Kim',tag_number:1,voice_active:true,voice_channel:'general'}]});
function App(){
 const [items,setItems]=useState({});const [active,setActive]=useState('general');const [tab,setTab]=useState('chat');
 const state=useSyncExternalStore(call.subscribe,call.getSnapshot);const voice={call,state};
 const text=listChannels(items,'text','일반'),vc=listChannels(items,'voice','일반 통화');
 const channels={text,voice:vc,activeText:active,unread:{general:0,...window.channelFixture.unread},canManage:true,selectText:setActive,
  create:(type,name)=>{const id=newChannelId();setItems(c=>({...c,[id]:newChannel(type,name,['all'],nextChannelOrder(type==='text'?text:vc))}));if(type==='text')setActive(id);return true;},
  rename:(id,name)=>{setItems(c=>({...c,[id]:{...c[id],name}}));return true;},remove:id=>setItems(c=>{const n={...c};delete n[id];return n;})};
 window.channelFixture.active=active;window.channelFixture.items=items;
 return <CanvasChatPanel voice={voice} tab={tab} onTabChange={setTab} connection="connected" messages={[]} message="" setMessage={()=>{}} submitMessage={()=>{}} participants={[]} loadOlderMessages={()=>{}} channels={channels}/>;
}
window.channelFixture.unread={};
createRoot(document.getElementById('root')).render(<App/>);
