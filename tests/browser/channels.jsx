import React, { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasChatPanel from '../../src/components/canvas/CanvasChatPanel.jsx';
import CanvasVoiceCall from '../../src/canvas/voice/CanvasVoiceCall.js';
import {
  listCategories,
  listChannels,
  moveChannelPatch,
  newCategory,
  newCategoryId,
  newChannel,
  newChannelId,
  nextChannelOrder,
  reorderCategoryPatch,
} from '../../src/canvas/channels/channelModel.js';

const sent = [];
window.channelFixture = { sent, unread: {} };
const call = new CanvasVoiceCall({
  send: e => { sent.push(e); return true; },
  media: {
    getUserMedia: async () => {
      const t = { enabled: true, stop() {} };
      return { getTracks: () => [t], getAudioTracks: () => [t] };
    },
  },
  Peer: class {
    constructor() { this.connectionState = 'new'; this.iceConnectionState = 'new'; this.signalingState = 'stable'; }
    addTrack() {}
    close() {}
    restartIce() {}
    setLocalDescription() { return Promise.resolve(); }
  },
  audio: () => ({ pause() {}, play: async () => {} }),
  AudioContext: null,
});
call.handle({
  type: 'rtc_peers',
  self_peer_id: 'me',
  peers: [{ peer_id: 'p1', nickname: 'Kim', tag_number: 1, voice_active: true, voice_channel: 'general' }],
});

function App() {
  const [items, setItems] = useState({});
  const [active, setActive] = useState('general');
  const [tab, setTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const state = useSyncExternalStore(call.subscribe, call.getSnapshot);
  const voice = { call, state };

  const categories = listCategories(items);
  const text = listChannels(items, 'text', '일반');
  const vc = listChannels(items, 'voice', '일반 통화');

  const channels = {
    text,
    voice: vc,
    categories,
    activeText: active,
    unread: { general: 0, ...window.channelFixture.unread },
    canManage: true,
    selectText: setActive,
    create: (type, name, categoryId = null) => {
      const id = newChannelId();
      setItems(c => ({ ...c, [id]: newChannel(type, name, ['all'], nextChannelOrder(type === 'text' ? text : vc), categoryId) }));
      if (type === 'text') setActive(id);
      return true;
    },
    rename: (id, name) => {
      setItems(c => ({ ...c, [id]: { ...c[id], name } }));
      return true;
    },
    remove: id => setItems(c => {
      const n = { ...c };
      delete n[id];
      return n;
    }),
    createCategory: name => {
      const id = newCategoryId();
      setItems(c => ({ ...c, [id]: newCategory(name, ['all'], nextChannelOrder(categories)) }));
      return true;
    },
    renameCategory: (id, name) => {
      setItems(c => ({ ...c, [id]: { ...c[id], name } }));
      return true;
    },
    removeCategory: id => setItems(c => {
      const n = { ...c };
      delete n[id];
      for (const [k, v] of Object.entries(n)) {
        if (v?.categoryId === id) {
          const next = { ...v };
          delete next.categoryId;
          n[k] = next;
        }
      }
      return n;
    }),
    moveChannel: (id, categoryId = null, targetId = null) => {
      setItems(c => {
        const patches = moveChannelPatch(c, id, categoryId, targetId);
        return patches ? { ...c, ...patches } : c;
      });
      return true;
    },
    reorderCategory: (id, targetId) => {
      setItems(c => {
        const patches = reorderCategoryPatch(c, id, targetId);
        return patches ? { ...c, ...patches } : c;
      });
      return true;
    },
  };

  window.channelFixture.active = active;
  window.channelFixture.items = items;
  window.channelFixture.messages = messages;

  return (
    <CanvasChatPanel
      voice={voice}
      tab={tab}
      onTabChange={setTab}
      connection="connected"
      messages={messages}
      message={message}
      setMessage={setMessage}
      submitMessage={(event, textOverride) => {
        event?.preventDefault();
        const body = (typeof textOverride === 'string' ? textOverride : message).trim();
        if (!body) return false;
        setMessages(curr => [...curr, { id: `m-${curr.length + 1}`, sender: 'Me#1', own: true, text: body, time: new Date() }]);
        setMessage('');
        return true;
      }}
      onUploadChatMedia={async file => ({ url: `https://example.invalid/${encodeURIComponent(file.name)}` })}
      participants={[]}
      loadOlderMessages={() => {}}
      channels={channels}
    />
  );
}

createRoot(document.getElementById('root')).render(<App />);
