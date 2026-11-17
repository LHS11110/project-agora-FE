import CameraIdleTask from './CameraIdleTask.js';
import RasterPaintIndex from './RasterPaintIndex.js';
import {isRasterCode} from './codePreviewMetrics.js';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { shapeFillOpacity } from './shapeAppearance.js';
import ImagePreviewCache, { loadImagePreview } from './ImagePreviewCache.js';
import { apiUrl } from '../api/client.js';
import { observeGpuContextLoss } from './gpuLayerLifecycle.js';
import { GRAPHICS_PROFILES, graphicsRasterItem, graphicsResolution, graphicsRasterRatio, normalizeGraphicsQuality } from './graphicsQuality.js';
import { changedItemIds } from './itemSnapshots.js';
import ScenePreparationQueue from './ScenePreparationQueue.js';
import { flatRectangleTint,tintRasterItem } from './flatShapeTint.js';
import WorkerFrameCompositor from './WorkerFrameCompositor.js';
import { rasterViewportRegion } from './rasterViewportRegion.js';
import { hasHardwareWebGL } from './gpuCapability.js';
import { cachedCameraProjection } from './cachedCameraProjection.js';
import { useLayoutEffect, useRef } from 'react';
import { createWgpuRenderer, WgpuSceneBatcher } from './wgpu/wgpuEngine.js';
import { createInkStrokeRenderer, hasStrokeItems } from './inkStrokeRenderer.js';
import { CONNECTOR_METRICS_EVENT } from './connectors/objectMetrics.js';
import { acquireGpuSlot, rasterDescriptor, rasterizeObject, sameRasterInput } from './rasterObjectCache.js';
import { RasterTextureAtlas } from './textureAtlas.js';
import SharedRasterCache from './SharedRasterCache.js';
import { isRasterContent as isRasterText } from './plainTextRaster.js';
import { mergeDamage, overlaps, paintBounds } from './renderDamage.js';
import '../components/vector-layer.css';

const EMPTY_PREVIEWS = [];
const EMPTY_ITEMS={};

