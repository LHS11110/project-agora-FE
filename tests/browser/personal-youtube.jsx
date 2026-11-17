import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SharedMediaContent from '../../src/components/SharedMediaContent.jsx';

function App() {
  const [remote, setRemote] = useState({ paused: false, time: 60, updatedAt: Date.now(), actor: 'remote' });
  const [activeKey, setActiveKey] = useState(null);
  window.personalFixture = {
    writes: window.personalFixture?.writes || 0,
    remote: () => setRemote({ paused: false, time: 120, updatedAt: Date.now(), actor: 'remote2' }),
  };
  return (
    <main>
      {['one', 'two'].map((key) => (
        <section
          key={key}
          data-player={key}
          style={{ position: 'relative', width: 500, height: 350 }}
          onClick={() => setActiveKey(key)}
        >
          <SharedMediaContent
            item={{
              kind: 'link',
              mediaType: 'youtube',
              url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
              mediaState: remote,
              mediaLoop: true,
            }}
            interactive={activeKey === key}
            writable={false}
            onChange={() => window.personalFixture.writes++}
          />
        </section>
      ))}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
