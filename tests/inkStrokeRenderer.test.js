import test from 'node:test';
import assert from 'node:assert/strict';
import { createInkStrokeRenderer } from '../src/canvas/inkStrokeRenderer.js';

test('finished and cancelled local or remote ink clears the whole surface after camera transforms', () => {
  const oldDocument=globalThis.document,oldPath=globalThis.Path2D,canvases=[];
  globalThis.Path2D=class { moveTo(){} lineTo(){} };
  globalThis.document={createElement(){
    const context={transform:[1,0,0,1,0,0],clears:[],setTransform(...value){this.transform=value;},
      clearRect(...rect){this.clears.push({transform:[...this.transform],rect});},
      save(){},restore(){},getTransform(){return {a:this.transform[0],b:this.transform[1]};},stroke(){}};
    const canvas={width:300,height:150,getContext:()=>context,remove(){},context};canvases.push(canvas);return canvas;
  }};
  try {
    const renderer=createInkStrokeRenderer({insertBefore(){},appendChild(){}},{}),live=canvases[1];
    const stroke={id:'ink',points:[{x:.1,y:.1},{x:.9,y:.8}],strokeWidth:3,shadowEnabled:false};
    for(const camera of [{x:-800,y:-200,scale:.35},{x:250,y:80,scale:2}])for(const pixelRatio of [1,2]){
      const state={items:{},previews:[],draft:stroke,width:1600,height:1000,viewportWidth:1200,viewportHeight:800,camera,pixelRatio};
      renderer.render(state);renderer.renderDraft(null);
      assert.deepEqual(live.context.clears.at(-1),{transform:[1,0,0,1,0,0],rect:[0,0,1200*pixelRatio,800*pixelRatio]});
      const cleared=live.context.clears.length;renderer.renderDraft(null);
      assert.equal(live.context.clears.length,cleared,'empty frames avoid unnecessary clears');
      renderer.render({...state,draft:null,previews:[stroke]});
      renderer.render({...state,draft:null,previews:[]});
      assert.deepEqual(live.context.clears.at(-1).transform,[1,0,0,1,0,0],'remote preview removal also resets the camera transform');
    }
    renderer.destroy();
  }finally{globalThis.document=oldDocument;globalThis.Path2D=oldPath;}
});