export default function DepthVectorLayer(props) {
  useUiLocale();
  const host = useRef(null), renderer = useRef(null), latest = useRef(props);
  latest.current = props;
  useLayoutEffect(() => {
    const element = host.current, canvas = document.createElement('canvas');
    element.appendChild(canvas);
    canvas.style.display='none';
    const viewportContext=canvas.getContext('2d',{alpha:true,desynchronized:false});
    const buffer=document.createElement('canvas'),bufferContext=buffer.getContext('2d',{alpha:true,desynchronized:true});
    const margin=256;
    buffer.className='vector-composite-surface';element.insertBefore(buffer,canvas);
    let compositor=null,bufferVersion=0,surfaceChanged=false,worldPaintBounds=null,bufferCamera=null,sceneInputs=null,lastCamera=null,cameraIdleTimer=null,budgetIdleTimer=null,refreshCamera=false,cameraActive=false,viewportMetrics=null,textAppearanceCache=null,inkHasContent=false,settledDesiredRatio=null,settledQuality=null;
    const ink = createInkStrokeRenderer(element, canvas);
    const records = new Map();
    const paintIndex = new RasterPaintIndex();
    const preparationQueue = new ScenePreparationQueue();
    let preparation = null;
    const readyImageIds = new Set();
    const createImagePreviews = () => new ImagePreviewCache(
      (source, signal) => loadImagePreview(source, latest.current.token, apiUrl, signal,GRAPHICS_PROFILES[normalizeGraphicsQuality(latest.current.graphicsQuality)].imagePreviewSize),
      (source, ids) => {
        for (const id of ids) if (latest.current.items[id]?.__imagePreview === source) readyImageIds.add(id);
        schedule();
      });
    let previewQuality=normalizeGraphicsQuality(props.graphicsQuality),previewToken = props.token, previewEpoch = 0, imagePreviews = createImagePreviews();
    const atlas = new RasterTextureAtlas();
    const resources = new SharedRasterCache(resource => {
      if(resource.textureHandle) atlas.release(resource.textureHandle);
      if(resource.raster.canvas)resource.raster.canvas.width=resource.raster.canvas.height=1;
    });
    const stats = element.__agoraRenderStats = { frames: 0, rasterizations: 0, cacheHits: 0, descriptorsUpdated: 0, drawnObjects: 0, texturePages: 0 };
    let stopGpuEvents = () => {};
    let gpuCanvas;
    const gpuBatcher = new WgpuSceneBatcher();
    let app, pendingApp, releaseGpu, gpuFailed = false, disposed = false, frame = null, draft;
    let types={items:null,kinds:new Map(),texts:0,connectors:0};
    let fontRevision=0,metricsRevision = 0, inkKey = '', previousPreviews,previousDraft,previousInkItems, previousPaintKey = '', previousOrder = '';
    const destroyRecord = record => {
      paintIndex.remove(record);
      resources.release(record.resource);
    };
    const ensureWorker=()=>{if(!compositor)compositor=new WorkerFrameCompositor(element,canvas,()=>{surfaceChanged=true;schedule();},stats);};
    const fallBackToCanvas = () => {
      if (disposed || gpuFailed) return;
      gpuFailed = true;
      if (gpuCanvas) gpuCanvas.style.display = 'none';
      stopGpuEvents();
      if(app?.threaded)app.destroy();
      releaseGpu?.(); releaseGpu = null;
      canvas.style.display = 'none'; buffer.style.display = '';
      element.dataset.renderer = 'canvas2d';
      // Repaint all retained records, even if no object or camera has changed.
      sceneInputs = null; previousPaintKey = ''; bufferCamera = null;
      ensureWorker(); schedule();
    };
    const ensureGpu = () => {
      if (app || pendingApp || gpuFailed || disposed || !records.size) return;
      if(!navigator.gpu && !hasHardwareWebGL()){gpuFailed=true;element.dataset.renderer='canvas2d';ensureWorker();return;}
      releaseGpu = acquireGpuSlot();
      if (!releaseGpu){ensureWorker();return;}
      const surface = document.createElement('canvas');
      pendingApp = true;
      const ratio = graphicsResolution(latest.current.graphicsQuality, window.devicePixelRatio);
      createWgpuRenderer(surface, element.clientWidth * ratio, element.clientHeight * ratio).then(candidate => {
        pendingApp = null;
        if (disposed) { candidate.destroy(); candidate.free(); releaseGpu?.(); return; }
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
          candidate.onFrame=()=>{stats.gpuWorkerFrames=(stats.gpuWorkerFrames||0)+1;if(first){first=false;element.dataset.renderer=candidate.backend_kind();surface.style.display='';compositor?.destroy();compositor=null;canvas.style.display='none';buffer.style.display='none';sceneInputs=null;schedule();}};
        }else{canvas.style.display = 'none'; buffer.style.display = 'none';}
        element.dataset.renderer = candidate.backend_kind();
        atlas.resetGpuState(); sceneInputs = null;
        stopGpuEvents = observeGpuContextLoss(surface, () => disposed, fallBackToCanvas);
        schedule();
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
      if (previewToken !== latest.current.token||previewQuality!==normalizeGraphicsQuality(latest.current.graphicsQuality)) {
        // Authenticated images belong to the current account/capability scope.
        imagePreviews.destroy(); imagePreviews = createImagePreviews();
        previewToken = latest.current.token;previewQuality=normalizeGraphicsQuality(latest.current.graphicsQuality); previewEpoch++; readyImageIds.clear();
        for (const [id, record] of records) if (record.item?.__imagePreview) { destroyRecord(record); records.delete(id); }
        sceneInputs = null; previousPaintKey = ''; bufferCamera = null;
      }
      const moved=lastCamera && (lastCamera.x!==camera.x || lastCamera.y!==camera.y || lastCamera.scale!==camera.scale);
      if(moved){cameraActive=true;cameraIdleTimer ||= new CameraIdleTask(()=>{cameraActive=false;refreshCamera=true;schedule();},120);cameraIdleTimer.touch();}
      lastCamera={...camera};
      const settling=refreshCamera;refreshCamera=false;
      const quality=normalizeGraphicsQuality(latest.current.graphicsQuality);
      const profile=GRAPHICS_PROFILES[quality];
      const ratio=graphicsResolution(quality,window.devicePixelRatio);
      stats.graphicsQuality=quality;stats.resolution=ratio;
      if(!textAppearanceCache){const styles=getComputedStyle(element);textAppearanceCache={codeFont:styles.getPropertyValue('--mono').trim()||'ui-monospace,monospace',font:styles.getPropertyValue('--display').trim() || 'serif',color:styles.getPropertyValue('--ink-strong').trim() || '#3c5144'};}
      const textAppearance=textAppearanceCache;
      const width = Math.max(1, viewportMetrics?.width || element.clientWidth), height = Math.max(1, viewportMetrics?.height || element.clientHeight);
      const pixelWidth = Math.round(width*ratio), pixelHeight = Math.round(height*ratio);
      const gpu = app && !gpuFailed && (!app.threaded || app.hasFrame);
      if (gpu && (app.width() !== pixelWidth || app.height() !== pixelHeight)) app.resize(pixelWidth,pixelHeight);
      const presentGpu = () => {
        if (!app.render_frame(camera.x,camera.y,camera.scale,width,height)) throw new Error("GPU surface unavailable");
        stats.presentedCamera={x:camera.x,y:camera.y,scale:camera.scale};
      };
      const cameraZooming = Boolean(element.closest?.('.canvas-stage')?.classList?.contains('camera-zooming'));
      const rawDesiredRatio = graphicsRasterRatio(quality,camera.scale,window.devicePixelRatio);
      if(!cameraZooming || settledDesiredRatio===null || settledQuality!==quality || rawDesiredRatio/settledDesiredRatio>1.5 || settledDesiredRatio/rawDesiredRatio>1.5){
        settledDesiredRatio=rawDesiredRatio;
        settledQuality=quality;
      }
      const desiredRatio = settledDesiredRatio;
      const projection=cachedCameraProjection(bufferCamera,camera,width,height,margin,worldPaintBounds);
      const bufferFits=Boolean(projection);
      const blitBuffer=()=>{
        stats.presentedCamera={x:camera.x,y:camera.y,scale:camera.scale};
        buffer.style.display='none';
        const region=rasterViewportRegion(worldPaintBounds,camera,width,height);
        const projection=cachedCameraProjection(bufferCamera,camera,width,height,margin,worldPaintBounds);
        const sourceCrop=bufferCamera?rasterViewportRegion(worldPaintBounds,{...bufferCamera,x:bufferCamera.x+margin,y:bufferCamera.y+margin},buffer.width/ratio,buffer.height/ratio,1):null;
        const pixelCrop=sourceCrop?{x:Math.floor(sourceCrop.x*ratio),y:Math.floor(sourceCrop.y*ratio),width:Math.ceil(sourceCrop.width*ratio),height:Math.ceil(sourceCrop.height*ratio)}:null;
        if(compositor?.send({width,height,ratio,region,projection,sourceCrop:pixelCrop,version:bufferVersion},buffer)){canvas.style.display='none';return;}
        if(!region||!projection){canvas.style.display='none';stats.outputPixels=0;return;}
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
      if(hasAnyInk || inkHasContent){
        const nextInkKey=`${quality}:${ratio}:${width}:${height}:${world.width}:${world.height}:${camera.x}:${camera.y}:${camera.scale}`;
        if(nextInkKey!==inkKey || previousPreviews!==previewStrokes || previousDraft!==draft || previousInkItems!==inkItems){
          ink.render({items:inkItems,previews:previewStrokes,draft,width:world.width,height:world.height,viewportWidth:width,viewportHeight:height,camera,pixelRatio:ratio});
          inkKey=nextInkKey;previousPreviews=previewStrokes;previousDraft=draft;previousInkItems=inkItems;
          inkHasContent=hasAnyInk;
          stats.inkFrames=(stats.inkFrames||0)+1;
        }
      }else if(previousPreviews!==previewStrokes || previousDraft!==draft || previousInkItems!==inkItems){
        previousPreviews=previewStrokes;previousDraft=draft;previousInkItems=inkItems;
      }
      const hiddenKey=[...previewStrokes.map(stroke=>String(stroke.id)),...(draft?.id?[String(draft.id)]:[])].filter(id=>items[id]).sort().join('|');
      const inputs=[items,types.connectors?routingRevision:0,world.width,world.height,types.connectors?routingRevision:0,types.connectors?metricsRevision:0,hiddenKey,null,ratio,width,height,types.texts?textAppearance.font:'',types.texts?textAppearance.color:'',Boolean(gpu),quality,types.texts?fontRevision:0];
      const unchanged=sceneInputs && inputs.every((value,i)=>value===sceneInputs[i]);
      if(sceneInputs && !unchanged){const names=['items','references','worldWidth','worldHeight','routing','metrics','previews','draft','ratio','width','height','font','color','gpu','graphicsQuality','fonts'];for(let i=0;i<inputs.length;i++)if(inputs[i]!==sceneInputs[i]){stats.refreshReasons ||= {};stats.refreshReasons[names[i]]=(stats.refreshReasons[names[i]]||0)+1;}}
      const qualityRefresh = sceneInputs && !cameraActive && desiredRatio > sceneInputs.quality * 1.25;
      const pending = preparationQueue.pending;
      const imagesChanged = readyImageIds.size > 0;
      const zoomRatio=bufferCamera && camera.scale>0 && bufferCamera.scale>0 ? camera.scale/bufferCamera.scale : 0;
      const keepZoomedBuffer=cameraZooming && bufferFits && zoomRatio>=0.33 && zoomRatio<=3.5;
      const scaleSettling=!gpu && !cameraZooming && Boolean(bufferCamera && (zoomRatio<0.98 || zoomRatio>1.02));
      if(unchanged && !pending && !imagesChanged && !qualityRefresh && !surfaceChanged && !moved && !settling && !scaleSettling && (gpu || bufferFits))return;
      surfaceChanged=false;
      if(unchanged && (!pending || (!gpu && keepZoomedBuffer)) && !imagesChanged && !qualityRefresh && !scaleSettling && (gpu || bufferFits)){
        if(gpu){try { presentGpu(); } catch { fallBackToCanvas(); return; }}
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
      if (!unchanged || qualityRefresh || imagesChanged) {
        const compatible=sceneInputs && !qualityRefresh && inputs.every((value,i)=>i===0 || value===sceneInputs[i]);
        preparationQueue.setItems(items);
        partial=compatible && preparation && (unchanged || preparationQueue.changedIds!==null);
        if(partial){const nextBudget=Math.min(2_000_000,profile.scenePixelBudget/Math.max(1,preparationQueue.entries.length));if(nextBudget<preparation.pixelBudget*.8){clearTimeout(budgetIdleTimer);budgetIdleTimer=setTimeout(()=>{sceneInputs=null;schedule();},240);}preparation.pixelBudget=nextBudget;preparationQueue.invalidate([...new Set([...(unchanged ? [] : preparationQueue.changedIds), ...[...readyImageIds].filter(id=>preparationQueue.positions.has(id))])]);sceneInputs=inputs;sceneInputs.quality=preparation.lowestQuality;}
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
            record.hidden=true;paintIndex.remove(record);
          } else if (!record.hidden) {
            preparation.slots[index]=record;preparation.count++;expandBounds(record.paintedBounds);paintIndex.update(record,index);
          }
        });
        if (previousOrder !== preparationQueue.orderKey && !damage.length) {
          for (const record of preparation.slots) if(record)damage.push(record.paintedBounds);
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
      const preparedThisFrame=preparationQueue.run((id,item,index)=>{
        if ((!['shape','connector','stroke'].includes(item?.kind) && !isRasterText(item)) || hidden.has(id)) return;
        let record=records.get(id);
        const sameImage = record?.item.__imagePreview === item.__imagePreview;
        let preview = item.__imagePreview ? imagePreviews.peek(item.__imagePreview) : null;
        if (item.__imagePreview && (!sameImage || !record?.previewVersion || !sameRasterInput(record.item, item) || record.worldKey !== worldKey || record.graphicsQuality !== quality || (!cameraActive && targetRatio > record.quality * 1.25) || record.pixelBudget > pixelBudget * 1.1)) {
          const left=Number(item.x)*world.width*camera.scale+camera.x,top=Number(item.y)*world.height*camera.scale+camera.y;
          const visible=left<=width+64&&top<=height+64&&left+Number(item.width)*world.width*camera.scale>=-64&&top+Number(item.height)*world.height*camera.scale>=-64;
          preview = imagePreviews.request(item.__imagePreview, id,visible);
        }
        const previewVersion = preview?.version || (sameImage ? record?.previewVersion : 0) || 0;
        const routeVersion = item.__imagePreview ? `image:${previewEpoch}:${previewVersion}` : item.kind === 'connector'  ? `${routingRevision}:${metricsRevision}`
          : isRasterCode(item)?`${textAppearance.codeFont}:${fontRevision}`:item.kind==='text' ? `${textAppearance.font}:${textAppearance.color}:${fontRevision}` : '';
        const changed = !record || record.graphicsQuality!==quality || !sameRasterInput(record.item,item) || record.worldKey !== worldKey || record.routeVersion !== routeVersion;
        const tint=flatRectangleTint(item);
        const descriptor=changed?rasterDescriptor(id,graphicsRasterItem(tintRasterItem(item,tint),quality),world,referenceItems,routeVersion):record.descriptor;
        if(changed)stats.descriptorsUpdated++;
        if(!descriptor)return;
        const key=descriptor.key;
        const paintChanged=!record||record.key!==key||record.tint!==tint||['x','y','rotation','centerX','centerY'].some(field=>record.descriptor[field]!==descriptor[field]);
        const qualityNeeded=record && !cameraActive && targetRatio>record.quality*1.25;
        const deferPreview = item.__imagePreview && preview?.state !== 'ready' && sameImage && record?.previewVersion;
        const rebuild = !deferPreview && (!record || record.key !== key || record.graphicsQuality !== quality || qualityNeeded
          || (record.pixelBudget > pixelBudget*1.1 && record.raster.pixelWidth*record.raster.pixelHeight > pixelBudget*1.1));
        if (rebuild) {
          if (record) {paintIndex.remove(record);damage.push(record.paintedBounds);destroyRecord(record);}
          const resourceKey=key+':'+targetRatio+':'+Math.round(pixelBudget);
          const resource=resources.acquire(resourceKey,()=>{
            stats.rasterizations++;
            const raster=rasterizeObject(id,descriptor,world,referenceItems,targetRatio,pixelBudget,{...textAppearance,smoothingQuality:quality==='high'?'high':quality==='medium'?'medium':'low',imagePreview:preview?.canvas});
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
          record = { key, graphicsQuality:quality, quality:targetRatio, pixelBudget, raster:resource.raster, resource };
          records.set(id,record);
        } else stats.cacheHits++;
        if(paintChanged || rebuild || record.hidden){
          if(record.paintedBounds)damage.push(record.paintedBounds);
          record.paintedBounds=paintBounds(descriptor,record.raster);damage.push(record.paintedBounds);
          expandBounds(record.paintedBounds);
        }
        record.previewVersion=previewVersion;record.item=item;record.worldKey=worldKey;record.routeVersion=routeVersion;
        record.descriptor=descriptor;record.tint=tint;record.hidden=false;
        preparation.lowestQuality=Math.min(preparation.lowestQuality,record.quality);
        const raster=record.raster;
        if(!ordered[index])preparation.count++;
        ordered[index]=record;
        paintIndex.update(record,index);
      },cameraActive?2:4);
      const deferredQuality=preparationQueue.pending;
      stats.preparedThisFrame=preparedThisFrame;stats.preparationCursor=preparationQueue.cursor;
      stats.preparationVisited=(stats.preparationVisited||0)+preparedThisFrame;
      if(!deferredQuality){
        if(!partial){worldPaintBounds=null;for(const record of ordered)if(record)expandBounds(record.paintedBounds);}
        sceneInputs.quality=Number.isFinite(preparation.lowestQuality)?preparation.lowestQuality:targetRatio;
      }
      let drawn = 0;
      if (gpu) {
        try {
          atlas.flush(app); stats.texturePages = atlas.pages.length;
          drawn = gpuBatcher.sync(app, ordered);
          presentGpu();
        } catch (error) { stats.gpuError = String(error); fallBackToCanvas(); return; }
        previousPaintKey = '';
      } else {
        const bufferWidth=Math.round((width+margin*2)*ratio),bufferHeight=Math.round((height+margin*2)*ratio);
        if(buffer.width!==bufferWidth || buffer.height!==bufferHeight){buffer.width=bufferWidth;buffer.height=bufferHeight;bufferCamera=null;}
        const activeBufferFits=Boolean(cachedCameraProjection(bufferCamera,camera,width,height,margin,worldPaintBounds));
        if(!activeBufferFits || !bufferCamera || (!cameraZooming && (zoomRatio<0.98 || zoomRatio>1.02))){bufferCamera={...camera};previousPaintKey='';}
        const paintCamera={...bufferCamera,x:bufferCamera.x+margin,y:bufferCamera.y+margin};
        const bufferKey=`${width}:${height}:${ratio}:${bufferCamera.x}:${bufferCamera.y}:${bufferCamera.scale}`;
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
          const bufferWorldBounds={minX:-paintCamera.x/bufferCamera.scale,minY:-paintCamera.y/bufferCamera.scale,maxX:(width+margin*2-paintCamera.x)/bufferCamera.scale,maxY:(height+margin*2-paintCamera.y)/bufferCamera.scale};
          const clipRegion=fullPaint?bufferWorldBounds:region;
          let activeAlpha=1,activeFill;
          const candidates=paintIndex.query(clipRegion,ordered);
          stats.paintCandidates=candidates.length;
          for (const record of candidates) {
            if (!record || record.hidden) continue;
            if (!overlaps(record.paintedBounds,clipRegion)) continue;
            const descriptor=record.descriptor,raster=record.raster,handle=record.resource.textureHandle;
            const rotated=Boolean(descriptor.rotation);
            if(rotated){bufferContext.save(); bufferContext.translate(descriptor.x+descriptor.centerX,descriptor.y+descriptor.centerY); bufferContext.rotate(descriptor.rotation*Math.PI/180);}
            if(record.tint!==null){
              const alpha=shapeFillOpacity(record.item),fill=record.item.fill;
              if(rotated || alpha!==activeAlpha){bufferContext.globalAlpha=alpha;if(!rotated)activeAlpha=alpha;}
              if(rotated || fill!==activeFill){bufferContext.fillStyle=fill;if(!rotated)activeFill=fill;}
              bufferContext.fillRect(rotated?-descriptor.centerX:descriptor.x,rotated?-descriptor.centerY:descriptor.y,Number(record.item.width)*world.width,Number(record.item.height)*world.height);
            }else{
              if(!rotated && activeAlpha!==1){bufferContext.globalAlpha=1;activeAlpha=1;}
              const dx=rotated?raster.left-descriptor.centerX:descriptor.x+raster.left;
              const dy=rotated?raster.top-descriptor.centerY:descriptor.y+raster.top;
              if(handle?.page)bufferContext.drawImage(handle.page.canvas,handle.slot.x+2,handle.slot.y+2,raster.pixelWidth,raster.pixelHeight,dx,dy,raster.width,raster.height);
              else bufferContext.drawImage(raster.canvas,dx,dy,raster.width,raster.height);
            }
            if(rotated)bufferContext.restore(); drawn++;
          }
          bufferContext.restore();bufferVersion++;
        }
        previousPaintKey = bufferKey; element.dataset.renderer = 'canvas2d';blitBuffer();
      }
      if(app?.threaded&&!app.hasFrame&&!gpuFailed){
        try{atlas.flush(app);gpuBatcher.sync(app,ordered);presentGpu();}catch(error){stats.gpuError=String(error);fallBackToCanvas();}
      }
      stats.drawnObjects += drawn; stats.lastDrawnObjects = drawn; stats.visibleObjects = preparation.count;
      stats.imagePreviews={scope:previewEpoch,active:imagePreviews.active,queued:imagePreviews.queued,entries:imagePreviews.entries.size,pixels:imagePreviews.pixels};
      stats.sharedRasters=resources.live.size;stats.retainedRasters=resources.idle.size;
      stats.texturePages=atlas.pages.length;
      stats.frames++;
      stats.preparing=deferredQuality;stats.deferredFrames=(stats.deferredFrames||0)+Number(deferredQuality);
      ensureGpu();
      if (deferredQuality) schedule();
    };
    const schedule = () => { if (!disposed && frame === null) frame = requestAnimationFrame(render); };
    const metricsChanged=()=>{if(!types.connectors)return;metricsRevision++;schedule();};
    const appearanceChanged=()=>{fontRevision++;metricsRevision++;textAppearanceCache=null;schedule();};
    renderer.current = schedule;
    latest.current.onReady?.(value => { draft = value; schedule(); });
    const observer = new ResizeObserver(([entry])=>{viewportMetrics={width:entry.contentRect.width,height:entry.contentRect.height};schedule();}); observer.observe(element);
    const themeObserver=new MutationObserver(appearanceChanged);const themeRoot=element.closest('[data-theme]');if(themeRoot)themeObserver.observe(themeRoot,{attributes:true,attributeFilter:['data-theme']});
    const stage=element.closest('.canvas-stage');
    // DOM world layers are transformed in this camera event's animation frame.
    // Present cached pixels/GPU in the same frame, rather than scheduling a
    // second rAF that leaves vector objects one frame behind DOM objects.
    const cameraChanged=()=>{if(disposed)return;if(frame!==null){cancelAnimationFrame(frame);frame=null;}render();};
    stage?.addEventListener('agora-camera',cameraChanged);
    window.addEventListener(CONNECTOR_METRICS_EVENT,metricsChanged);
    document.fonts?.addEventListener('loadingdone',appearanceChanged);
    element.dataset.renderer = 'canvas2d';schedule();
    return () => {
      disposed = true;delete element.__agoraGpuRenderer;cameraIdleTimer?.cancel();clearTimeout(budgetIdleTimer); if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();themeObserver.disconnect();stage?.removeEventListener('agora-camera',cameraChanged); window.removeEventListener(CONNECTOR_METRICS_EVENT,metricsChanged);
      document.fonts?.removeEventListener('loadingdone',appearanceChanged);
      latest.current.onReady?.(null); renderer.current = null;
      stopGpuEvents();
      for (const record of records.values()) destroyRecord(record);
      imagePreviews.destroy();
      records.clear(); resources.destroy(); atlas.destroy(); app?.destroy(); app?.free(); gpuCanvas?.remove();
      // A pending init releases its slot after completion.
      if (!pendingApp) releaseGpu?.();
      compositor?.destroy();buffer.width=buffer.height=1;buffer.remove();ink.destroy(); canvas.remove();
    };
  }, []);
  useLayoutEffect(() => { renderer.current?.(); });
  return <div className="vector-layer" style={props.style} ref={host} aria-label={ui("깊이별 벡터 캔버스")} />;
}
