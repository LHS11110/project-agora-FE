import { Fragment, useMemo, useState } from 'react';
import { shapeCatalog, shapeCategories } from './shapeCatalog.js';
import { shapeOutlinePaths } from './shapeGeometry.js';
import './shape-picker.css';
function previewPaths(shape) {
 const width=Math.min(40,32*shape.aspect),height=width/shape.aspect;
 return shapeOutlinePaths(shape.id,width,height).map(path=>path.map(point=>({x:point.x+(40-width)/2,y:point.y+(32-height)/2})));
}
export default function ShapePicker({value,onChange,compact=false}) {
 const [category,setCategory]=useState('all'),[query,setQuery]=useState('');
 const shapes=useMemo(()=>shapeCatalog.filter(shape=>(category==='all'||shape.category===category)&&query.trim().toLowerCase().split(/\s+/).every(term=>`${shape.label} ${shape.id} ${shape.keywords||''} ${shapeCategories[shape.category]}`.toLowerCase().includes(term))),[category,query]);
 if(compact)return <select className="shape-select" aria-label="도형 종류" value={value} onChange={event=>onChange(event.target.value)}>{Object.entries(shapeCategories).map(([key,label])=><optgroup key={key} label={label}>{shapeCatalog.filter(shape=>shape.category===key).map(shape=><option key={shape.id} value={shape.id}>{shape.label}</option>)}</optgroup>)}</select>;
 return <div className="shape-library"><div className="shape-library-filters"><input type="search" aria-label="도형 검색" placeholder="이름·용도로 검색" value={query} onChange={event=>setQuery(event.target.value)}/><select aria-label="도형 분야" value={category} onChange={event=>setCategory(event.target.value)}><option value="all">모든 분야</option>{Object.entries(shapeCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div><div className="shape-picker" role="group" aria-label="도형 종류">
 {shapes.map((shape,index)=><Fragment key={shape.id}>{shapes[index-1]?.category!==shape.category&&<span className="shape-picker-section">{shapeCategories[shape.category]}</span>}<button type="button" className={value===shape.id?'selected':''} aria-pressed={value===shape.id} title={shape.dimensions?`${shape.label} · ${shape.dimensions} · 세로 비율`:shape.label} onClick={()=>onChange(shape.id)}><svg viewBox="-3 -3 46 38" aria-hidden="true">{previewPaths(shape).map((path,i)=><polyline key={i} points={path.map(p=>`${p.x},${p.y}`).join(' ')}/>)}</svg><span>{shape.label}</span></button></Fragment>)}
 {!shapes.length&&<p className="shape-picker-empty">일치하는 도형이 없습니다.</p>}</div></div>;
}
