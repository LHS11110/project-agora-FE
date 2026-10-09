import './host-canvas-status.css';

export default function HostCanvasStatus({ status, receipt, onRetry }) {
  const reconnecting = !status.ready && status.editable;
  const summary = receipt?.summary;
  const result = receipt?.status === 'accepted'
    ? `호스트 승인: 생성 ${summary?.created || 0} · 수정 ${summary?.updated || 0} · 삭제 ${summary?.deleted || 0}`
    : receipt?.status === 'rejected' ? `호스트 거절: ${receipt.message || '요청을 반영하지 못했습니다.'}`
      : receipt?.status === 'received' ? '호스트가 요청을 수신했습니다.'
        : receipt?.status === 'waiting' ? '호스트 동기화 후 다시 전송합니다.' : '';
  return <div className={`host-canvas-status${reconnecting ? ' is-reconnecting' : ''}`} role="status" aria-live="polite" title="요청 수신과 승인 결과를 확인합니다. 승인은 서버 저장 완료와 구분됩니다.">
    {reconnecting
      ? '호스트 연결이 잠시 중단됐습니다. 작업은 계속할 수 있고, 변경 사항은 연결 후 전송됩니다.'
      : status.ready ? (status.isHost ? '호스트' : '호스트 연결됨') : '호스트와 동기화 중'}
    {status.queued > 0 && ` · 승인 대기 ${status.queued}건`}
    {!reconnecting && result && ` · ${result}`}
    {status.blocked && <>
      <span> · 후속 요청 전송 중단</span>
      <button type="button" onClick={onRetry}>같은 요청 재시도</button>
    </>}
  </div>;
}
