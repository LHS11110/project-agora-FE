import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import './vector-style-selector.css';

const STYLE_OPTIONS = [
  ['standard', '기본'],
  ['sketch', '손그림'],
];

function VectorStyleGlyph({ style, variant }) {
  if (variant === 'connector') {
    if (style === 'sketch') {
      return (
        <svg viewBox="0 0 44 26" aria-hidden="true">
          <path d="M8.5 18 Q16 18.8 21.5 13 T34.5 8.5" strokeWidth="1.55" />
          <path d="M9.4 17.1 Q16.6 17.7 22.1 12.3 T33.8 9.2" strokeWidth="1.0" strokeOpacity="0.45" />
          <path d="M29.4 5.4 L35.2 8.4 L30.6 12.6" strokeWidth="1.5" />
          <path d="M30.2 6.2 L34.6 8.5" strokeWidth="1.05" strokeOpacity="0.45" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 44 26" aria-hidden="true">
        <path d="M8 17.5 C16.5 17.5 22 8.5 34.5 8.5" strokeWidth="1.75" />
        <path d="M30.2 5.2 L35.5 8.5 L30.2 11.8" strokeWidth="1.75" />
      </svg>
    );
  }

  if (style === 'sketch') {
    return (
      <svg viewBox="0 0 44 26" aria-hidden="true">
        <path d="M12.5 18.8 L19.2 7.2 M18.4 19.2 L25.6 7.0 M24.5 19.3 L31.6 7.3 M30.2 19.2 L34.2 12.2" strokeWidth="1.2" strokeOpacity="0.52" />
        <path d="M9.2 5.4 C17.5 4.2 26.8 5.1 35.1 5.0 C36.7 10.1 36.2 15.9 35.2 20.6 C27.2 21.6 17.5 21.1 8.8 20.8 C7.7 15.6 8.1 10.2 9.2 5.4 Z" strokeWidth="1.55" />
        <path d="M10.1 4.7 C19.0 5.5 28.4 4.2 35.9 5.8" strokeWidth="1.0" strokeOpacity="0.45" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 44 26" aria-hidden="true">
      <rect x="8.5" y="4.5" width="27" height="17" rx="3.5" fill="currentColor" fillOpacity="0.12" strokeWidth="1.65" />
    </svg>
  );
}

/**
 * Renders the standard vs hand-drawn style selector cards for shapes and connectors.
 */
export default function VectorStyleSelector({ value = 'standard', onChange, variant = 'shape' }) {
  useUiLocale();
  return (
    <div className="vector-style-options vector-style-selector" role="group" aria-label={ui('그림 스타일')}>
      {STYLE_OPTIONS.map(([style, label]) => (
        <button
          key={style}
          type="button"
          className={value === style ? 'selected' : ''}
          aria-pressed={value === style}
          onClick={() => onChange(style)}
        >
          <span className="vector-style-preview" aria-hidden="true">
            <VectorStyleGlyph style={style} variant={variant} />
          </span>
          <span className="vector-style-label">{ui(label)}</span>
        </button>
      ))}
    </div>
  );
}
