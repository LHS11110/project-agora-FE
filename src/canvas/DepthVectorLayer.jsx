import {needsFreshWorkerFrame} from './wgpu/workerFramePolicy.js';
import CameraIdleTask from './CameraIdleTask.js';
import RasterPaintIndex from './RasterPaintIndex.js';
import {isRasterCode} from './codePreviewMetrics.js';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { shapeFillOpacity } from './shapeAppearance.js';
import ImagePreviewCache, { loadImagePreview } from './ImagePreviewCache.js';
import { apiUrl } from '../api/client.js';
import { observeGpuContextLoss } from './gpuLayerLifecycle.js';
import { UNIFIED_GRAPHICS_PROFILE, graphicsResolution, graphicsRasterRatio } from './graphicsQuality.js';
import { changedItemIds } from './itemSnapshots.js';
import ScenePreparationQueue from './ScenePreparationQueue.js';
import { flatRectangleTint } from './flatShapeTint.js';
import WorkerFrameCompositor from './WorkerFrameCompositor.js';
import { rasterViewportRegion } from './rasterViewportRegion.js';
import { hasHardwareWebGL } from './gpuCapability.js';
import { cachedCameraProjection } from './cachedCameraProjection.js';
import { memo, useLayoutEffect, useRef } from 'react';
import { createWgpuRenderer, WgpuSceneBatcher } from './wgpu/wgpuEngine.js';
import { createInkStrokeRenderer, hasStrokeItems } from './inkStrokeRenderer.js';
import { CONNECTOR_METRICS_EVENT } from './connectors/objectMetrics.js';
import { acquireGpuSlot, rasterDescriptor, rasterizeObject, rasterWorldArea, sameRasterInput } from './rasterObjectCache.js';
import { RasterTextureAtlas } from './textureAtlas.js';
import SharedRasterCache from './SharedRasterCache.js';
import { isRasterContent as isRasterText } from './plainTextRaster.js';
import { mergeDamage, overlaps, paintBounds } from './renderDamage.js';
import '../components/vector-layer.css';

const EMPTY_PREVIEWS = [];
const EMPTY_ITEMS={};

