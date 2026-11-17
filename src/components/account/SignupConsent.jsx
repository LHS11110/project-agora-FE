import { useEffect, useId, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import {
  PRIVACY_SECTIONS,
  PRIVACY_STORAGE_ITEMS,
  TERMS_SECTIONS,
} from '../../legal/legalContent.js';
import Icon from '../Icon.jsx';
import './signup-consent.css';

export default function SignupConsent({
  value = { terms: false, privacy: false },
  onChange,
  disabled = false,
}) {
  const fieldId = useId();
  const [modalKind, setModalKind] = useState(null);
  const allChecked = Boolean(value.terms && value.privacy);

  useEffect(() => {
    if (!modalKind) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setModalKind(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalKind]);

  const toggleAll = (checked) => {
    onChange?.({ terms: checked, privacy: checked });
  };

  const toggleItem = (key, checked) => {
    onChange?.({ ...value, [key]: checked });
  };

  const acceptModal = () => {
    if (modalKind === 'terms') toggleItem('terms', true);
    if (modalKind === 'privacy') toggleItem('privacy', true);
    setModalKind(null);
  };

  const sections = modalKind === 'privacy' ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return <fieldset className="signup-consent" disabled={disabled}>
    <legend className="signup-consent-legend">{ui('약관 및 개인정보 저장 동의')}</legend>

    <label className="signup-consent-all">
      <input
        id={`${fieldId}-all`}
        name="consent-all"
        type="checkbox"
        checked={allChecked}
        onChange={(event) => toggleAll(event.target.checked)}
      />
      <span>{ui('이용약관 및 개인정보 수집·저장에 모두 동의합니다')}</span>
    </label>

    <div className="signup-consent-list">
      <div className="signup-consent-row">
        <label className="signup-consent-check">
          <input
            id={`${fieldId}-terms`}
            name="consent-terms"
            type="checkbox"
            checked={Boolean(value.terms)}
            onChange={(event) => toggleItem('terms', event.target.checked)}
          />
          <span>
            <em>[{ui('필수')}]</em> {ui('FreLog 이용약관 동의')}
          </span>
        </label>
        <button
          type="button"
          className="signup-consent-view"
          onClick={() => setModalKind('terms')}
        >
          {ui('내용 보기')}
        </button>
      </div>

      <div className="signup-consent-row">
        <label className="signup-consent-check">
          <input
            id={`${fieldId}-privacy`}
            name="consent-privacy"
            type="checkbox"
            checked={Boolean(value.privacy)}
            onChange={(event) => toggleItem('privacy', event.target.checked)}
          />
          <span>
            <em>[{ui('필수')}]</em> {ui('개인정보 수집·저장 및 처리방침 동의')}
          </span>
        </label>
        <button
          type="button"
          className="signup-consent-view"
          onClick={() => setModalKind('privacy')}
        >
          {ui('내용 보기')}
        </button>
      </div>
      <p className="signup-consent-note">
        {ui('저장 항목: 이메일, 닉네임, 비밀번호(해시), 캔버스·채팅 데이터 및 접속 기록 (회원 탈퇴 시 파기)')}
      </p>
    </div>

    {modalKind && (
      <div
        className="legal-modal-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget) setModalKind(null);
        }}
      >
        <div
          className="legal-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-legal-modal-title"
        >
          <div className="legal-modal-head">
            <h3 id="signup-legal-modal-title">
              {modalKind === 'privacy' ? ui('개인정보 수집·저장 및 처리방침') : ui('FreLog 이용약관')}
            </h3>
            <button
              type="button"
              className="legal-modal-close"
              aria-label={ui('닫기')}
              onClick={() => setModalKind(null)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="legal-modal-body">
            {sections.map((section) => (
              <section className="legal-modal-section" key={section.number}>
                <h4>{ui(section.number)} · {ui(section.title)}</h4>
                {section.paragraphs.map((text, idx) => (
                  <p key={idx}>{ui(text)}</p>
                ))}
              </section>
            ))}
            {modalKind === 'privacy' && (
              <div className="legal-modal-table-wrap">
                <table className="legal-modal-table">
                  <thead>
                    <tr>
                      <th>{ui('구분')}</th>
                      <th>{ui('수집·저장 항목')}</th>
                      <th>{ui('보관 및 파기')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRIVACY_STORAGE_ITEMS.map((row) => (
                      <tr key={row.category}>
                        <td>{ui(row.category)}</td>
                        <td>{ui(row.items)}</td>
                        <td>{ui(row.retention)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="legal-modal-foot">
            <button type="button" className="button" onClick={() => setModalKind(null)}>
              {ui('닫기')}
            </button>
            <button type="button" className="button button-dark" onClick={acceptModal}>
              {ui('동의하고 닫기')}
            </button>
          </div>
        </div>
      </div>
    )}
  </fieldset>;
}
