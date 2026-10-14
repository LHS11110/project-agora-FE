import { GRAPHICS_PROFILES, graphicsResolution, graphicsRasterRatio, normalizeGraphicsQuality } from './graphicsQuality.js';
import { changedItemIds } from './itemSnapshots.js';
import ScenePreparationQueue from './ScenePreparationQueue.js';
import { flatRectangleTint,tintRasterItem } from './flatShapeTint.js';
import WorkerFrameCompositor from './WorkerFrameCompositor.js';
import { rasterViewportRegion } from './rasterViewportRegion.js';
import { hasHardwareWebGL } from './gpuCapability.js';
import { cachedCameraProjection } from './cachedCameraProjection.js';
import { useLayoutEffect, useRef } from 'react';
import { Application, Sprite } from 'pixi.js';
import { createInkStrokeRenderer } from './inkStrokeRenderer.js';
import { CONNECTOR_METRICS_EVENT } from './connectors/objectMetrics.js';
import { acquireGpuSlot, rasterDescriptor, rasterizeObject, sameRasterInput } from './rasterObjectCache.js';
import { RasterTextureAtlas } from './textureAtlas.js';
import SharedRasterCache from './SharedRasterCache.js';
import { isRasterText } from './plainTextRaster.js';
import { mergeDamage, overlaps, paintBounds } from './renderDamage.js';
import '../components/vector-layer.css';

const EMPTY_PREVIEWS = [];
const EMPTY_ITEMS={};

