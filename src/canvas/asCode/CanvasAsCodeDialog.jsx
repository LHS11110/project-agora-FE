import { useEffect, useRef, useState } from 'react';
import CanvasCodeEditor from '../CanvasCodeEditor.jsx';
import { exampleManifest } from './manifest.js';
import './canvas-as-code.css';
const stringify = value => JSON.stringify(value, null, 2);
const noop = () => {};
export default function CanvasAsCodeDialog({ api, canvasId, onClose }) {
  const [source, setSource] = useState(() => stringify(api.read()));
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const closeRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => { alive.current = false; previous?.focus?.(); };
  }, []);
  const change = value => { setSource(value); setPreview(null); setError(''); setMessage(''); };
  const review = () => {
    try { setPreview(api.plan(source)); setError(''); setMessage(''); }
    catch (failure) { setPreview(null); setError(failure.message); }
  };
  const apply = () => {
    try {
      const result = api.apply(preview);
      setPreview(null);
      setMessage(`생성 ${result.created} · 수정 ${result.updated} · 삭제 ${result.deleted}. 저장 요청을 대기열에 넣었습니다.`);
    } catch (failure) { setPreview(null); setError(failure.message); }
  };
  const download = () => {
    try {
      JSON.parse(source);
      const url = URL.createObjectURL(new Blob([source], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `frelog-canvas-${canvasId}.json`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('JSON 문법을 수정한 뒤 다운로드해주세요.'); }
  };
  const importFile = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError('8MB 이하의 JSON 파일을 선택해주세요.'); return; }
    try { const text = await file.text(); if (alive.current) change(text); }
    catch { if (alive.current) setError('파일을 읽지 못했습니다.'); }
  };
  return <div className="canvas-as-code-overlay" onPointerDown={event => event.stopPropagation()} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not([type="file"]), textarea, [tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}><section className="canvas-as-code-dialog" role="dialog" aria-modal="true" aria-labelledby="canvas-as-code-title">
    <header><div><small>FRELOG · CANVAS AS CODE</small><h2 id="canvas-as-code-title">캔버스를 코드로 관리</h2></div><button ref={closeRef} onClick={onClose} aria-label="캔버스 코드 닫기">닫기</button></header>
    <p>크기 제한 없는 캔버스의 픽셀 좌표로 작성합니다. 음수 좌표도 사용할 수 있습니다. 같은 ID는 수정하고 새 ID는 생성합니다.</p>
    <nav aria-label="캔버스 코드 파일"><button onClick={() => change(stringify(api.read()))}>현재 캔버스 불러오기</button><button onClick={() => change(stringify(exampleManifest))}>예제</button><button onClick={() => fileRef.current?.click()}>JSON 가져오기</button><button onClick={download}>JSON 다운로드</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} /></nav>
    <div className="canvas-as-code-editor"><CanvasCodeEditor language="json" value={source} onChange={change} onSave={review} onStopEditing={noop} /></div>
    <div className="canvas-as-code-results" aria-live="polite">
      {error && <p role="alert" className="canvas-as-code-error">{error}</p>}
      {message && <p>{message}</p>}
      {preview && <><strong>생성 {preview.creates.length} · 수정 {preview.updates.length} · 삭제 {preview.deletes.length}</strong>{preview.mode === 'replace' && <p>replace 모드: 코드에 없는 기존 객체를 삭제합니다.</p>}<ul>{preview.creates.map(({ id }) => <li key={`create-${id}`}>+ 생성 {id}</li>)}{preview.updates.map(({ id }) => <li key={`update-${id}`}>~ 수정 {id}</li>)}{preview.deletes.map(id => <li key={`delete-${id}`}>− 삭제 {id}</li>)}</ul></>}
    </div>
    <footer><small>merge는 생략한 객체를 유지합니다. remove로 삭제하거나 replace로 전체 상태를 지정하세요.</small><button onClick={review}>변경 검토 · Ctrl/⌘+S</button><button className="canvas-as-code-apply" disabled={!preview || !(preview.creates.length + preview.updates.length + preview.deletes.length)} onClick={apply}>검토한 변경 적용</button></footer>
  </section></div>;
}
