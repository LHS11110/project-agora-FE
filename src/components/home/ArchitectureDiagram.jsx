import Icon from '../Icon.jsx';

export default function ArchitectureDiagram() {
  return <div className="architecture-showcase" aria-label="프론트엔드에서 백엔드와 데이터베이스로 이어지는 구성">
    <div className="architecture-showcase-label">FRELOG / SYSTEM MAP</div>
    <div className="architecture-main-flow">
      <article className="architecture-node architecture-client" data-diagram-node data-level="0" style={{ '--diagram-delay': '0s' }}>
        <span className="architecture-node-kicker">01 / CLIENT</span>
        <h3>프론트엔드</h3>
        <strong>React · Vite</strong>
        <p>화면과 사용자 입력을 맡고, 캔버스의 그림과 아이템을 보여줘요.</p>
        <div className="architecture-tags"><i>UI</i><i>HTTPS</i><i>WebRTC</i></div>
      </article>
      <div className="architecture-flow-arrow" aria-hidden="true"><span>API 요청</span><Icon name="arrow" size={17} /></div>
      <article className="architecture-node architecture-server" data-diagram-node data-level="1" style={{ '--diagram-delay': '1.6s' }}>
        <span className="architecture-node-kicker">02 / BACKEND</span>
        <h3>백엔드</h3>
        <strong>Spring Boot + C++</strong>
        <p>Spring은 로그인·권한·API를, C++은 캔버스 세션·저장과 WebRTC 신호 전달을 맡아요.</p>
        <div className="architecture-tags"><i>REST</i><i>WebSocket</i><i>Realtime</i></div>
      </article>
    </div>
    <div className="architecture-storage-connector"><span>작업의 성격에 맞춰 나눠 저장</span></div>
    <div className="architecture-storage-grid">
      <article data-diagram-node data-level="2" style={{ '--diagram-delay': '3.20s' }}><span>RELATIONAL</span><strong>SQL Server</strong><small>계정 · 접속 세션 · 서버 정보</small></article>
      <article data-diagram-node data-level="2" style={{ '--diagram-delay': '3.35s' }}><span>DOCUMENT</span><strong>Elasticsearch</strong><small>캔버스 검색 · 영구 문서</small></article>
      <article data-diagram-node data-level="2" style={{ '--diagram-delay': '3.50s' }}><span>ACTIVE STATE</span><strong>Redis Stack</strong><small>활성 캔버스 · 작업 상태</small></article>
    </div>
    <div className="architecture-showcase-foot"><span>브라우저</span><b>→</b><span>API · 실시간 서버</span><b>→</b><span>저장소</span></div>
  </div>;
}