const DepthVectorLayer = memo(function DepthVectorLayer(props) {
  useUiLocale();
  const host = useRef(null), renderer = useRef(null), latest = useRef(props);
  latest.current = props;
  useLayoutEffect(() => {
    const element = host.current, canvas = document.createElement('canvas');
    element.appendChild(canvas);
    canvas.style.display='none';
    const viewportContext=canvas.getContext('2d',{alpha:true,desynchronized:true});
    const buffer=document.createElement('canvas'),bufferContext=buffer.getContext('2d',{alpha:true,desynchronized:true});
    let scrollBuffer = null, scrollBufferContext = null;
    const margin=128;
    buffer.className='vector-composite-surface';element.insertBefore(buffer,canvas);
    let compositor=null,bufferVersion=0,surfaceChanged=false,worldPaintBounds=null,bufferCamera=null,previousPaintCamera=null,previousPaintRatio=0,sceneInputs=null,lastCamera=null,cameraIdleTimer=null,budgetIdleTimer=null,refreshCamera=false,cameraActive=false,cameraIdlePending=false,viewportMetrics=null,textAppearanceCache=null,inkHasContent=false,inkVisibleCount=0,settledDesiredRatio=null,dragPreview=null,previousDragPreview=null,lastGpuCullKey='';
    const activeDragPainted=new Map();
    // The ink renderer asks for a pass when a released drag overlay times out.
    // A request made during ink.render() must survive the key update that follows it.
    let inkRerender = false;
    const ink = createInkStrokeRenderer(element, canvas, { requestRender: () => { inkRerender = true; schedule(); } });
    const records = new Map();
    const clippedConnectors = new Set();
    const paintIndex = new RasterPaintIndex();
    const preparationQueue = new ScenePreparationQueue();
    let preparation = null;
    const readyImageIds = new Set();
    const createImagePreviews = () => new ImagePreviewCache(
      (source, signal) => loadImagePreview(source, latest.current.token, apiUrl, signal, UNIFIED_GRAPHICS_PROFILE.imagePreviewSize),
      (source, ids) => {
        for (const id of ids) if (latest.current.items[id]?.__imagePreview === source) readyImageIds.add(id);
        schedule();
      });
    let previewToken = props.token, previewEpoch = 0, imagePreviews = createImagePreviews();
    const atlas = new RasterTextureAtlas();
    const resources = new SharedRasterCache(resource => {
      if(resource.textureHandle) atlas.release(resource.textureHandle);
      if(resource.raster.canvas)resource.raster.canvas.width=resource.raster.canvas.height=1;
    });
    const stats = element.__agoraRenderStats = { frames: 0, rasterizations: 0, cacheHits: 0, descriptorsUpdated: 0, drawnObjects: 0, texturePages: 0 };
    let stopGpuEvents = () => {};
    let gpuCanvas;
    const gpuBatcher = new WgpuSceneBatcher();
    let app, pendingApp, deferredCandidate, releaseGpu, gpuFailed = false, gpuSceneDirty = false, paintIndexValid = true, preparedSinceGpuSync = 0, disposed = false, frame = null, draft;
    let types={items:null,kinds:new Map(),texts:0,connectors:0};
    let fontRevision=0,metricsRevision = 0, inkKey = '', previousPreviews,previousDraft,previousInkItems, previousPaintKey = '', previousOrder = '';
    const destroyRecord = record => {
      paintIndex.remove(record);
      resources.release(record.resource);
    };
    // Direct-mode atlas pixels exist only in the GPU worker. Switching renderer
    // (fallback, idle release, a new GPU context) re-rasterizes from the scene.
    const resetRasters = () => {
      for (const record of records.values()) paintIndex.remove(record);
      records.clear(); resources.destroy(); atlas.destroy(); clippedConnectors.clear();
      sceneInputs = null; previousPaintKey = ''; bufferCamera = null; gpuSceneDirty = true; paintIndexValid = false;
    };
    let gpuOnlyRasterSkipped = false;
    const atlasHoldsOnlyGpuPixels = () => atlas.pages.some(page => !page.canvas) || [...atlas.standalone].some(handle => !handle.canvas);
    const ensureWorker=()=>{if(!compositor)compositor=new WorkerFrameCompositor(element,canvas,()=>{surfaceChanged=true;schedule();},stats);};
    // Hidden canvases keep their whole backing store in GPU memory until resized.
    // The pan scroll copy only helps during motion; the composite buffer and its
    // viewport copy are unused once the GPU path presents or the layer is empty.
    const releaseScrollBuffer=()=>{if(scrollBuffer){scrollBuffer.width=scrollBuffer.height=1;scrollBuffer=null;scrollBufferContext=null;}};
    const releaseCanvasSurfaces=()=>{
      releaseScrollBuffer();
      if(buffer.width!==1||buffer.height!==1){buffer.width=buffer.height=1;bufferCamera=null;previousPaintKey='';}
      if(canvas.width!==1||canvas.height!==1)canvas.width=canvas.height=1;
    };
    const fallBackToCanvas = () => {
      if (disposed || gpuFailed) return;
      gpuFailed = true; gpuSceneDirty = false; preparedSinceGpuSync = 0;
      if (deferredCandidate) { deferredCandidate.candidate.destroy(); deferredCandidate.candidate.free(); deferredCandidate = null; }
      if (gpuCanvas) gpuCanvas.style.display = 'none';
      stopGpuEvents();
      if(app?.threaded)app.destroy();
      releaseGpu?.(); releaseGpu = null;
      atlas.direct = false; if (atlasHoldsOnlyGpuPixels()) resetRasters();
      canvas.style.display = 'none'; buffer.style.display = '';
      element.dataset.renderer = 'canvas2d';
      // Repaint all retained records, even if no object or camera has changed.
      sceneInputs = null; previousPaintKey = ''; bufferCamera = null;
      ensureWorker(); schedule();
    };
    const activateCandidate = (candidate, surface) => {
      if (disposed || gpuFailed) { candidate.destroy(); candidate.free(); releaseGpu?.(); releaseGpu = null; return; }
      const adapter = candidate.adapter_name();
      if (/swiftshader|llvmpipe|softpipe|software/i.test(adapter)) {
        candidate.destroy(); candidate.free(); releaseGpu?.(); releaseGpu = null;
        gpuFailed = true; element.dataset.renderer = 'canvas2d'; ensureWorker(); schedule(); return;
      }
      app = candidate; element.__agoraGpuRenderer=app; stats.gpuAdapter = adapter; stats.engine = 'rust-wgpu';stats.renderThread=candidate.threaded?'worker':'main';
      const gl = candidate.threaded?null:surface.getContext('webgl2') || surface.getContext('webgl');
      stats.contextAttributes = candidate.contextAttributes || gl?.getContextAttributes?.() || { alpha: true, antialias: false, premultipliedAlpha: true };
      gpuCanvas = surface;
      element.insertBefore(surface, canvas);
      if(!candidate.threaded){compositor?.destroy();compositor=null;}
      if(candidate.threaded){
        surface.style.display='none';let first=true;
        candidate.onError=error=>{stats.gpuError=error;fallBackToCanvas();};
        candidate.onFrame=()=>{stats.gpuWorkerFrames=(stats.gpuWorkerFrames||0)+1;if(first){first=false;element.dataset.renderer=candidate.backend_kind();surface.style.display=preparation?.count?'':'none';compositor?.destroy();compositor=null;canvas.style.display='none';buffer.style.display='none';releaseCanvasSurfaces();schedule();}else if(gpuSceneDirty)schedule();};
      }else{canvas.style.display = 'none'; buffer.style.display = 'none'; releaseCanvasSurfaces();}
      element.dataset.renderer = candidate.backend_kind();
      if (atlasHoldsOnlyGpuPixels()) resetRasters(); else atlas.resetGpuState();
      atlas.direct = Boolean(candidate.threaded); gpuSceneDirty = true;
      stopGpuEvents = observeGpuContextLoss(surface, () => disposed, fallBackToCanvas);
      schedule();
    };
    // A depth layer that only holds ink/DOM objects should not pin a GPU worker,
    // its surfaces and textures. Release after a grace period; ensureGpu
    // recreates it once vector records return.
    let gpuReleaseTimer=null;
    const releaseIdleGpu=()=>{
      gpuReleaseTimer=null;
      if(disposed||!app||records.size||pendingApp)return;
      stopGpuEvents();stopGpuEvents=()=>{};
      app.onFrame=null;app.onError=null;app.destroy();app.free?.();
      gpuCanvas?.remove();gpuCanvas=null;app=null;delete element.__agoraGpuRenderer;
      releaseGpu?.();releaseGpu=null;
      atlas.direct=false;if(atlasHoldsOnlyGpuPixels())resetRasters();else atlas.resetGpuState();gpuSceneDirty=false;preparedSinceGpuSync=0;lastGpuCullKey='';
      element.dataset.renderer='canvas2d';stats.engine='canvas2d';stats.gpuReleases=(stats.gpuReleases||0)+1;
      sceneInputs=null;previousPaintKey='';bufferCamera=null;schedule();
    };
    const ensureGpu = () => {
      if (!app && deferredCandidate && !cameraActive) {
        const pending = deferredCandidate;
        deferredCandidate = null;
        activateCandidate(pending.candidate, pending.surface);
        return;
      }
      if (app || pendingApp || deferredCandidate || gpuFailed || disposed || !records.size || cameraActive) return;
      if(!navigator.gpu && !hasHardwareWebGL()){gpuFailed=true;element.dataset.renderer='canvas2d';ensureWorker();return;}
      releaseGpu = acquireGpuSlot();
      if (!releaseGpu){ensureWorker();return;}
      const surface = document.createElement('canvas');
      pendingApp = true;
      const ratio = graphicsResolution('high', window.devicePixelRatio);
      createWgpuRenderer(surface, element.clientWidth * ratio, element.clientHeight * ratio).then(candidate => {
        pendingApp = null;
        if (disposed || gpuFailed) { candidate.destroy(); candidate.free(); releaseGpu?.(); releaseGpu = null; return; }
        if (cameraActive) { deferredCandidate = { candidate, surface }; return; }
        activateCandidate(candidate, surface);
      }).catch(error => {
        pendingApp = null; gpuFailed = true; releaseGpu?.(); releaseGpu = null;
        stats.gpuError = String(error);
        if (!disposed) { element.dataset.renderer = 'canvas2d'; ensureWorker(); schedule(); }
      });
    };
    const render = () => {
      frame = null;
      if (disposed) return;
      const { items, referenceItems, worldSize: world, camera, routingRevision = 0, previewStrokes = EMPTY_PREVIEWS, inkItems = EMPTY_ITEMS } = latest.current;
      if (previewToken !== latest.current.token) {
        // Authenticated images belong to the current account/capability scope.
        imagePreviews.destroy(); imagePreviews = createImagePreviews();
        previewToken = latest.current.token; previewEpoch++; readyImageIds.clear();
        for (const [id, record] of records) if (record.item?.__imagePreview) { destroyRecord(record); records.delete(id); }
        sceneInputs = null; previousPaintKey = ''; bufferCamera = null;
      }
      const moved=lastCamera && (lastCamera.x!==camera.x || lastCamera.y!==camera.y || lastCamera.scale!==camera.scale);
      // The quiet period only ends in a frame that saw no camera change. A GPU-stalled
      // frame delays queued wheel/pointer input past 160ms; ending the gesture on the
      // timer alone would start a full-quality re-raster mid-gesture and stall more.
      if(moved){cameraActive=true;cameraIdlePending=false;cameraIdleTimer ||= new CameraIdleTask(()=>{cameraIdlePending=true;schedule();},160);cameraIdleTimer.touch();}
      else if(cameraIdlePending){cameraIdlePending=false;cameraActive=false;refreshCamera=true;releaseScrollBuffer();}
      lastCamera={...camera};
      const settling=refreshCamera;refreshCamera=false;
      const quality='high';
      const profile=UNIFIED_GRAPHICS_PROFILE;
      const ratio=graphicsResolution('high',window.devicePixelRatio);
      stats.graphicsQuality=quality;stats.resolution=ratio;
      if(!textAppearanceCache){const styles=getComputedStyle(element);textAppearanceCache={codeFont:styles.getPropertyValue('--mono').trim()||'ui-monospace,monospace',font:styles.getPropertyValue('--display').trim() || 'serif',color:styles.getPropertyValue('--ink-strong').trim() || '#3c5144'};}
      const textAppearance=textAppearanceCache;
      const width = Math.max(1, viewportMetrics?.width || element.clientWidth), height = Math.max(1, viewportMetrics?.height || element.clientHeight);
      const pixelWidth = Math.round(width*ratio), pixelHeight = Math.round(height*ratio);
      if (!app && deferredCandidate && !cameraActive) {
        const pending = deferredCandidate;
        deferredCandidate = null;
        activateCandidate(pending.candidate, pending.surface);
      }
      const cameraZooming = Boolean(element.closest?.('.canvas-stage')?.classList?.contains('camera-zooming'));
      const gpu = app && !gpuFailed && (!app.threaded || app.hasFrame);
      if (gpu && (app.width() !== pixelWidth || app.height() !== pixelHeight)) app.resize(pixelWidth,pixelHeight);
      const canReuseWorkerFrame = (hasPendingGpuSync = false) => {
        if(needsFreshWorkerFrame({moving:cameraActive,changed:moved,hasFrame:app.hasFrame}))return false;
        if (!app.threaded || !app.hasFrame || hasPendingGpuSync || gpuSceneDirty || app.scene || app.uploads?.size || app.removed?.size || app.inFlight || app.preparing || app.needsFrame) return false;
        const prev = app.presented;
        if (!prev || prev.version !== app.version) return false;
        if (width !== prev.viewportWidth || height !== prev.viewportHeight) return false;
        const expectedW = Math.round((width + prev.margin * 2) * ratio);
        const expectedH = Math.round((height + prev.margin * 2) * ratio);
        const surfaceW = prev.bitmap.width || app.canvas?.width || 0;
        const surfaceH = prev.bitmap.height || app.canvas?.height || 0;
        if (surfaceW !== expectedW || surfaceH !== expectedH) return false;
        const scaleRatio = camera.scale / prev.camera.scale;
        if (settling && Math.abs(scaleRatio - 1) > 1e-4) return false;
        const minReuseScale = cameraZooming ? 0.9 : 0.95;
        const maxReuseScale = cameraZooming ? 1.12 : 1.05;
        if (scaleRatio < minReuseScale || scaleRatio > maxReuseScale) return false;
        const safeEdge = cameraActive ? 4 : Math.min(64, prev.margin * 0.25);
        const left = camera.x - (prev.camera.x + prev.margin) * scaleRatio;
        const top = camera.y - (prev.camera.y + prev.margin) * scaleRatio;
        const right = left + (prev.viewportWidth + prev.margin * 2) * scaleRatio;
        const bottom = top + (prev.viewportHeight + prev.margin * 2) * scaleRatio;
        return left <= -safeEdge && top <= -safeEdge && right >= width + safeEdge && bottom >= height + safeEdge;
      };
      const presentGpu = (hasPendingGpuSync = false) => {
        if (!app.threaded || app.hasFrame) {
          const display=preparation?.count?'':'none';
          if(gpuCanvas.style.display!==display)gpuCanvas.style.display=display;
        }
        if (canReuseWorkerFrame(hasPendingGpuSync) || (app.threaded && app.hasFrame && gpuSceneDirty && (app.inFlight || app.preparing))) {
          app.target = { camera: { x: camera.x, y: camera.y, scale: camera.scale }, viewportWidth: width, viewportHeight: height };
          app.project();
          stats.presentedCamera = { x: camera.x, y: camera.y, scale: camera.scale };
          return;
        }
        if (app.threaded) app.interactive = cameraActive;
        if (!app.render_frame(camera.x,camera.y,camera.scale,width,height)) throw new Error("GPU surface unavailable");
        stats.presentedCamera={x:camera.x,y:camera.y,scale:camera.scale};
      };
      const rawDesiredRatio = graphicsRasterRatio('high', camera.scale, window.devicePixelRatio);
      const quantizedDesiredRatio = Math.min(profile.maxRasterRatio, Math.max(ratio, Math.ceil(rawDesiredRatio * 2) / 2));
      if (!cameraActive || settledDesiredRatio === null) {
        settledDesiredRatio = quantizedDesiredRatio;
      }
      const desiredRatio = settledDesiredRatio;
      const safeScale = Math.max(0.05, camera.scale || 1);
      const padWorld = 256 / safeScale;
      const qStep = Math.max(256, Math.round(padWorld));
      const cullMinX = Math.floor((-camera.x / safeScale - padWorld) / qStep) * qStep;
      const cullMinY = Math.floor((-camera.y / safeScale - padWorld) / qStep) * qStep;
      const cullMaxX = Math.ceil(((width - camera.x) / safeScale + padWorld) / qStep) * qStep;
      const cullMaxY = Math.ceil(((height - camera.y) / safeScale + padWorld) / qStep) * qStep;
      const gpuCullBounds = { minX: cullMinX, minY: cullMinY, maxX: cullMaxX, maxY: cullMaxY };
      const gpuCullKey = `${cullMinX}:${cullMinY}:${cullMaxX}:${cullMaxY}`;
      const getEffectivePaintBounds = () => {
        if (!activeDragPainted.size) return worldPaintBounds;
        let minX = worldPaintBounds ? worldPaintBounds.minX : Infinity;
        let minY = worldPaintBounds ? worldPaintBounds.minY : Infinity;
        let maxX = worldPaintBounds ? worldPaintBounds.maxX : -Infinity;
        let maxY = worldPaintBounds ? worldPaintBounds.maxY : -Infinity;
        for (const b of activeDragPainted.values()) {
          if (b.minX < minX) minX = b.minX;
          if (b.minY < minY) minY = b.minY;
          if (b.maxX > maxX) maxX = b.maxX;
          if (b.maxY > maxY) maxY = b.maxY;
        }
        return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : worldPaintBounds;
      };
      const projection=cachedCameraProjection(bufferCamera,camera,width,height,margin,getEffectivePaintBounds());
      const bufferFits=Boolean(projection);
      const blitBuffer=()=>{
        const paintBoundsBox = getEffectivePaintBounds();
        stats.presentedCamera={x:camera.x,y:camera.y,scale:camera.scale};
        const region=rasterViewportRegion(paintBoundsBox,camera,width,height);
        const projection=cachedCameraProjection(bufferCamera,camera,width,height,margin,paintBoundsBox);
        const sourceCrop=bufferCamera?rasterViewportRegion(paintBoundsBox,{...bufferCamera,x:bufferCamera.x+margin,y:bufferCamera.y+margin},buffer.width/ratio,buffer.height/ratio,1):null;
        const pixelCrop=sourceCrop?{x:Math.floor(sourceCrop.x*ratio),y:Math.floor(sourceCrop.y*ratio),width:Math.ceil(sourceCrop.width*ratio),height:Math.ceil(sourceCrop.height*ratio)}:null;
        const interactiveMotion = cameraActive || Boolean(dragPreview?.ids?.size);
        if(!interactiveMotion && compositor?.send({width,height,ratio,region,projection,sourceCrop:pixelCrop,version:bufferVersion},buffer)){buffer.style.display='none';canvas.style.display='none';return;}
        if(compositor?.active && compositor.canvas){compositor.canvas.style.display='none';compositor.active=false;}
        if(!region||!projection){buffer.style.display='none';canvas.style.display='none';stats.outputPixels=0;return;}
        if(interactiveMotion){
          canvas.style.display='none';
          buffer.style.display='';
          buffer.style.width=`${buffer.width/ratio}px`;
          buffer.style.height=`${buffer.height/ratio}px`;
          buffer.style.transformOrigin='top left';
          buffer.style.transform=`translate3d(${projection.x}px,${projection.y}px,0) scale(${projection.scale})`;
          stats.outputPixels=buffer.width*buffer.height;
          stats.compositePanFrames=(stats.compositePanFrames||0)+1;
          return;
        }
        buffer.style.display='none';
        const outputWidth=Math.max(1,Math.round(region.width*ratio)),outputHeight=Math.max(1,Math.round(region.height*ratio));
        if(canvas.width!==outputWidth || canvas.height!==outputHeight){canvas.width=outputWidth;canvas.height=outputHeight;}
        canvas.style.display='';canvas.style.width=`${region.width}px`;canvas.style.height=`${region.height}px`;
        canvas.style.transform=`translate3d(${region.x}px,${region.y}px,0)`;
        viewportContext.setTransform(1,0,0,1,0,0);viewportContext.clearRect(0,0,canvas.width,canvas.height);
        viewportContext.drawImage(buffer,(region.x-projection.x)*ratio/projection.scale,(region.y-projection.y)*ratio/projection.scale,region.width*ratio/projection.scale,region.height*ratio/projection.scale,0,0,canvas.width,canvas.height);
        stats.outputPixels=canvas.width*canvas.height;
        stats.compositePanFrames=(stats.compositePanFrames||0)+1;
      };
      if(types.items!==items){
        const changed=changedItemIds(types.items,items);
        if(changed===null){types={items,kinds:new Map(),texts:0,connectors:0};for(const [id,item] of Object.entries(items||{})){const kind=isRasterText(item)?'rasterText':item.kind;types.kinds.set(id,kind);if(kind==='rasterText')types.texts++;if(kind==='connector')types.connectors++;}}
        else{for(const id of changed){const before=types.kinds.get(id),item=items[id],after=isRasterText(item)?'rasterText':item?.kind;if(before==='rasterText')types.texts--;if(before==='connector')types.connectors--;if(item)types.kinds.set(id,after);else types.kinds.delete(id);if(after==='rasterText')types.texts++;if(after==='connector')types.connectors++;}types.items=items;}
      }
      const hasAnyInk=Boolean(draft || previewStrokes?.length || hasStrokeItems(inkItems));
      const activeDrag = dragPreview?.ids?.size ? dragPreview : null;
      const dragPx = activeDrag ? { ids: activeDrag.ids, dx: (activeDrag.dx || 0) * world.width, dy: (activeDrag.dy || 0) * world.height } : null;
      const dragMatchesInk = Boolean(activeDrag && hasAnyInk && [...activeDrag.ids].some(id => inkItems?.[id]));
      const prevMatchesInk = Boolean(previousDragPreview?.ids && inkHasContent && [...previousDragPreview.ids].some(id => inkItems?.[id]));
      const dragInkChanged = dragPreview !== previousDragPreview && (dragMatchesInk || prevMatchesInk);
      if(hasAnyInk || inkHasContent){
        const nextInkKey=`${quality}:${ratio}:${width}:${height}:${world.width}:${world.height}:${camera.x}:${camera.y}:${camera.scale}:${cameraActive?1:0}`;
        if(inkRerender || nextInkKey!==inkKey || previousPreviews!==previewStrokes || previousDraft!==draft || previousInkItems!==inkItems || dragInkChanged){
          inkRerender=false;
          inkVisibleCount = ink.render({items:inkItems,previews:previewStrokes,draft,dragPreview:activeDrag,width:world.width,height:world.height,viewportWidth:width,viewportHeight:height,camera,pixelRatio:ratio,interactive:cameraActive}) || 0;
          inkKey=nextInkKey;previousPreviews=previewStrokes;previousDraft=draft;previousInkItems=inkItems;
          inkHasContent=hasAnyInk;
          stats.inkFrames=(stats.inkFrames||0)+1;
          stats.inkObjects=inkVisibleCount;
          stats.visibleObjects=(preparation?.count||0)+inkVisibleCount;
          if(!(preparation?.count>0))stats.presentedCamera={x:camera.x,y:camera.y,scale:camera.scale};
        }
      }else if(previousPreviews!==previewStrokes || previousDraft!==draft || previousInkItems!==inkItems){
        previousPreviews=previewStrokes;previousDraft=draft;previousInkItems=inkItems;
        inkVisibleCount=0;
        stats.inkObjects=0;
      }
      const dragMatchesVector = Boolean(activeDrag && [...activeDrag.ids].some(id => records.has(id)));
      const prevMatchesVector = Boolean(previousDragPreview?.ids && [...previousDragPreview.ids].some(id => records.has(id)));
      const dragVectorChanged = dragPreview !== previousDragPreview && (dragMatchesVector || prevMatchesVector);
      const hiddenKey = (!previewStrokes.length && !draft?.id) ? '' : [...previewStrokes.map(stroke=>String(stroke.id)),...(draft?.id?[String(draft.id)]:[])].filter(id=>items[id]).sort().join('|');
      const inputs=[items,types.connectors?routingRevision:0,world.width,world.height,types.connectors?routingRevision:0,types.connectors?metricsRevision:0,hiddenKey,null,ratio,width,height,types.texts?textAppearance.font:'',types.texts?textAppearance.color:'',null,quality,types.texts?fontRevision:0];
      const unchanged=sceneInputs && inputs.every((value,i)=>value===sceneInputs[i]);
      if(sceneInputs && !unchanged){const names=['items','references','worldWidth','worldHeight','routing','metrics','previews','draft','ratio','width','height','font','color','gpu','graphicsQuality','fonts'];for(let i=0;i<inputs.length;i++)if(inputs[i]!==sceneInputs[i]){stats.refreshReasons ||= {};stats.refreshReasons[names[i]]=(stats.refreshReasons[names[i]]||0)+1;}}
      const qualityRefresh = sceneInputs && desiredRatio > sceneInputs.quality * 1.15;
      if (clippedConnectors.size) {
        const vx0=-camera.x/safeScale,vy0=-camera.y/safeScale,vx1=(width-camera.x)/safeScale,vy1=(height-camera.y)/safeScale;
        const stale=[];
        for (const id of clippedConnectors) {
          const record=records.get(id),clip=record?.clip;
          if (!clip) { clippedConnectors.delete(id); continue; }
          if (!record.clipStale && (vx0<clip.minX||vy0<clip.minY||vx1>clip.maxX||vy1>clip.maxY)) { record.clipStale=true; stale.push(id); }
        }
        if (stale.length) preparationQueue.invalidate(stale);
      }
      const pending = preparationQueue.pending;
      const imagesChanged = readyImageIds.size > 0;
      const zoomRatio=bufferCamera && camera.scale>0 && bufferCamera.scale>0 ? camera.scale/bufferCamera.scale : 0;
      const keepZoomedBuffer=false;
      const scaleSettling=!gpu && Boolean(bufferCamera && (zoomRatio<0.96 || zoomRatio>1.04));
      const cullChanged = Boolean(gpu && (preparation?.count || 0) > 256 && gpuCullKey !== lastGpuCullKey);
      if (cullChanged) gpuSceneDirty = true;
      const needsFirstWorkerGpuFrame = Boolean(!cameraActive && app?.threaded && !app.hasFrame && !gpuFailed && !app.inFlight && !app.preparing && gpuSceneDirty);
      if(unchanged && !pending && !imagesChanged && !qualityRefresh && !surfaceChanged && !moved && !settling && !scaleSettling && !dragVectorChanged && !(gpu && gpuSceneDirty) && !needsFirstWorkerGpuFrame && (gpu || bufferFits)){previousDragPreview=dragPreview;return;}
      surfaceChanged=false;
      if(unchanged && (!pending || (!gpu && keepZoomedBuffer)) && !imagesChanged && !qualityRefresh && !scaleSettling && !dragVectorChanged && (gpu || bufferFits)){
        if(gpu){
          try {
            let didSync = false;
            if (gpuSceneDirty && (!app.threaded || (!app.inFlight && !app.preparing))) {
              atlas.flush(app); stats.texturePages = atlas.pages.length;
              stats.lastDrawnObjects = gpuBatcher.sync(app, preparation.slots, dragPx, preparation.count > 256 ? gpuCullBounds : null);
              lastGpuCullKey = gpuCullKey;
              gpuSceneDirty = false; preparedSinceGpuSync = 0; didSync = true;
            }
            presentGpu(didSync);
          } catch { fallBackToCanvas(); return; }
        } else {
          blitBuffer();
          if (needsFirstWorkerGpuFrame) {
            try {
              atlas.flush(app); gpuBatcher.sync(app, preparation.slots, dragPx, preparation.count > 256 ? gpuCullBounds : null);
              lastGpuCullKey = gpuCullKey;
              gpuSceneDirty = false; preparedSinceGpuSync = 0; presentGpu();
            } catch (error) { stats.gpuError = String(error); fallBackToCanvas(); }
          }
        }
        stats.frames++;stats.cachedPanFrames=(stats.cachedPanFrames||0)+1;stats.lastDrawnObjects=gpu?preparation.count:0;
        previousDragPreview=dragPreview;return;
      }
      const damage = [];
      if (dragVectorChanged && !gpu) {
        const dirtyDragIds = new Set([...(previousDragPreview?.ids || []), ...(activeDrag?.ids || [])]);
        for (const id of dirtyDragIds) {
          const prevBox = activeDragPainted.get(id);
          const rec = records.get(id);
          if (prevBox) damage.push(prevBox);
          else if (rec?.paintedBounds) damage.push(rec.paintedBounds);
          if (rec?.paintedBounds && dragPx?.ids.has(id)) {
            const shifted = { minX: rec.paintedBounds.minX + dragPx.dx, minY: rec.paintedBounds.minY + dragPx.dy, maxX: rec.paintedBounds.maxX + dragPx.dx, maxY: rec.paintedBounds.maxY + dragPx.dy };
            damage.push(shifted);
            activeDragPainted.set(id, shifted);
          } else {
            activeDragPainted.delete(id);
          }
        }
      }
      if (unchanged && dragVectorChanged && !pending && !imagesChanged && !qualityRefresh && !scaleSettling && (gpu || bufferFits)) {
        if (gpu) {
          gpuSceneDirty = true;
          try {
            let didSync = false;
            if (!app.threaded || (!app.inFlight && !app.preparing)) {
              stats.lastDrawnObjects = gpuBatcher.sync(app, preparation.slots, dragPx, preparation.count > 256 ? gpuCullBounds : null);
              lastGpuCullKey = gpuCullKey;
              gpuSceneDirty = false; preparedSinceGpuSync = 0; didSync = true;
            }
            presentGpu(didSync);
          } catch { fallBackToCanvas(); return; }
          stats.frames++; previousDragPreview = dragPreview; return;
        }
      }
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
      let structuralGpuChange = false;
      const computeScenePixelBudget = () => {
        const effectiveCount = Math.max(1, preparationQueue.entries.length, Math.min(4096, records.size + resources.idle.size));
        const raw = Math.min(2_000_000, profile.scenePixelBudget / effectiveCount);
        return 2 ** Math.floor(Math.log2(Math.max(64, raw)));
      };
      if (!unchanged || qualityRefresh || imagesChanged) {
        const compatible=sceneInputs && !qualityRefresh && inputs.every((value,i)=>i===0 || value===sceneInputs[i]);
        preparationQueue.setItems(items);
        partial=compatible && preparation && (unchanged || preparationQueue.changedIds!==null);
        if(partial){const nextBudget=computeScenePixelBudget();if(nextBudget<preparation.pixelBudget*.8){clearTimeout(budgetIdleTimer);budgetIdleTimer=setTimeout(()=>{sceneInputs=null;schedule();},240);}preparation.pixelBudget=nextBudget;preparationQueue.invalidate([...new Set([...(unchanged ? [] : preparationQueue.changedIds), ...[...readyImageIds].filter(id=>preparationQueue.positions.has(id))])]);sceneInputs=inputs;sceneInputs.quality=preparation.lowestQuality;}
        else {
        preparationQueue.restart();
        stats.sceneEnumerations=preparationQueue.enumerations;
        stats.sceneObjects=preparationQueue.entries.length;
        for (const [id,record] of records) if (!preparationQueue.ids.has(id)
          || (!['shape','connector','stroke'].includes(items[id]?.kind) && !isRasterText(items[id]))) {
          if (record.paintedBounds) damage.push(record.paintedBounds);
          destroyRecord(record); records.delete(id); structuralGpuChange = true;
        }
        const hidden = new Set(previewStrokes.map(stroke => String(stroke.id)));
        if (draft?.id) hidden.add(String(draft.id));
        preparation = { slots:new Array(preparationQueue.entries.length), count:0, hidden,
          targetRatio:desiredRatio, pixelBudget:computeScenePixelBudget(),
          lowestQuality:Infinity };
        worldPaintBounds=null;
        preparationQueue.entries.forEach(([id],index)=>{
          const record=records.get(id);
          if (!record) return;
          if (hidden.has(id)) {
            if (!record.hidden) { structuralGpuChange = true; if (!gpu && record.paintedBounds) damage.push(record.paintedBounds); }
            record.hidden=true;if (paintIndexValid) paintIndex.remove(record);
          } else if (!record.hidden) {
            preparation.slots[index]=record;preparation.count++;
            if (!gpu) { expandBounds(record.paintedBounds); if (paintIndexValid) paintIndex.update(record,index); }
            else paintIndexValid = false;
          }
        });
        if (previousOrder !== preparationQueue.orderKey) {
          structuralGpuChange = true;
          if (!damage.length) for (const record of preparation.slots) if(record)damage.push(record.paintedBounds);
        }
        previousOrder=preparationQueue.orderKey;
        sceneInputs=inputs;sceneInputs.quality=desiredRatio;
        stats.preparationPasses=(stats.preparationPasses||0)+1;
        if(preparationQueue.entries.length>24&&camera.scale>0&&world.width>0&&world.height>0){
          const nMinX=-camera.x/camera.scale/world.width,nMinY=-camera.y/camera.scale/world.height;
          const nMaxX=(width-camera.x)/camera.scale/world.width,nMaxY=(height-camera.y)/camera.scale/world.height;
          const onScreenIds=[];
          for(const [id,item] of preparationQueue.entries){
            if(hidden.has(id)||!item||records.has(id))continue;
            const ix=Number(item.x),iy=Number(item.y);
            if(!Number.isFinite(ix)||!Number.isFinite(iy))continue;
            const iw=Math.max(.05,Number(item.width)||0),ih=Math.max(.05,Number(item.height)||0);
            if(ix+iw>=nMinX&&ix<=nMaxX&&iy+ih>=nMinY&&iy<=nMaxY)onScreenIds.push(id);
          }
          if(onScreenIds.length)preparationQueue.invalidate(onScreenIds);
        }
        }
      }
      readyImageIds.clear();
      const { slots:ordered, hidden, targetRatio, pixelBudget } = preparation;
      const worldKey = `${world.width}:${world.height}`;
      const hadUrgentBeforeRun = preparationQueue.urgent.size > 0;
      let frameRasterizations = 0;
      const incrementalFrame = records.size > 0;
      const frameBudgetMs = cameraActive ? 1.5 : 2.5;
      const maxFrameRasters = cameraActive ? 4 : incrementalFrame ? 8 : 32;
      const qualityRatioThreshold = 1.25;
      const prepStart = performance.now();
      const prepClock = () => (frameRasterizations >= maxFrameRasters ? prepStart + frameBudgetMs + 1 : performance.now());
      const runPrep = unchanged && dragVectorChanged && !pending && !imagesChanged && !qualityRefresh ? 0 : preparationQueue.run((id,item,index)=>{
        if ((!['shape','connector','stroke'].includes(item?.kind) && !isRasterText(item)) || hidden.has(id)) return;
        let record=records.get(id);
        const sameImage = record?.item.__imagePreview === item.__imagePreview;
        let preview = item.__imagePreview ? imagePreviews.peek(item.__imagePreview) : null;
        if (item.__imagePreview && (!sameImage || !record?.previewVersion || !sameRasterInput(record.item, item) || record.worldKey !== worldKey || (!cameraActive && !cameraZooming && targetRatio > record.quality * qualityRatioThreshold) || record.pixelBudget > pixelBudget * 1.1)) {
          const left=Number(item.x)*world.width*camera.scale+camera.x,top=Number(item.y)*world.height*camera.scale+camera.y;
          const visible=left<=width+64&&top<=height+64&&left+Number(item.width)*world.width*camera.scale>=-64&&top+Number(item.height)*world.height*camera.scale>=-64;
          preview = imagePreviews.request(item.__imagePreview, id,visible);
        }
        const previewVersion = preview?.version || (sameImage ? record?.previewVersion : 0) || 0;
        const routeVersion = item.__imagePreview ? `image:${previewEpoch}:${previewVersion}` : item.kind === 'connector'  ? `${routingRevision}:${metricsRevision}`
          : isRasterCode(item)?`${textAppearance.codeFont}:${fontRevision}`:item.kind==='text' ? `${textAppearance.font}:${textAppearance.color}:${fontRevision}` : '';
        const changed = !record || !sameRasterInput(record.item,item) || record.worldKey !== worldKey || record.routeVersion !== routeVersion;
        const tint = changed ? flatRectangleTint(item) : record.tint;
        const descriptor = changed ? rasterDescriptor(id, item, world, referenceItems, routeVersion, { tint }) : record.descriptor;
        if(changed)stats.descriptorsUpdated++;
        if(!descriptor)return;
        const key=descriptor.key;
        const paintChanged = !record || (changed && (record.key!==key || record.tint!==tint || record.descriptor.x!==descriptor.x || record.descriptor.y!==descriptor.y || record.descriptor.rotation!==descriptor.rotation || record.descriptor.centerX!==descriptor.centerX || record.descriptor.centerY!==descriptor.centerY));
        // Sharper re-rasters wait for a still camera: their texture uploads would compete
        // with the zoom frames they are meant to improve.
        const qualityNeeded=!cameraActive && record && targetRatio>record.quality*qualityRatioThreshold;
        const deferPreview = item.__imagePreview && preview?.state !== 'ready' && sameImage && record?.previewVersion;
        const rebuild = !deferPreview && (!record || record.key !== key || qualityNeeded || record.clipStale
          || (record.pixelBudget > pixelBudget*1.1 && record.raster.pixelWidth*record.raster.pixelHeight > pixelBudget*1.1));
        if (rebuild) {
          if (record) {paintIndex.remove(record);damage.push(record.paintedBounds);destroyRecord(record);}
          let clip=null,objectBudget=pixelBudget;
          // Clip only connectors that the shared budget would sample below 60% of the
          // target; the clipped raster is budgeted by its visible area, capped at 4M px.
          const area=item.kind==='connector'?rasterWorldArea(descriptor,referenceItems,world):0;
          if (area && area*targetRatio*targetRatio*.36>pixelBudget) {
            const vw=width/safeScale,vh=height/safeScale,mx=vw*.15,my=vh*.15;
            clip={minX:Math.floor(-camera.x/safeScale-mx),minY:Math.floor(-camera.y/safeScale-my),maxX:Math.ceil((width-camera.x)/safeScale+mx),maxY:Math.ceil((height-camera.y)/safeScale+my)};
            objectBudget=Math.max(pixelBudget,Math.min(2_000_000,area,(vw+2*mx)*(vh+2*my))*targetRatio*targetRatio);
            objectBudget=Math.max(pixelBudget,Math.min(2_000_000,objectBudget));
          }
          const resourceKey=key+':'+targetRatio+':'+Math.round(objectBudget)+(clip?`:${clip.minX},${clip.minY},${clip.maxX},${clip.maxY}`:'');
          const resource=resources.acquire(resourceKey,()=>{
            stats.rasterizations++;
            frameRasterizations++;
            const raster=rasterizeObject(id,descriptor,world,referenceItems,targetRatio,objectBudget,{...textAppearance,smoothingQuality:'high',imagePreview:preview?.canvas,clip});
            raster.pixelWidth=raster.canvas.width;raster.pixelHeight=raster.canvas.height;
            return raster;
          });
          if(!resource.textureHandle){
            resource.textureHandle=atlas.allocate(resource.raster.canvas);
            // A direct slot keeps its canvas until the worker captures it (then frees it).
            if(resource.textureHandle.page){
              if(!resource.textureHandle.direct)resource.raster.canvas.width=resource.raster.canvas.height=1;
              resource.raster.canvas=null;
            }
          }
          record = { id, slotIndex: index, key, quality:targetRatio, pixelBudget, raster:resource.raster, resource, clip };
          if (clip) clippedConnectors.add(id); else clippedConnectors.delete(id);
          records.set(id,record);
          structuralGpuChange = true;
        } else stats.cacheHits++;
        if(paintChanged || rebuild || record.hidden){
          if(!gpu && record.paintedBounds)damage.push(record.paintedBounds);
          record.paintedBounds=paintBounds(descriptor,record.raster);
          if (!gpu) { damage.push(record.paintedBounds); expandBounds(record.paintedBounds); }
          if (paintChanged || record.hidden) structuralGpuChange = true;
        }
        record.id=id;record.slotIndex=index;record.previewVersion=previewVersion;record.item=item;record.worldKey=worldKey;record.routeVersion=routeVersion;
        record.descriptor=descriptor;record.tint=tint;record.hidden=false;
        preparation.lowestQuality=Math.min(preparation.lowestQuality,record.quality);
        if(!ordered[index])preparation.count++;
        ordered[index]=record;
        if (gpu) paintIndexValid = false;
        else paintIndex.update(record,index);
      },frameBudgetMs,prepClock);
      const preparedThisFrame = runPrep;
      const deferredQuality=preparationQueue.pending;
      stats.preparedThisFrame=preparedThisFrame;stats.preparationCursor=preparationQueue.cursor;
      stats.preparationVisited=(stats.preparationVisited||0)+preparedThisFrame;
      if(!deferredQuality){
        if(!partial&&!gpu){worldPaintBounds=null;for(const record of ordered)if(record)expandBounds(record.paintedBounds);}
        sceneInputs.quality=Number.isFinite(preparation.lowestQuality)?preparation.lowestQuality:targetRatio;
      }
      if (structuralGpuChange || preparedThisFrame > 0) {
        gpuSceneDirty = true;
        preparedSinceGpuSync += preparedThisFrame;
      }
      const urgentJustFinished = hadUrgentBeforeRun && preparationQueue.urgent.size === 0;
      const workerBusy = Boolean(app?.threaded && (app.inFlight || app.preparing));
      const syncAllowed = gpuSceneDirty && (
        !app?.threaded
        || (!workerBusy && (
          !deferredQuality
          || urgentJustFinished
          || !app.hasFrame
          || (!qualityRefresh && ordered.length <= 512 && preparedThisFrame > 0)
          || preparedSinceGpuSync >= (ordered.length <= 2048 ? 256 : 2048)
        ))
      );
      let drawn = 0;
      if (gpu) {
        try {
          if (syncAllowed) {
            atlas.flush(app); stats.texturePages = atlas.pages.length;
            drawn = gpuBatcher.sync(app, ordered, dragPx, preparation.count > 256 ? gpuCullBounds : null);
            lastGpuCullKey = gpuCullKey;
            gpuSceneDirty = false; preparedSinceGpuSync = 0;
            presentGpu(true);
          } else {
            drawn = app.threaded ? 0 : preparation.count;
            presentGpu(false);
          }
        } catch (error) { stats.gpuError = String(error); fallBackToCanvas(); return; }
        previousPaintKey = '';
      } else if (preparation.count > 0) {
        if (!paintIndexValid) {
          worldPaintBounds = null;
          for (let i = 0; i < ordered.length; i++) {
            const rec = ordered[i];
            if (rec && !rec.hidden) {
              expandBounds(rec.paintedBounds);
              paintIndex.update(rec, i);
            }
          }
          paintIndexValid = true;
          previousPaintKey = '';
        }
        const bufferWidth=Math.round((width+margin*2)*ratio),bufferHeight=Math.round((height+margin*2)*ratio);
        const prevPaintCamera = previousPaintKey ? previousPaintCamera : null;
        const prevPaintRatio = previousPaintKey ? previousPaintRatio : 0;
        if(buffer.width!==bufferWidth || buffer.height!==bufferHeight){buffer.width=bufferWidth;buffer.height=bufferHeight;bufferCamera=null;previousPaintKey='';}
        const activeBufferFits=Boolean(cachedCameraProjection(bufferCamera,camera,width,height,margin,getEffectivePaintBounds()));
        const region = mergeDamage(damage,2/Math.max(.01,camera.scale));
        let scrollStrips = null;
        if(!activeBufferFits || !bufferCamera || (!cameraZooming && (zoomRatio<0.98 || zoomRatio>1.02))){
          const canScrollReuse = !region && !activeDrag && !cameraZooming && prevPaintCamera && prevPaintRatio === ratio && Math.abs(camera.scale - prevPaintCamera.scale) < 1e-6;
          if (canScrollReuse) {
            const dxPx = Math.round((camera.x - prevPaintCamera.x) * ratio);
            const dyPx = Math.round((camera.y - prevPaintCamera.y) * ratio);
            const ovW = buffer.width - Math.abs(dxPx);
            const ovH = buffer.height - Math.abs(dyPx);
            if ((dxPx !== 0 || dyPx !== 0) && ovW > buffer.width * 0.4 && ovH > buffer.height * 0.4) {
              scrollBuffer ||= document.createElement('canvas');
              if (scrollBuffer.width !== buffer.width || scrollBuffer.height !== buffer.height) {
                scrollBuffer.width = buffer.width;
                scrollBuffer.height = buffer.height;
                scrollBufferContext = scrollBuffer.getContext('2d', { alpha: true });
              }
              scrollBufferContext.globalCompositeOperation = 'copy';
              scrollBufferContext.drawImage(buffer, 0, 0);
              bufferContext.setTransform(1,0,0,1,0,0);
              bufferContext.clearRect(0,0,buffer.width,buffer.height);
              const srcX = dxPx < 0 ? -dxPx : 0;
              const srcY = dyPx < 0 ? -dyPx : 0;
              const dstX = dxPx > 0 ? dxPx : 0;
              const dstY = dyPx > 0 ? dyPx : 0;
              bufferContext.drawImage(scrollBuffer, srcX, srcY, ovW, ovH, dstX, dstY, ovW, ovH);
              bufferCamera = { x: prevPaintCamera.x + dxPx / ratio, y: prevPaintCamera.y + dyPx / ratio, scale: prevPaintCamera.scale };
              scrollStrips = [];
              if (dxPx > 0) scrollStrips.push({ left: 0, top: 0, right: dxPx, bottom: buffer.height });
              else if (dxPx < 0) scrollStrips.push({ left: buffer.width + dxPx, top: 0, right: buffer.width, bottom: buffer.height });
              if (dyPx > 0) scrollStrips.push({ left: dstX, top: 0, right: dstX + ovW, bottom: dyPx });
              else if (dyPx < 0) scrollStrips.push({ left: dstX, top: buffer.height + dyPx, right: dstX + ovW, bottom: buffer.height });
            } else {
              bufferCamera={...camera};previousPaintKey='';
            }
          } else {
            bufferCamera={...camera};previousPaintKey='';
          }
        }
        const paintCamera={...bufferCamera,x:bufferCamera.x+margin,y:bufferCamera.y+margin};
        const bufferKey=`${width}:${height}:${ratio}:${bufferCamera.x}:${bufferCamera.y}:${bufferCamera.scale}`;
        const fullPaint = !scrollStrips && (bufferKey !== previousPaintKey || (region && (region.maxX-region.minX)*(region.maxY-region.minY)*camera.scale**2 > width*height*.45));
        const drawPaintPass = (clipWorld, clipPixels) => {
          bufferContext.setTransform(1,0,0,1,0,0);
          bufferContext.save();
          if (clipPixels) {
            const { left, top, right, bottom } = clipPixels;
            bufferContext.beginPath(); bufferContext.rect(left,top,right-left,bottom-top); bufferContext.clip();
            if (!scrollStrips) bufferContext.clearRect(left,top,right-left,bottom-top);
          }
          bufferContext.setTransform(ratio*camera.scale,0,0,ratio*camera.scale,ratio*paintCamera.x,ratio*paintCamera.y);
          let activeAlpha=1,activeFill;
          let candidates=paintIndex.query(clipWorld,ordered);
          if (dragPx?.ids?.size) {
            const extra = [];
            const seen = new Set(candidates);
            for (const id of dragPx.ids) {
              const rec = records.get(id);
              if (rec && !rec.hidden && !seen.has(rec)) extra.push(rec);
            }
            if (extra.length) candidates = [...candidates, ...extra].sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
          }
          stats.paintCandidates=(stats.paintCandidates||0)+candidates.length;
          for (const record of candidates) {
            if (!record || record.hidden) continue;
            const shifted = Boolean(dragPx && dragPx.ids.has(record.id));
            const offX = shifted ? dragPx.dx : 0;
            const offY = shifted ? dragPx.dy : 0;
            const b = shifted
              ? { minX: record.paintedBounds.minX + offX, minY: record.paintedBounds.minY + offY, maxX: record.paintedBounds.maxX + offX, maxY: record.paintedBounds.maxY + offY }
              : record.paintedBounds;
            if (!overlaps(b,clipWorld)) continue;
            const descriptor=record.descriptor,raster=record.raster,handle=record.resource.textureHandle;
            const rotated=Boolean(descriptor.rotation);
            const drawX = descriptor.x + offX;
            const drawY = descriptor.y + offY;
            if(rotated){bufferContext.save(); bufferContext.translate(drawX+descriptor.centerX,drawY+descriptor.centerY); bufferContext.rotate(descriptor.rotation*Math.PI/180);}
            if(record.tint!==null){
              const alpha=shapeFillOpacity(record.item),fill=record.item.fill;
              if(rotated || alpha!==activeAlpha){bufferContext.globalAlpha=alpha;if(!rotated)activeAlpha=alpha;}
              if(rotated || fill!==activeFill){bufferContext.fillStyle=fill;if(!rotated)activeFill=fill;}
              bufferContext.fillRect(rotated?-descriptor.centerX:drawX,rotated?-descriptor.centerY:drawY,Number(record.item.width)*world.width,Number(record.item.height)*world.height);
            }else{
              if(!rotated && activeAlpha!==1){bufferContext.globalAlpha=1;activeAlpha=1;}
              const dx=rotated?raster.left-descriptor.centerX:drawX+raster.left;
              const dy=rotated?raster.top-descriptor.centerY:drawY+raster.top;
              if(handle?.page?.canvas)bufferContext.drawImage(handle.page.canvas,handle.slot.x+2,handle.slot.y+2,raster.pixelWidth,raster.pixelHeight,dx,dy,raster.width,raster.height);
              else if(raster.canvas)bufferContext.drawImage(raster.canvas,dx,dy,raster.width,raster.height);
              // Direct uploads leave pixels only in the GPU worker. The 2D buffer
              // skips them; without a GPU renderer they must be rasterized again.
              else gpuOnlyRasterSkipped=true;
            }
            if(rotated)bufferContext.restore(); drawn++;
          }
          bufferContext.restore();
        };
        if (scrollStrips) {
          stats.paintCandidates = 0;
          for (const strip of scrollStrips) {
            const stripWorld = {
              minX: (strip.left / ratio - paintCamera.x) / camera.scale,
              minY: (strip.top / ratio - paintCamera.y) / camera.scale,
              maxX: (strip.right / ratio - paintCamera.x) / camera.scale,
              maxY: (strip.bottom / ratio - paintCamera.y) / camera.scale,
            };
            drawPaintPass(stripWorld, strip);
          }
          bufferVersion++;
        } else if (fullPaint || region) {
          stats.paintCandidates = 0;
          if (fullPaint) {
            bufferContext.setTransform(1,0,0,1,0,0);
            bufferContext.clearRect(0,0,buffer.width,buffer.height);
            const bufferWorldBounds={minX:-paintCamera.x/bufferCamera.scale,minY:-paintCamera.y/bufferCamera.scale,maxX:(width+margin*2-paintCamera.x)/bufferCamera.scale,maxY:(height+margin*2-paintCamera.y)/bufferCamera.scale};
            drawPaintPass(bufferWorldBounds, null);
          } else {
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
            drawPaintPass(region, { left, top, right, bottom });
          }
          bufferVersion++;
        }
        previousPaintKey = bufferKey; previousPaintCamera = { ...bufferCamera }; previousPaintRatio = ratio; element.dataset.renderer = 'canvas2d';blitBuffer();
        if(gpuOnlyRasterSkipped){gpuOnlyRasterSkipped=false;if(!app){atlas.direct=false;resetRasters();schedule();}}
      } else {
        paintIndexValid = false;
        previousPaintKey = '';
        buffer.style.display = 'none';
        canvas.style.display = 'none';
        releaseCanvasSurfaces();
        if (compositor?.active && compositor.canvas) {
          compositor.canvas.style.display = 'none';
          compositor.active = false;
        }
        stats.outputPixels = 0;
      }
      if(app?.threaded&&!app.hasFrame&&!gpuFailed&&!workerBusy&&gpuSceneDirty){
        try{atlas.flush(app);gpuBatcher.sync(app,ordered,dragPx,preparation.count > 256 ? gpuCullBounds : null);lastGpuCullKey=gpuCullKey;gpuSceneDirty=false;preparedSinceGpuSync=0;presentGpu();}catch(error){stats.gpuError=String(error);fallBackToCanvas();}
      }
      previousDragPreview = dragPreview;
      stats.drawnObjects += drawn; stats.lastDrawnObjects = drawn; stats.visibleObjects = preparation.count + inkVisibleCount;
      stats.imagePreviews={scope:previewEpoch,active:imagePreviews.active,queued:imagePreviews.queued,entries:imagePreviews.entries.size,pixels:imagePreviews.pixels};
      stats.sharedRasters=resources.live.size;stats.retainedRasters=resources.idle.size;
      stats.texturePages=atlas.pages.length;
      stats.frames++;
      stats.preparing=deferredQuality;stats.deferredFrames=(stats.deferredFrames||0)+Number(deferredQuality);
      if(app&&!records.size){if(!gpuReleaseTimer)gpuReleaseTimer=setTimeout(releaseIdleGpu,5000);}
      else if(gpuReleaseTimer){clearTimeout(gpuReleaseTimer);gpuReleaseTimer=null;}
      ensureGpu();
      if (deferredQuality) schedule();
    };
    const scheduleChannel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
    if (scheduleChannel) scheduleChannel.port1.onmessage = () => {
      if (!disposed && frame !== null) render();
    };
    const cancelScheduledRender = () => {
      if (frame === null) return;
      if (!scheduleChannel) clearTimeout(frame);
      frame = null;
    };
    const schedule = () => {
      if (disposed || frame !== null) return;
      if (scheduleChannel) {
        frame = 1;
        scheduleChannel.port2.postMessage(null);
      } else {
        frame = setTimeout(render, 0);
      }
    };
    const metricsChanged=()=>{if(!types.connectors)return;metricsRevision++;schedule();};
    const appearanceChanged=()=>{fontRevision++;metricsRevision++;textAppearanceCache=null;schedule();};
    // Only faces used by canvas text invalidate its rasters. UI panels loading their
    // own fonts (e.g. on the first selection) used to re-rasterize every text object.
    // Subset faces (unicode-range) matter only if canvas text uses one of their characters.
    let usedCodepoints=null;
    const canvasCodepoints=()=>{
      const items=latest.current.items;
      if(usedCodepoints?.items===items)return usedCodepoints.set;
      const set=new Set();
      for(const item of Object.values(items||{})){if(!item||(!isRasterText(item)&&!isRasterCode(item)))continue;const text=String(item.text??item.code??'');for(const ch of text)set.add(ch.codePointAt(0));}
      usedCodepoints={items,set};return set;
    };
    const faceUsed=face=>{
      const range=String(face.unicodeRange||'').trim();
      if(!range||/^U\+0-10FFFF$/i.test(range))return true;
      const used=canvasCodepoints();
      for(const part of range.split(',')){
        const match=part.trim().match(/^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/i);if(!match)return true;
        const low=parseInt(match[1].replace(/\?/g,'0'),16),high=match[2]?parseInt(match[2],16):match[1].includes('?')?parseInt(match[1].replace(/\?/g,'F'),16):low;
        if(high-low>4096){for(const code of used)if(code>=low&&code<=high)return true;}
        else for(let code=low;code<=high;code++)if(used.has(code))return true;
      }
      return false;
    };
    const fontsLoaded=event=>{
      const faces=[...(event?.fontfaces||[])],used=textAppearanceCache?`${textAppearanceCache.font},${textAppearanceCache.codeFont}`.toLowerCase():null;
      if(!faces.length||used===null||faces.some(face=>used.includes(String(face.family||'').replace(/["']/g,'').trim().toLowerCase())&&faceUsed(face)))appearanceChanged();
    };
    renderer.current = schedule;
    // A continuing draft is painted in the input task itself (no scheduling hop),
    // onto a desynchronized surface. Start/end still take the full render pass so
    // the saved stroke and the cleared draft appear in the same frame.
    latest.current.onReady?.(value => {
      const continuing = Boolean(draft && value && draft.id === value.id);
      draft = value;
      if (disposed) return;
      if (continuing && inkHasContent && ink.paintDraft(value)) {
        previousDraft = value;
        stats.inkFrames=(stats.inkFrames||0)+1;stats.immediateInkFrames=(stats.immediateInkFrames||0)+1;
        return;
      }
      schedule();
    });
    latest.current.onDragReady?.(next => {
      if (disposed) return;
      const had = Boolean(dragPreview?.ids?.size);
      const has = Boolean(next?.ids?.size);
      if (!had && !has) return;
      dragPreview = next || null;
      cancelScheduledRender();
      render();
    });
    const observer = new ResizeObserver(([entry])=>{viewportMetrics={width:entry.contentRect.width,height:entry.contentRect.height};schedule();}); observer.observe(element);
    const themeObserver=new MutationObserver(appearanceChanged);const themeRoot=element.closest('[data-theme]');if(themeRoot)themeObserver.observe(themeRoot,{attributes:true,attributeFilter:['data-theme']});
    const stage=element.closest('.canvas-stage');
    // DOM world layers are transformed in this camera event's turn.
    // Present cached pixels/GPU in the same turn, rather than scheduling a
    // second frame that leaves vector objects one step behind DOM objects.
    const cameraChanged=()=>{if(disposed)return;cancelScheduledRender();render();};
    stage?.addEventListener('agora-camera',cameraChanged);
    window.addEventListener(CONNECTOR_METRICS_EVENT,metricsChanged);
    document.fonts?.addEventListener('loadingdone',fontsLoaded);
    element.dataset.renderer = 'canvas2d';schedule();
    return () => {
      disposed = true;delete element.__agoraGpuRenderer;cameraIdleTimer?.cancel();clearTimeout(budgetIdleTimer);clearTimeout(gpuReleaseTimer); cancelScheduledRender(); scheduleChannel?.port1?.close?.(); scheduleChannel?.port2?.close?.();
      observer.disconnect();themeObserver.disconnect();stage?.removeEventListener('agora-camera',cameraChanged); window.removeEventListener(CONNECTOR_METRICS_EVENT,metricsChanged);
      document.fonts?.removeEventListener('loadingdone',fontsLoaded);
      latest.current.onReady?.(null); latest.current.onDragReady?.(null); renderer.current = null;
      stopGpuEvents();
      for (const record of records.values()) destroyRecord(record);
      imagePreviews.destroy();
      if (deferredCandidate) { deferredCandidate.candidate.destroy(); deferredCandidate.candidate.free(); deferredCandidate = null; releaseGpu?.(); releaseGpu = null; }
      records.clear(); resources.destroy(); atlas.destroy(); app?.destroy(); app?.free(); gpuCanvas?.remove();
      // A pending init releases its slot after completion.
      if (!pendingApp) releaseGpu?.();
      compositor?.destroy();releaseCanvasSurfaces();buffer.remove();ink.destroy(); canvas.remove();
    };
  }, []);
  useLayoutEffect(() => { renderer.current?.(); });
  return <div className="vector-layer" style={props.style} ref={host} aria-label={ui("깊이별 벡터 캔버스")} />;
});

export default DepthVectorLayer;
