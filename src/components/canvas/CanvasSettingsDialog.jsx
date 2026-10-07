import CanvasBackgroundControls from '../../canvas/background/CanvasBackgroundControls.jsx';
import { Link } from '../../routing.jsx';
import './canvas-delete.css';
import CanvasCoverEditor from './CanvasCoverEditor.jsx';
import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';
import CanvasManagementDialog from './CanvasManagementDialog.jsx';

export default function SettingsDialog({ settings, pending, onClose, onUpdate, canvasId, image, token, onImageSaved, backgroundColor, setBackgroundColor, favoriteColors, saveFavoriteColor, theme }) {
  const [name, setName] = useState(settings?.canvas_name || '');
  const [description, setDescription] = useState(settings?.description || '');
  const [password, setPassword] = useState('');
  useEffect(() => { setName(settings?.canvas_name || ''); setDescription(settings?.description || ''); }, [settings]);
  return <CanvasManagementDialog titleId="settings-title" onClose={onClose}><button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><Icon name="close" /></button><span className="section-kicker">CANVAS SETTINGS</span><h2 id="settings-title">캔버스 설정</h2><p>변경 사항은 접속 중인 멤버에게 바로 전달돼요.</p>
    <div className="settings-dialog-content"><CanvasBackgroundControls {...{ backgroundColor, setBackgroundColor, favoriteColors, saveFavoriteColor, theme }} /><CanvasCoverEditor canvasId={canvasId} image={image} token={token} onSaved={onImageSaved} /><label className="form-field"><span>캔버스 이름</span><div className="setting-row"><input className="plain-input" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} /><button className="button button-outline" disabled={pending || name === settings?.canvas_name} onClick={() => onUpdate('name', name)}>저장</button></div></label><label className="form-field"><span>설명</span><div className="setting-row"><textarea className="plain-input" rows="2" value={description} onChange={(e) => setDescription(e.target.value)} /><button className="button button-outline" disabled={pending || description === (settings?.description || '')} onClick={() => onUpdate('description', description)}>저장</button></div></label><label className="form-field"><span>비밀번호 <small>{settings?.password_protected ? '현재 보호 중' : '현재 비밀번호 없음'}</small></span><div className="setting-row"><input className="plain-input" type="password" placeholder="새 비밀번호 입력" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="button button-outline" disabled={pending || !password} onClick={() => { onUpdate('password', password); setPassword(''); }}>적용</button></div></label>
      <section className="canvas-delete-settings"><strong>캔버스 삭제</strong><p>접속을 종료한 뒤 캔버스 목록의 삭제 버튼에서 진행할 수 있습니다.</p><Link to="/search">캔버스 목록에서 삭제 관리</Link></section>
    </div>{pending && <div className="settings-pending"><span className="loader" /> 변경 내용을 확인하고 있어요.</div>}<div className="settings-dialog-footer"><span>revision {settings?.settings_revision ?? '—'}</span><button className="button button-dark" onClick={onClose}>완료</button></div>
  </CanvasManagementDialog>;
}

