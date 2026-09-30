import '../login-example.css';

export default function LoginAgoraExample({ compact = false }) {
  return <div className={`login-agora-example${compact ? ' login-agora-example--compact' : ''}`} role="img" aria-label="질문과 경청이 만나 함께 생각하는 문화를 만드는 아고라 예시">
    <div className="login-example-paper">
      <div className="login-example-header"><span>AGORA · IDEAS IN COMPANY</span><b>ἀγορά</b></div>
      <svg className="login-example-sketch" viewBox="0 0 360 112" fill="none" aria-hidden="true">
        <path className="login-example-connection" d="M74 45C112 4 246 4 286 45M74 45c44 51 168 51 212 0" />
        <circle className="login-example-node" cx="74" cy="45" r="3.5" />
        <circle className="login-example-node" cx="180" cy="14" r="3.5" />
        <circle className="login-example-node" cx="286" cy="45" r="3.5" />
        <g className="login-example-person login-example-person-one"><circle cx="74" cy="55" r="9" /><path d="M58 102c1-19 5-31 16-31s15 12 16 31H58Z" /></g>
        <g className="login-example-person login-example-person-two"><circle cx="180" cy="38" r="10" /><path d="M160 102c1-22 7-37 20-37s19 15 20 37h-40Z" /></g>
        <g className="login-example-person login-example-person-three"><circle cx="286" cy="55" r="9" /><path d="M270 102c1-19 5-31 16-31s15 12 16 31h-32Z" /></g>
        <path className="login-example-column" d="M20 92h27M23 87h21M25 84V50h17v34M23 49c1-9 5-14 12-14s11 5 12 14M27 57h13M27 65h13M27 73h13" />
        <path className="login-example-olive" d="M328 91c-5-17-2-33 10-51m-6 37c-9-8-15-8-18-5 2 7 8 9 18 5Zm1-13c-2-10 1-15 7-16 4 6 2 12-7 16Zm3-13c-7-5-9-10-5-15 7 2 9 7 5 15Z" />
      </svg>
      <div className="login-example-formula"><span>질문</span><b>+</b><span>경청</span><b>→</b><strong>공동의 발견</strong></div>
      <p className="login-example-caption">서로의 관점이 만나 함께 만드는 문화</p>
    </div>
  </div>;
}
