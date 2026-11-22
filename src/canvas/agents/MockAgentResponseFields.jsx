import { ui } from '../../i18n/locale.js';
import { MAX_MOCK_RESPONSE_CHARS } from './agentCanvasModel.js';

export default function MockAgentResponseFields({ config, onChange, readOnly, className }) {
  return (
    <>
      <label className={className}>
        <span>{ui('첫 모형 응답')}</span>
        <textarea
          rows={3}
          maxLength={MAX_MOCK_RESPONSE_CHARS}
          readOnly={readOnly}
          value={config.mockResponse}
          onChange={event => onChange({ mockResponse: event.target.value })}
        />
      </label>
      <label className={className}>
        <span>{ui('후속 모형 응답 (선택)')}</span>
        <textarea
          rows={3}
          maxLength={MAX_MOCK_RESPONSE_CHARS}
          readOnly={readOnly}
          value={config.mockFollowup}
          placeholder={ui('비워두면 첫 응답을 반복합니다.')}
          onChange={event => onChange({ mockFollowup: event.target.value })}
        />
      </label>
    </>
  );
}
