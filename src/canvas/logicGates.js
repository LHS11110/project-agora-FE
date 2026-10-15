export const logicGateCatalog = [
  { id: 'logic-and', label: 'AND' }, { id: 'logic-or', label: 'OR' },
  { id: 'logic-not', label: 'NOT' }, { id: 'logic-xor', label: 'XOR' },
  { id: 'logic-nand', label: 'NAND' }, { id: 'logic-nor', label: 'NOR' },
  { id: 'logic-xnor', label: 'XNOR' }, { id: 'logic-buffer', label: 'BUFFER' },
  { id: 'logic-full-adder', label: '전가산기' },
].map(gate => ({ ...gate, aspect: 1.4, category: 'logic' }));
const types = new Set(logicGateCatalog.map(gate => gate.id));
export const isLogicGate = type => types.has(type);
const point = (x, y) => ({ x, y });
const closed = path => [...path, { ...path[0] }];
const line = (x1, y1, x2, y2) => [point(x1, y1), point(x2, y2)];
function cubic(from, a, b, to, count = 24) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count, u = 1 - t;
    return point(u*u*u*from.x + 3*u*u*t*a.x + 3*u*t*t*b.x + t*t*t*to.x,
      u*u*u*from.y + 3*u*u*t*a.y + 3*u*t*t*b.y + t*t*t*to.y);
  });
}
function circle(cx, cy, r) {
  return Array.from({ length: 33 }, (_, i) => point(cx + r*Math.cos(i*Math.PI/16), cy + r*Math.sin(i*Math.PI/16)));
}
function leftBoundary(path, y) {
  const hits = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) hits.push(a.x + (b.x-a.x)*(y-a.y)/(b.y-a.y));
  }
  return Math.min(...hits);
}
const port = (id, label, direction, x, y, nx, ny) => ({ id, label, direction, x: x/100, y: y/80, nx, ny });
const binaryPorts = [port('a', 'A', 'input', 0,24,-1,0), port('b','B','input',0,56,-1,0), port('out','Y','output',100,40,1,0)];
const unaryPorts = [port('in','A','input',0,40,-1,0), port('out','Y','output',100,40,1,0)];
const adderPorts = [port('a','A','input',35,0,0,-1),port('b','B','input',65,0,0,-1),port('cin','Cin','input',0,40,-1,0),port('sum','S','output',50,80,0,1),port('cout','Cout','output',100,40,1,0)];
export function logicPorts(type) { return !isLogicGate(type) ? [] : type === 'logic-full-adder' ? adderPorts : ['logic-not','logic-buffer'].includes(type) ? unaryPorts : binaryPorts; }
const baseCache = new Map();
function baseGeometry(type) {
  if (baseCache.has(type)) return baseCache.get(type);
  const paths = [], fills = [];
  if (type === 'logic-full-adder') {
    const body = closed([point(12,16),point(88,16),point(88,64),point(12,64)]);
    paths.push(body,line(35,0,35,16),line(65,0,65,16),line(0,40,12,40),line(88,40,100,40),line(50,64,50,80)); fills.push(body);
    // FA remains a native vector symbol at every zoom and in sketch mode.
    paths.push([point(40,49),point(40,31),point(49,31)],line(40,39,47,39),[point(53,49),point(58,31),point(63,49)],line(55,42,61,42));
  } else {
    const inverted = ['logic-not','logic-nand','logic-nor','logic-xnor'].includes(type);
    const tip = inverted ? 74 : 82;
    let body;
    if (['logic-not','logic-buffer'].includes(type)) {
      body = closed([point(18,8),point(tip,40),point(18,72)]);
      paths.push(line(0,40,18,40));
    } else if (['logic-and','logic-nand'].includes(type)) {
      const curve = Array.from({length:33},(_,i)=>{const a=-Math.PI/2+i*Math.PI/32;return point(50+(tip-50)*Math.cos(a),40+32*Math.sin(a));});
      body = closed([point(18,8),...curve,point(18,72)]);
      paths.push(line(0,24,18,24),line(0,56,18,56));
    } else {
      body = [...cubic(point(18,8),point(52,8),point(tip-12,15),point(tip,40)),
        ...cubic(point(tip,40),point(tip-12,65),point(52,72),point(18,72)).slice(1),
        ...cubic(point(18,72),point(36,58),point(36,22),point(18,8)).slice(1)];
      paths.push(line(0,24,leftBoundary(body,24),24),line(0,56,leftBoundary(body,56),56));
      if (['logic-xor','logic-xnor'].includes(type)) paths.push(cubic(point(10,72),point(28,58),point(28,22),point(10,8)));
    }
    paths.unshift(body); fills.push(body);
    if (inverted) { const bubble = circle(79,40,5); paths.push(bubble); fills.push(bubble); }
    paths.push(line(inverted?84:82,40,100,40));
  }
  const result = { paths, fills }; baseCache.set(type,result); return result;
}
export function logicGateGeometry(type, width, height) {
  if (!isLogicGate(type)) return null;
  const base = baseGeometry(type), scale = path => path.map(p=>point(p.x*width/100,p.y*height/80));
  return { paths: base.paths.map(scale), fills: base.fills.map(scale), ports: logicPorts(type) };
}
export function logicPortPosition(item, id, world) {
  const p = logicPorts(item?.shapeType).find(p => p.id === id);
  if (!p) return null;
  const w=(Number(item.width)||.14)*world.width,h=(Number(item.height)||.12)*world.height;
  const a=(Number(item.rotation)||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=(p.x-.5)*w,dy=(p.y-.5)*h;
  return { x:(Number(item.x)||0)*world.width+w/2+dx*c-dy*s,y:(Number(item.y)||0)*world.height+h/2+dx*s+dy*c,nx:p.nx*c-p.ny*s,ny:p.nx*s+p.ny*c,id:p.id };
}
export function nearestLogicPort(item, direction, target, world) {
  return logicPorts(item?.shapeType).filter(p=>p.direction===direction).map(p=>logicPortPosition(item,p.id,world))
    .sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))[0] || null;
}
