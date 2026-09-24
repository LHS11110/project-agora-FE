import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../state/AuthContext.jsx';

export default function LoginPage() {
  const { isAuthenticated, login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  if (isAuthenticated) return <Navigate to="/search" replace />;
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'signup') await signup(form);
      else await login(form.email, form.password);
      navigate(location.state?.from || '/search', { replace: true });
    } catch (err) { setError(err.message || '로그인할 수 없습니다. 입력 정보를 확인해주세요.'); }
    finally { setBusy(false); }
  };

  return <div className="auth-page">
    <div className="auth-visual-panel">
      <Link className="brand-lockup auth-brand" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link>
      <div className="auth-quote"><span className="section-kicker">MAKE ROOM FOR IDEAS</span><h1>같이 그리면<br /><em>더 멀리</em> 보여요.</h1><p>작은 낙서 하나가<br />모두의 다음 아이디어가 되는 곳.</p></div>
      <div className="auth-art" aria-hidden="true"><div className="auth-art-paper"><span className="auth-art-bubble">let it<br />grow<span>✳</span></span><svg viewBox="0 0 260 150"><path d="M10 118 C 48 102, 48 28, 100 48 S 154 147, 204 72 S 234 26, 253 30" fill="none" stroke="#e18462" strokeWidth="4" strokeLinecap="round"/><path d="M38 62 C 70 22, 116 122, 157 56" fill="none" stroke="#69877b" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 8"/></svg></div><span className="auth-art-spark">✦</span><span className="auth-art-orbit" /></div>
      <div className="auth-panel-foot"><span>IDEAS IN GOOD COMPANY</span><span>© Agora Project</span></div>
    </div>
    <main className="auth-form-panel">
      <div className="auth-mobile-brand"><Link className="brand-lockup" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link></div>
      <div className="auth-form-wrap"><div className="auth-heading"><span className="section-kicker">WELCOME TO AGORA</span><h2>{mode === 'login' ? '다시 만났네요.' : '함께 시작해요.'}</h2><p>{mode === 'login' ? '로그인하고 이어서 아이디어를 나눠보세요.' : '계정을 만들고 팀의 첫 캔버스를 열어보세요.'}</p></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <label className="form-field"><span>닉네임</span><div className="input-wrap"><Icon name="user" size={18} /><input name="nickname" value={form.nickname} onChange={change} placeholder="어떻게 불러드릴까요?" autoComplete="nickname" maxLength={100} required /></div></label>}
          <label className="form-field"><span>이메일</span><div className="input-wrap"><Icon name="mail" size={18} /><input type="email" name="email" value={form.email} onChange={change} placeholder="you@example.com" autoComplete="email" required /></div></label>
          <label className="form-field"><span>비밀번호</span><div className="input-wrap"><Icon name="lock" size={18} /><input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={change} placeholder="비밀번호를 입력해주세요" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 6 : undefined} required /><button type="button" className="input-trailing" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} /></button></div></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-dark button-submit" type="submit" disabled={busy}>{busy ? '잠시만요…' : mode === 'login' ? '로그인' : '계정 만들기'} <Icon name="arrow" size={17} /></button>
        </form>
        <div className="auth-switch">{mode === 'login' ? '아직 계정이 없으신가요?' : '이미 아고라 계정이 있나요?'} <button onClick={() => { setError(''); setMode(mode === 'login' ? 'signup' : 'login'); }}>{mode === 'login' ? '회원가입' : '로그인'}</button></div>
        <div className="auth-terms">계속 진행하면 아고라의 이용약관과 개인정보 처리방침에 동의하게 됩니다.</div>
      </div>
      <Link className="auth-back-home" to="/"><Icon name="back" size={16} /> 홈으로 돌아가기</Link>
    </main>
  </div>;
}