export default function DepthVectorLayer(props) {
  const host = useRef(null), renderer = useRef(null), latest = useRef(props);
  latest.current = props;
  useLayoutEffect(() => {
    const element = host.current, canvas = document.createElement('canvas');
    element.appendChild(canvas);
    canvas.style.display='none';
    const viewportContext=canvas.getContext('2d',{alpha:true,desynchronized:true});
    const buffer=document.createElement('canvas'),bufferContext=buffer.getContext('2d',{alpha:true,desynchronized:true});
    const margin=256;
    buffer.className='vector-composite-surface';element.insertBefore(buffer,canvas);
    let compositor=null,bufferVersion=0,surfaceChanged=false,worldPaintBounds=null,bufferCamera=null,sceneInputs=null,lastCamera=null,cameraIdleTimer=null,refreshCamera=false,cameraActive=false,viewportMetrics=null,textAppearanceCache=null;
    const ink = createInkStrokeRenderer(element, canvas);
    const records = new Map();
    const preparationQueue = new ScenePreparationQueue();
    let preparation = null;
    const atlas = new RasterTextureAtlas();
    const resources = new SharedRasterCache(resource => {
      if(resource.textureHandle) atlas.release(resource.textureHandle);
      if(resource.raster.canvas)resource.raster.canvas.width=resource.raster.canvas.height=1;
    });
    const stats = element.__agoraRenderStats = { frames: 0, rasterizations: 0, cacheHits: 0, descriptorsUpdated: 0, drawnObjects: 0, texturePages: 0 };
    let app, pendingApp, releaseGpu, gpuFailed = false, disposed = false, frame = null, draft;
    let types={items:null,kinds:new Map(),texts:0,connectors:0};
    let metricsRevision = 0, inkKey = '', previousPreviews,previousDraft,previousInkItems, previousPaintKey = '', previousOrder = '';
    const destroyRecord = record => {
      record.sprite?.destroy();
      resources.release(record.resource);
    };
    const ensureWorker=()=>{if(!compositor)compositor=new WorkerFrameCompositor(element,canvas,()=>{surfaceChanged=true;schedule();},stats);};
    const ensureGpu = () => {
      if (app || pendingApp || gpuFailed || disposed || !records.size) return;
      if(!hasHardwareWebGL()){gpuFailed=true;element.dataset.renderer='canvas2d';ensureWorker();return;}
      releaseGpu = acquireGpuSlot();
      if (!releaseGpu){ensureWorker();return;}
      const candidate = pendingApp = new Application();
      candidate.init({ backgroundAlpha: 0, antialias: false, autoStart: false, preference: 'webgl', powerPreference: 'high-performance', resolution: graphicsResolution(latest.current.graphicsQuality, window.devicePixelRatio), eventMode: 'none' }).then(() => {
        pendingApp = null;
        if (disposed) { candidate.destroy(true,{children:true}); releaseGpu?.(); return; }
        const gl = candidate.renderer.gl;
        const debug = gl?.getExtension('WEBGL_debug_renderer_info');
        const webgpuAdapter = candidate.renderer.gpu?.adapter;
        const adapter = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : [webgpuAdapter?.info?.description,webgpuAdapter?.info?.architecture,webgpuAdapter?.info?.vendor].join(' ');
        // Software WebGL adds readback/driver overhead without hardware acceleration.
        if ((!gl && !webgpuAdapter) || /swiftshader|llvmpipe|softpipe|software/i.test(adapter) || webgpuAdapter?.isFallbackAdapter || webgpuAdapter?.info?.isFallbackAdapter) {
          candidate.destroy(true,{children:true}); releaseGpu?.(); releaseGpu = null;
          gpuFailed = true; element.dataset.renderer = 'canvas2d';ensureWorker(); schedule(); return;
        }
        app = candidate;stats.gpuAdapter=adapter;
        // Raster textures already contain antialiased edges. Avoid multisample
        // framebuffer bandwidth, and apply camera transforms to one render group.
        app.stage.enableRenderGroup();
        app.stage.interactiveChildren = false;
        app.stage.eventMode = 'none';
        app.stage.sortableChildren = true;
        element.insertBefore(app.canvas, canvas);
        compositor?.destroy();compositor=null;canvas.style.display = 'none';buffer.style.display='none'; element.dataset.renderer = gl ? 'webgl' : 'webgpu';
        app.canvas.addEventListener('webglcontextlost', () => { app.canvas.style.display='none';gpuFailed = true; canvas.style.display = 'none';buffer.style.display=''; element.dataset.renderer = 'canvas2d';ensureWorker(); schedule(); });
        schedule();
      }).catch(() => {
        try { if (candidate.renderer) candidate.destroy(true,{children:true}); } catch { /* A partial GPU init still falls back to 2D. */ }
        pendingApp = null; gpuFailed = true; releaseGpu?.(); releaseGpu = null;
        element.dataset.renderer = 'canvas2d';ensureWorker(); schedule();
      });
    };
    const render = () => {
      frame = null;
      if (disposed) return;
      const { items, referenceItems, worldSize: world, camera, routingRevision = 0, previewStrokes = EMPTY_PREVIEWS, inkItems = EMPTY_ITEMS } = latest.current;
      const moved=lastCamera && (lastCamera.x!==camera.x || lastCamera.y!==camera.y || lastCamera.scale!==camera.scale);
      if(moved){cameraActive=true;clearTimeout(cameraIdleTimer);cameraIdleTimer=setTimeout(()=>{cameraActive=false;refreshCamera=true;schedule();},120);}
      lastCamera={...camera};
      const settling=refreshCamera;refreshCamera=false;
      const quality=normalizeGraphicsQuality(latest.current.graphicsQuality);
      const profile=GRAPHICS_PROFILES[quality];
      const ratio=graphicsResolution(quality,window.devicePixelRatio);
      stats.graphicsQuality=quality;stats.resolution=ratio;
      if(!textAppearanceCache){const styles=getComputedStyle(element);textAppearanceCache={font:styles.getPropertyValue('--display').trim() || 'serif',color:styles.getPropertyValue('--ink-strong').trim() || '#3c5144'};}
      const textAppearance=textAppearanceCache;
      const width = Math.max(1, viewportMetrics?.width || element.clientWidth), height = Math.max(1, viewportMetrics?.height || element.clientHeight);
      const pixelWidth = Math.round(width*ratio), pixelHeight = Math.round(height*ratio);
      const gpu = app && !gpuFailed;
      if (gpu && (app.renderer.width !== pixelWidth || app.renderer.height !== pixelHeight || app.renderer.resolution !== ratio)) app.renderer.resize(width,height,ratio);
      const desiredRatio = graphicsRasterRatio(quality,camera.scale,window.devicePixelRatio);
      const projection=cachedCameraProjection(bufferCamera,camera,width,height,margin);
      const bufferFits=Boolean(projection);
      const blitBuffer=()=>{
        buffer.style.display='none';
        const region=rasterViewportRegion(worldPaintBounds,camera,width,height);
        const projection=cachedCameraProjection(bufferCamera,camera,width,height,margin);
        const sourceCrop=rasterViewportRegion(worldPaintBounds,{...bufferCamera,x:bufferCamera.x+margin,y:bufferCamera.y+margin},buffer.width/ratio,buffer.height/ratio,1);
        const pixelCrop=sourceCrop?{x:Math.floor(sourceCrop.x*ratio),y:Math.floor(sourceCrop.y*ratio),width:Math.ceil(sourceCrop.width*ratio),height:Math.ceil(sourceCrop.height*ratio)}:null;
        if(compositor?.send({width,height,ratio,region,projection,sourceCrop:pixelCrop,version:bufferVersion},buffer)){canvas.style.display='none';return;}
        if(!region){canvas.style.display='none';stats.outputPixels=0;return;}
        const outputWidth=Math.max(1,Math.round(region.width*ratio)),outputHeight=Math.max(1,Math.round(region.height*ratio));
        if(canvas.width!==outputWidth || canvas.height!==outputHeight){canvas.width=outputWidth;canvas.height=outputHeight;}
        canvas.style.display='';canvas.style.width=`${region.width}px`;canvas.style.height=`${region.height}px`;
        canvas.style.transform=`translate3d(${region.x}px,${region.y}px,0)`;
        const transform=cachedCameraProjection(bufferCamera,camera,width,height,margin);
        viewportContext.setTransform(1,0,0,1,0,0);viewportContext.clearRect(0,0,canvas.width,canvas.height);
        viewportContext.drawImage(buffer,(region.x-transform.x)*ratio/transform.scale,(region.y-transform.y)*ratio/transform.scale,region.width*ratio/transform.scale,region.height*ratio/transform.scale,0,0,canvas.width,canvas.height);
        stats.outputPixels=canvas.width*canvas.height;
        stats.compositePanFrames=(stats.compositePanFrames||0)+1;
      };
      if(types.items!==items){
        const changed=changedItemIds(types.items,items);
        if(changed===null){types={items,kinds:new Map(),texts:0,connectors:0};for(const [id,item] of Object.entries(items||{})){const kind=isRasterText(item)?'rasterText':item.kind;types.kinds.set(id,kind);if(kind==='rasterText')types.texts++;if(kind==='connector')types.connectors++;}}
        else{for(const id of changed){const before=types.kinds.get(id),item=items[id],after=isRasterText(item)?'rasterText':item?.kind;if(before==='rasterText')types.texts--;if(before==='connector')types.connectors--;if(item)types.kinds.set(id,after);else types.kinds.delete(id);if(after==='rasterText')types.texts++;if(after==='connector')types.connectors++;}types.items=items;}
      }
      const nextInkKey=`${quality}:${ratio}:${width}:${height}:${world.width}:${world.height}:${camera.x}:${camera.y}:${camera.scale}`;
      if(nextInkKey!==inkKey || previousPreviews!==previewStrokes || previousDraft!==draft || previousInkItems!==inkItems){
        ink.render({items:inkItems,previews:previewStrokes,draft,width:world.width,height:world.height,viewportWidth:width,viewportHeight:height,camera,pixelRatio:ratio});
        inkKey=nextInkKey;previousPreviews=previewStrokes;previousDraft=draft;previousInkItems=inkItems;
        stats.inkFrames=(stats.inkFrames||0)+1;
      }
      const hiddenKey=[...previewStrokes.map(stroke=>String(stroke.id)),...(draft?.id?[String(draft.id)]:[])].filter(id=>items[id]).sort().join('|');
      const inputs=[items,types.connectors?routingRevision:0,world.width,world.height,types.connectors?routingRevision:0,metricsRevision,hiddenKey,null,ratio,width,height,types.texts?textAppearance.font:'',types.texts?textAppearance.color:'',Boolean(gpu),quality];
      const unchanged=sceneInputs && inputs.every((value,i)=>value===sceneInputs[i]);
      if(sceneInputs && !unchanged){const names=['items','references','worldWidth','worldHeight','routing','metrics','previews','draft','ratio','width','height','font','color','gpu','graphicsQuality'];for(let i=0;i<inputs.length;i++)if(inputs[i]!==sceneInputs[i]){stats.refreshReasons ||= {};stats.refreshReasons[names[i]]=(stats.refreshReasons[names[i]]||0)+1;}}
      const qualityRefresh = sceneInputs && !cameraActive && desiredRatio > sceneInputs.quality * 1.25;
      const pending = preparationQueue.pending;
      if(unchanged && !pending && !qualityRefresh && !surfaceChanged && !moved && !settling && (gpu || bufferFits))return;
      surfaceChanged=false;
      if(unchanged && !pending && !qualityRefresh && (gpu || bufferFits)){
        if(gpu){app.stage.position.set(camera.x,camera.y);app.stage.scale.set(camera.scale);app.renderer.render(app.stage);}
        else blitBuffer();
        stats.frames++;stats.cachedPanFrames=(stats.cachedPanFrames||0)+1;stats.lastDrawnObjects=gpu?preparation.count:0;
        return;
      }
      const damage = [];
      const expandBounds = bounds => {
        if (!bounds) return;
        if (!worldPaintBounds) worldPaintBounds = {...bounds};
        else {
          worldPaintBounds.minX=Math.min(worldPaintBounds.minX,bounds.minX);
          worldPaintBounds.minY=Math.min(worldPaintBounds.minY,bounds.minY);
          worldPaintBounds.maxX=Math.max(worldPaintBounds.maxX,bounds.maxX);
          worldPaintBounds.maxY=Math.max(worldPaintBounds.maxY,bounds.maxY);
        }
      };
      let partial=false;
      if (!unchanged || qualityRefresh) {
        const compatible=sceneInputs && !qualityRefresh && inputs.every((value,i)=>i===0 || value===sceneInputs[i]);
        preparationQueue.setItems(items);
        partial=compatible && preparation && preparationQueue.changedIds!==null;
        if(partial){preparationQueue.invalidate(preparationQueue.changedIds);sceneInputs=inputs;sceneInputs.quality=preparation.lowestQuality;}
        else {
        preparationQueue.restart();
        stats.sceneEnumerations=preparationQueue.enumerations;
        stats.sceneObjects=preparationQueue.entries.length;
        for (const [id,record] of records) if (!preparationQueue.ids.has(id)
          || (!['shape','connector','stroke'].includes(items[id]?.kind) && !isRasterText(items[id]))) {
          if (record.paintedBounds) damage.push(record.paintedBounds);
          destroyRecord(record); records.delete(id);
        }
        const hidden = new Set(previewStrokes.map(stroke => String(stroke.id)));
        if (draft?.id) hidden.add(String(draft.id));
        preparation = { slots:new Array(preparationQueue.entries.length), count:0, hidden,
          targetRatio:desiredRatio, pixelBudget:Math.min(2_000_000,profile.scenePixelBudget/Math.max(1,preparationQueue.entries.length)),
          lowestQuality:Infinity };
        worldPaintBounds=null;
        preparationQueue.entries.forEach(([id],index)=>{
          const record=records.get(id);
          if (!record) return;
          if (hidden.has(id)) {
            if (!record.hidden && record.paintedBounds) damage.push(record.paintedBounds);
            record.hidden=true;if(record.sprite)record.sprite.visible=false;
          } else if (!record.hidden) {
            preparation.slots[index]=record;preparation.count++;expandBounds(record.paintedBounds);
            if(record.sprite)record.sprite.zIndex=index;
          }
        });
        if (previousOrder !== preparationQueue.orderKey && !damage.length) {
          for (const record of preparation.slots) if(record)damage.push(record.paintedBounds);
        }
        previousOrder=preparationQueue.orderKey;
        sceneInputs=inputs;sceneInputs.quality=desiredRatio;
        stats.preparationPasses=(stats.preparationPasses||0)+1;
        }
      }
      const { slots:ordered, hidden, targetRatio, pixelBudget } = preparation;
      const worldKey = `${world.width}:${world.height}`;
      const preparedThisFrame=preparationQueue.run((id,item,index)=>{
        if ((!['shape','connector','stroke'].includes(item?.kind) && !isRasterText(item)) || hidden.has(id)) return;
        let record=records.get(id);
        const routeVersion = item.kind === 'connector' ? `${routingRevision}:${metricsRevision}`
          : item.kind==='text' ? `${textAppearance.font}:${textAppearance.color}:${metricsRevision}` : '';
        const changed = !record || !sameRasterInput(record.item,item) || record.worldKey !== worldKey || record.routeVersion !== routeVersion;
        const tint=flatRectangleTint(item);
        const descriptor=changed?rasterDescriptor(id,tintRasterItem(item,tint),world,referenceItems,routeVersion):record.descriptor;
        if(changed)stats.descriptorsUpdated++;
        if(!descriptor)return;
        const key=descriptor.key;
        const qualityNeeded=record && !cameraActive && targetRatio>record.quality*1.25;
        const rebuild = !record || record.key !== key || record.graphicsQuality !== quality || qualityNeeded
          || (record.pixelBudget > pixelBudget*1.1 && record.raster.pixelWidth*record.raster.pixelHeight > pixelBudget*1.1);
        if (rebuild) {
          const sprite=gpu?record?.sprite:null;
          if (record) {damage.push(record.paintedBounds);if(sprite)resources.release(record.resource);else destroyRecord(record);}
          const resourceKey=key+':'+targetRatio+':'+Math.round(pixelBudget);
          const resource=resources.acquire(resourceKey,()=>{
            stats.rasterizations++;
            const raster=rasterizeObject(id,descriptor,world,referenceItems,targetRatio,pixelBudget,textAppearance);
            raster.pixelWidth=raster.canvas.width;raster.pixelHeight=raster.canvas.height;
            return raster;
          });
          if(!resource.textureHandle){
            resource.textureHandle=atlas.allocate(resource.raster.canvas);
            if(resource.textureHandle.page){
              resource.raster.canvas.width=resource.raster.canvas.height=1;
              resource.raster.canvas=null;
            }
          }
          record = { key, graphicsQuality:quality, quality:targetRatio, pixelBudget, raster:resource.raster, resource,sprite };
          if(sprite)sprite.texture=resource.textureHandle.texture;
          records.set(id,record);
        } else stats.cacheHits++;
        if(changed || rebuild || record.hidden){
          if(record.paintedBounds)damage.push(record.paintedBounds);
          record.paintedBounds=paintBounds(descriptor,record.raster);damage.push(record.paintedBounds);
          expandBounds(record.paintedBounds);
        }
        record.item=item;record.worldKey=worldKey;record.routeVersion=routeVersion;
        record.descriptor=descriptor;record.tint=tint;record.hidden=false;
        preparation.lowestQuality=Math.min(preparation.lowestQuality,record.quality);
        const raster=record.raster;
        if(gpu){
          const newSprite=!record.sprite;
          if(newSprite){
            record.resource.textureHandle ||= atlas.allocate(raster.canvas);
            record.sprite=new Sprite(record.resource.textureHandle.texture);
            record.sprite.eventMode='none';app.stage.addChild(record.sprite);
          }
          const sprite=record.sprite;
          if(changed || rebuild || newSprite){
            sprite.tint=record.tint===null?0xffffff:record.tint;
            sprite.width=raster.width;sprite.height=raster.height;
            sprite.pivot.set((descriptor.centerX-raster.left)*raster.pixelWidth/raster.width,(descriptor.centerY-raster.top)*raster.pixelHeight/raster.height);
            sprite.position.set(descriptor.x+descriptor.centerX,descriptor.y+descriptor.centerY);
            sprite.rotation=descriptor.rotation*Math.PI/180;
          }
          sprite.visible=true;sprite.zIndex=index;
        }
        if(!ordered[index])preparation.count++;
        ordered[index]=record;
      });
      const deferredQuality=preparationQueue.pending;
      stats.preparedThisFrame=preparedThisFrame;stats.preparationCursor=preparationQueue.cursor;
      stats.preparationVisited=(stats.preparationVisited||0)+preparedThisFrame;
      if(!deferredQuality){
        if(!partial){worldPaintBounds=null;for(const record of ordered)if(record)expandBounds(record.paintedBounds);}
        sceneInputs.quality=Number.isFinite(preparation.lowestQuality)?preparation.lowestQuality:targetRatio;
      }
      let drawn = 0;
      if (gpu) {
        atlas.flush(); stats.texturePages = atlas.pages.length;
        app.stage.position.set(camera.x,camera.y); app.stage.scale.set(camera.scale);
        app.renderer.render(app.stage); drawn = preparation.count;
        previousPaintKey = '';
      } else {
        const bufferWidth=Math.round((width+margin*2)*ratio),bufferHeight=Math.round((height+margin*2)*ratio);
        if(buffer.width!==bufferWidth || buffer.height!==bufferHeight){buffer.width=bufferWidth;buffer.height=bufferHeight;bufferCamera=null;}
        if(!bufferFits || !bufferCamera || bufferCamera.scale!==camera.scale){bufferCamera={...camera};previousPaintKey='';}
        const paintCamera={...bufferCamera,x:bufferCamera.x+margin,y:bufferCamera.y+margin};
        const bufferKey=`${width}:${height}:${ratio}:${bufferCamera.x}:${bufferCamera.y}:${camera.scale}`;
        const region = mergeDamage(damage,2/Math.max(.01,camera.scale));
        const fullPaint = bufferKey !== previousPaintKey || (region && (region.maxX-region.minX)*(region.maxY-region.minY)*camera.scale**2 > width*height*.45);
        if (fullPaint || region) {
          bufferContext.setTransform(1,0,0,1,0,0);
          if (fullPaint) bufferContext.clearRect(0,0,buffer.width,buffer.height);
          bufferContext.save();
          if (!fullPaint) {
            // Clip to whole device pixels: fractional edges retain old alpha and
            // blend it with the new frame, leaving seams beside changed objects.
            const left = Math.floor((region.minX*camera.scale+paintCamera.x)*ratio);
            const top = Math.floor((region.minY*camera.scale+paintCamera.y)*ratio);
            const right = Math.ceil((region.maxX*camera.scale+paintCamera.x)*ratio);
            const bottom = Math.ceil((region.maxY*camera.scale+paintCamera.y)*ratio);
            region.minX = (left/ratio-paintCamera.x)/camera.scale;
            region.minY = (top/ratio-paintCamera.y)/camera.scale;
            region.maxX = (right/ratio-paintCamera.x)/camera.scale;
            region.maxY = (bottom/ratio-paintCamera.y)/camera.scale;
            bufferContext.beginPath(); bufferContext.rect(left,top,right-left,bottom-top); bufferContext.clip();
            bufferContext.clearRect(left,top,right-left,bottom-top);
          }
          bufferContext.setTransform(ratio*camera.scale,0,0,ratio*camera.scale,ratio*paintCamera.x,ratio*paintCamera.y);
          for (const record of ordered) {
            if (!record) continue;
            if (!fullPaint && !overlaps(record.paintedBounds,region)) continue;
            const descriptor=record.descriptor,raster=record.raster;
            bufferContext.save(); bufferContext.translate(descriptor.x+descriptor.centerX,descriptor.y+descriptor.centerY);
            bufferContext.rotate(descriptor.rotation*Math.PI/180);
            const handle=record.resource.textureHandle;
            if(record.tint!==null){bufferContext.fillStyle=record.item.fill;bufferContext.fillRect(-descriptor.centerX,-descriptor.centerY,Number(record.item.width)*world.width,Number(record.item.height)*world.height);}
            else if(handle?.page)bufferContext.drawImage(handle.page.canvas,handle.slot.x+2,handle.slot.y+2,raster.pixelWidth,raster.pixelHeight,raster.left-descriptor.centerX,raster.top-descriptor.centerY,raster.width,raster.height);
            else bufferContext.drawImage(raster.canvas,raster.left-descriptor.centerX,raster.top-descriptor.centerY,raster.width,raster.height);
            bufferContext.restore(); drawn++;
          }
          bufferContext.restore();bufferVersion++;
        }
        previousPaintKey = bufferKey; element.dataset.renderer = 'canvas2d';blitBuffer();
      }
      stats.drawnObjects += drawn; stats.lastDrawnObjects = drawn; stats.visibleObjects = preparation.count;
      stats.sharedRasters=resources.live.size;stats.retainedRasters=resources.idle.size;
      stats.texturePages=atlas.pages.length;
      stats.frames++;
      stats.preparing=deferredQuality;stats.deferredFrames=(stats.deferredFrames||0)+Number(deferredQuality);
      ensureGpu();
      if (deferredQuality) schedule();
    };
    const schedule = () => { if (!disposed && frame === null) frame = requestAnimationFrame(render); };
    const metricsChanged = event => { if(Array.isArray(event?.changedItemIds) && !types.texts && !types.connectors)return;metricsRevision++;textAppearanceCache=null; schedule(); };
    renderer.current = schedule;
    latest.current.onReady?.(value => { draft = value; schedule(); });
    const observer = new ResizeObserver(([entry])=>{viewportMetrics={width:entry.contentRect.width,height:entry.contentRect.height};schedule();}); observer.observe(element);
    const themeObserver=new MutationObserver(metricsChanged);const themeRoot=element.closest('[data-theme]');if(themeRoot)themeObserver.observe(themeRoot,{attributes:true,attributeFilter:['data-theme']});
    const stage=element.closest('.canvas-stage');
    const cameraChanged=()=>{if(frame!==null){cancelAnimationFrame(frame);frame=null;}render();};
    stage?.addEventListener('agora-camera',cameraChanged);
    window.addEventListener(CONNECTOR_METRICS_EVENT,metricsChanged);
    document.fonts?.addEventListener('loadingdone',metricsChanged);
    element.dataset.renderer = 'canvas2d';schedule();
    return () => {
      disposed = true;clearTimeout(cameraIdleTimer); if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();themeObserver.disconnect();stage?.removeEventListener('agora-camera',cameraChanged); window.removeEventListener(CONNECTOR_METRICS_EVENT,metricsChanged);
      document.fonts?.removeEventListener('loadingdone',metricsChanged);
      latest.current.onReady?.(null); renderer.current = null;
      for (const record of records.values()) destroyRecord(record);
      records.clear(); resources.destroy(); atlas.destroy(); app?.destroy(true,{children:true});
      // A pending init releases its slot after completion.
      if (!pendingApp) releaseGpu?.();
      compositor?.destroy();buffer.width=buffer.height=1;buffer.remove();ink.destroy(); canvas.remove();
    };
  }, []);
  useLayoutEffect(() => { renderer.current?.(); });
  return <div className="vector-layer" style={props.style} ref={host} aria-label="깊이별 벡터 캔버스" />;
}
