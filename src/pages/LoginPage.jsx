import LanguageSwitcher from '../i18n/LanguageSwitcher.jsx';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import FreLogBrand from '../components/frelog/FreLogBrand.jsx';
import WorkspacePreview from '../components/home/WorkspacePreview.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import '../frelog-auth.css';

export default function LoginPage() {
  useUiLocale();
  const { isAuthenticated, authError, login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  if (isAuthenticated) return <Navigate to={location.state?.from || '/search'} replace />;
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
    <header className="auth-page-header"><FreLogBrand /><div><LanguageSwitcher /><Link className="auth-back-home" to="/"><Icon name="back" size={14} />{ui('홈으로 돌아가기')}</Link></div></header>
    <main className="auth-layout">
      <section className="auth-visual-panel" aria-labelledby="auth-visual-title">
        <div className="auth-quote"><span className="section-kicker"><i /> YOUR NEXT IDEA STARTS HERE</span><h1 id="auth-visual-title">{ui('생각의 경계를')}<br /><em>{ui('넘어, 함께.')}</em></h1><p>{ui('아이디어에서 코드까지, 하나의 캔버스.')}<br />{ui('흩어진 생각을 연결하고 팀의 다음 가능성을 열어보세요.')}</p></div>
        <div className="auth-art"><WorkspacePreview compact /></div>
        <div className="auth-panel-foot"><span>CREATE / CONNECT / COLLABORATE</span><span>∞</span></div>
      </section>
      <section className="auth-form-panel" aria-labelledby="auth-form-title">
      <div className="auth-form-wrap"><div className="auth-card-label"><span>F / {mode === 'login' ? '01' : '02'}</span><Icon name="arrow" size={18} /></div><div className="auth-heading"><span className="section-kicker">{mode === 'login' ? 'WELCOME BACK' : 'START SOMETHING NEW'}</span><h2 id="auth-form-title">{mode === 'login' ? ui("다시 만났네요.") : ui("함께 시작해요.")}</h2><p>{mode === 'login' ? ui("로그인하고 이어서 아이디어를 나눠보세요.") : ui("계정을 만들고 팀의 첫 캔버스를 열어보세요.")}</p></div>
        <form className="auth-form" onSubmit={submit}>
          {(authError || location.state?.sessionExpired) && <div className="form-error" role="status">{ui(authError) || ui("로그인 세션이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.")}</div>}
          {mode === 'signup' && <label className="form-field"><span>{ui("닉네임")}</span><div className="input-wrap"><Icon name="user" size={18} /><input name="nickname" value={form.nickname} onChange={change} placeholder={ui("어떻게 불러드릴까요?")} autoComplete="nickname" maxLength={100} required /></div></label>}
          <label className="form-field"><span>{ui("이메일")}</span><div className="input-wrap"><Icon name="mail" size={18} /><input type="email" name="email" value={form.email} onChange={change} placeholder="you@example.com" autoComplete="email" required /></div></label>
          <label className="form-field"><span>{ui("비밀번호")}</span><div className="input-wrap"><Icon name="lock" size={18} /><input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={change} placeholder={ui("비밀번호를 입력해주세요")} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 6 : undefined} required /><button type="button" className="input-trailing" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? ui("비밀번호 숨기기") : ui("비밀번호 표시")}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} /></button></div></label>
          {error && <div className="form-error" role="alert">{ui(error)}</div>}
          <button className="button button-dark button-submit" type="submit" disabled={busy}>{busy ? ui("잠시만요…") : mode === 'login' ? ui("로그인") : ui("계정 만들기")} <Icon name="arrow" size={17} /></button>
        </form>
        <div className="auth-switch">{mode === 'login' ? ui("아직 계정이 없으신가요?") : ui("이미 FreLog 계정이 있나요?")} <button type="button" onClick={() => { setError(''); setMode(mode === 'login' ? 'signup' : 'login'); }}>{mode === 'login' ? ui("회원가입") : ui("로그인")}</button></div>
        <div className="auth-terms">{ui("계속 진행하면 FreLog의 이용약관과 개인정보 처리방침에 동의하게 됩니다.")}</div>
      </div>
      </section>
    </main>
    <footer className="auth-page-footer"><span>© {new Date().getFullYear()} FreLog</span><Link to="/docs">{ui('문서')}</Link></footer>
  </div>;
}
