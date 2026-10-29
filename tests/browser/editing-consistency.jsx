import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CanvasObject from '../../src/canvas/CanvasObject.jsx';
import '../../src/styles.css';
import '../../src/workspace-docs.css';
import '../../src/vector-editor.css';

const noop = () => {};
const initial = { kind:'text',renderMode:'code',text:'const answer = 42;\nconsole.log(answer);',filename:'hello.js',language:'javascript',x:.1,y:.1,width:.35 };
function Fixture() {
  const [item,setItem]=useState(initial),[editing,setEditing]=useState(false),[theme,setTheme]=useState('light'),[scale,setScale]=useState(1);
  useEffect(()=>{
    window.setEditingFixture=({item=initial,editing=false,theme='light',scale=1}={})=>{setItem(item);setEditing(editing);setTheme(theme);setScale(scale)};
    window.toggleFixtureEditing=setEditing;
    window.patchEditingFixture=patch=>setItem(current=>({...current,...patch}));
    return ()=>{delete window.setEditingFixture;delete window.toggleFixtureEditing;delete window.patchEditingFixture};
  },[]);
  return <div className="canvas-app-page" data-theme={theme}><div className="canvas-stage" style={{width:1600,height:1000}}><div style={{position:'absolute',inset:0,transform:`scale(${scale})`,transformOrigin:'top left'}}>
    <CanvasObject id="editing-fixture" item={item} viewSize={{width:1600,height:1000}} selected editing={editing} activeTool="select"
      onTextChange={(_id,text)=>setItem(current=>({...current,text}))} onFormulaChange={(_id,formula)=>setItem(current=>({...current,formula}))}
      onMetadataChange={(_id,key,value)=>setItem(current=>({...current,[key]:value}))} onStartEditing={()=>setEditing(true)} onStopEditing={()=>setEditing(false)} onSave={noop} onPointerDown={noop} onResizeStart={noop} />
  </div></div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
