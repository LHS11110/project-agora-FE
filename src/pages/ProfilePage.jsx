import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../state/AuthContext.jsx';

export default function ProfilePage() {
  const { token, user, updateUser } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    const changes = {};
    if (nickname.trim() && nickname.trim() !== user?.nickname) changes.nickname = nickname.trim();
    if (password) changes.password = password;
    if (!Object.keys(changes).length) { setNotice({ kind: 'info', text: '변경된 내용이 없습니다.' }); setBusy(false); return; }
    try {
      const updated = await api(`/api/users/${encodeURIComponent(user.nickname)}/${user.tag_number}`, { method: 'PATCH', token, body: changes });
      updateUser(updated); setNickname(updated.nickname || nickname); setPassword('');
      setNotice({ kind: 'success', text: '프로필이 업데이트되었습니다.' });
    } catch (error) { setNotice({ kind: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  return <main className="content-page profile-page">
    <div className="page-topline"><span className="section-kicker">YOUR ACCOUNT</span><span className="breadcrumbs">워크스페이스 <b>/</b> 프로필</span></div>
    <div className="page-title-row"><div><h1>내 프로필</h1><p>아고라에서 사용할 계정 정보를 관리해요.</p></div><span className="profile-status"><i /> 계정 활성</span></div>
    <div className="profile-layout">
      <section className="profile-card profile-identity-card"><div className="profile-card-cover"><div className="cover-orbit orbit-a" /><div className="cover-orbit orbit-b" /><span className="cover-spark">✳</span></div><div className="identity-body"><div className="avatar avatar-xl">{(user?.nickname || 'A').slice(0, 1)}</div><span className="profile-role">{user?.role === 'ROLE_ADMIN' ? 'WORKSPACE ADMIN' : 'AGORA MEMBER'}</span><h2>{user?.nickname || 'Agora 사용자'}</h2><span className="user-tag">#{user?.tag_number ?? '—'}</span><p>생각을 모으고, 함께 만드는 아고라 멤버</p><div className="identity-divider" /><div className="identity-detail"><span>가입한 이메일</span><strong>{user?.email || '—'}</strong></div><div className="identity-detail"><span>계정 상태</span><strong className="green-value">{user?.status || 'ACTIVE'}</strong></div><div className="identity-detail"><span>가입일</span><strong>{user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : 'Agora와 함께하는 중'}</strong></div></div></section>
      <section className="profile-card profile-edit-card"><div className="card-heading"><span className="settings-badge"><Icon name="settings" size={18} /></span><div><h2>기본 정보</h2><p>다른 멤버에게 보여지는 정보를 수정할 수 있어요.</p></div></div><form className="profile-form" onSubmit={save}>
        <label className="form-field"><span>이메일 주소 <small>변경할 수 없음</small></span><div className="input-wrap disabled-input"><Icon name="mail" size={18} /><input value={user?.email || ''} readOnly /></div></label>
        <label className="form-field"><span>닉네임</span><div className="input-wrap"><Icon name="user" size={18} /><input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={100} required /></div><small className="field-hint">최대 100자 · 태그 번호는 계정 식별을 위해 고정되어 있어요.</small></label>
        <label className="form-field"><span>새 비밀번호 <small>변경할 때만 입력</small></span><div className="input-wrap"><Icon name="lock" size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={4} placeholder="새 비밀번호를 입력해주세요" /></div><small className="field-hint">비밀번호를 바꾸지 않으려면 비워두세요.</small></label>
        {notice && <div className={`inline-notice ${notice.kind}`} role="status">{notice.text}</div>}<div className="form-actions"><button className="button button-dark" type="submit" disabled={busy}>{busy ? '저장 중…' : '변경사항 저장'} <Icon name="check" size={17} /></button></div>
      </form></section>
    </div>
    <div className="profile-security-note"><span className="security-icon"><Icon name="lock" size={17} /></span><p><strong>계정은 안전하게 보호돼요.</strong><br />비밀번호는 암호화되어 저장되며, 사용자 태그는 공개 식별자로 사용됩니다.</p><Icon name="chevron" size={18} /></div>
  </main>;
}
