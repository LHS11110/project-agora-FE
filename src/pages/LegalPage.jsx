import { Link } from '../routing.jsx';
import FreLogBrand from '../components/frelog/FreLogBrand.jsx';
import LanguageSwitcher from '../i18n/LanguageSwitcher.jsx';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import Icon from '../components/Icon.jsx';
import {
  PRIVACY_SECTIONS,
  PRIVACY_STORAGE_ITEMS,
  PUBLISHER_INFO,
  TERMS_SECTIONS,
} from '../legal/legalContent.js';
import '../legal/legal.css';

export default function LegalPage({ defaultTab = 'terms' }) {
  useUiLocale();
  const isPrivacy = defaultTab === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return <div className="legal-page">
    <header className="legal-header">
      <div className="legal-header-inner">
        <FreLogBrand />
        <div className="legal-header-actions">
          <LanguageSwitcher />
          <Link className="legal-back-home" to="/" aria-label={ui('홈으로 돌아가기')}>
            <Icon name="back" size={14} />
            {ui('홈으로 돌아가기')}
          </Link>
        </div>
      </div>
    </header>

    <main className="legal-main">
      <div className="legal-hero">
        <span className="legal-kicker">FRELOG · LEGAL & PRIVACY</span>
        <h1>{isPrivacy ? ui('개인정보 처리방침') : ui('FreLog 이용약관')}</h1>
        <p>
          {isPrivacy
            ? ui('회원가입 및 실시간 캔버스 협업 과정에서 수집·저장하는 정보와 보관·파기 기준을 안내합니다.')
            : ui('실시간 협업 캔버스 서비스 FreLog의 이용 조건과 계정·콘텐츠 관리 기준을 안내합니다.')}
        </p>
        <div className="legal-meta-bar">
          <span>{ui('제작·운영')}: {PUBLISHER_INFO.studioName} ({PUBLISHER_INFO.maintainer})</span>
          <span>{ui('시행일')}: {PUBLISHER_INFO.effectiveDate}</span>
          <span>{ui('라이선스')}: {PUBLISHER_INFO.license}</span>
        </div>
      </div>

      <nav className="legal-tabs" aria-label={ui('약관 및 정책 선택')}>
        <Link className={`legal-tab${!isPrivacy ? ' is-active' : ''}`} to="/terms" aria-current={!isPrivacy ? 'page' : undefined}>
          {ui('이용약관')}
        </Link>
        <Link className={`legal-tab${isPrivacy ? ' is-active' : ''}`} to="/privacy" aria-current={isPrivacy ? 'page' : undefined}>
          {ui('개인정보 처리방침')}
        </Link>
      </nav>

      <div className="legal-sections">
        {sections.map((section) => (
          <section className="legal-card" key={section.number}>
            <div className="legal-card-head">
              <span>{ui(section.number)}</span>
              <h2>{ui(section.title)}</h2>
            </div>
            {section.paragraphs.map((text, index) => (
              <p key={index}>{ui(text)}</p>
            ))}
          </section>
        ))}
      </div>

      {isPrivacy && (
        <section className="legal-table-wrap" aria-label={ui('개인정보 수집 및 저장 항목 상세')}>
          <table className="legal-table">
            <thead>
              <tr>
                <th>{ui('구분')}</th>
                <th>{ui('수집·저장 항목')}</th>
                <th>{ui('이용 목적')}</th>
                <th>{ui('보관 및 파기')}</th>
              </tr>
            </thead>
            <tbody>
              {PRIVACY_STORAGE_ITEMS.map((row) => (
                <tr key={row.category}>
                  <td>{ui(row.category)}</td>
                  <td>{ui(row.items)}</td>
                  <td>{ui(row.purpose)}</td>
                  <td>{ui(row.retention)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>

    <footer className="legal-footer">
      <div className="legal-footer-inner">
        <span>© {new Date().getFullYear()} {PUBLISHER_INFO.studioName} ({PUBLISHER_INFO.maintainer}) · {PUBLISHER_INFO.license}</span>
        <div className="legal-footer-links">
          <Link to="/">{ui('홈')}</Link>
          <Link to="/login">{ui('로그인')}</Link>
          <Link to="/docs">{ui('문서')}</Link>
          <a href={PUBLISHER_INFO.repositoryUrl} target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
    </footer>
  </div>;
}
