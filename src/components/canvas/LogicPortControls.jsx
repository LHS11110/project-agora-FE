import { logicPorts } from '../../canvas/logicGates.js';

export default function LogicPortControls({ item, items, onChange }) {
  const endpoints = [['fromPort','from','output','출력 핀'],['toPort','to','input','입력 핀']].map(([field, endpoint, direction, label])=>({field,label,ports:logicPorts(items[item[endpoint]]?.shapeType).filter(port=>port.direction===direction)})).filter(endpoint=>endpoint.ports.length);
  if (!endpoints.length) return null;
  return <section className="inspector-section connector-label-controls"><strong className="inspector-label">논리 회로 배선</strong>
    {endpoints.map(({field,label,ports})=><label key={field}>{label}<select aria-label={label} value={item[field] || ''} onChange={event=>onChange(field,event.target.value)}><option value="">자동 선택</option>{ports.map(port=><option key={port.id} value={port.id}>{port.label}</option>)}</select></label>)}
    <small className="inspector-hint">배선 끝은 선택한 핀에 연결되며 게이트를 이동하거나 회전하면 따라갑니다.</small>
  </section>;
}
