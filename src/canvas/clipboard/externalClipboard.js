import {isGif,mediaFileType} from '../media/mediaModel.js';
import { inspectShareUrl } from '../../components/shareMedia.js';
import {NOTEBOOK_FILE_LIMIT_BYTES} from '../notebook/notebookData.js';

const TEXT_FILE = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|log|py|js|jsx|ts|tsx|cpp|cc|c|h|hpp|java|sh|sql|html|css|rs|go)$/i;
const CODE_LANG = {py:'python',js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',cpp:'cpp',cc:'cpp',c:'c',h:'cpp',hpp:'cpp',java:'java',sh:'shell',sql:'sql',json:'json',xml:'xml',html:'html',css:'css',rs:'rust',go:'go',yaml:'yaml',yml:'yaml'};
export const clipboardFileType = file => mediaFileType(file)?'media':file.type?.startsWith('image/') ? 'image' : file.type==='application/pdf'||/\.pdf$/i.test(file.name||'') ? 'pdf' : file.type==='application/x-ipynb+json'||/\.ipynb$/i.test(file.name||'') ? 'notebook' : /\.(csv|tsv|xlsx)$/i.test(file.name||'') ? 'sheet' : file.type?.startsWith('text/')||TEXT_FILE.test(file.name||'') ? 'text' : null;
const notebookDocument = value => {
  try {
    const document=JSON.parse(value);
    return document?.nbformat===4&&Array.isArray(document.cells)?document:null;
  } catch { return null; }
};
export function clipboardTextObject(text, filename='') {
  if(new TextEncoder().encode(text).length>65536)throw new Error('붙여넣을 텍스트는 UTF-8 기준 64KiB 이하여야 합니다.');
  const extension=filename.split('.').at(-1)?.toLowerCase();
  return {kind:'text',text,renderMode:CODE_LANG[extension]?'code':['md','markdown'].includes(extension)?'markdown':'plain',...(filename?{filename}:{}),...(CODE_LANG[extension]?{language:CODE_LANG[extension]}:{}),width:.3};
}
const urlObject = raw => {
  if(!/^(?:https:\/\/|www\.)\S+$/i.test(raw))return null;
  const media=inspectShareUrl(raw);if(!media)return null;
  const url=new URL(media.url);
  if(isGif(media.url))return {kind:'link',url:media.url,mediaType:'gif',title:'GIF',mediaLoop:false,width:.3,height:.3};
  if(/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(url.pathname))return {kind:'image',src:media.url,width:.3};
  const {defaultTitle,...fields}=media;
  return {kind:'link',...fields,title:defaultTitle,width:media.mediaType==='link'?.3:.36,height:media.mediaType==='link'?.15:.36};
};
export function externalClipboardObjects({text='',html='',uriList='',files=[]}) {
  // Files and their HTML/plain-text representations describe the same paste.
  // Browsers often expose a still PNG alongside the original GIF URL in HTML.
  // Prefer that original only for GIFs; keep ordinary file-paste precedence unchanged.
  if(files.length&&files.every(file=>file.type==='image/png')){const original=urlObject((uriList||text).trim());if(original?.mediaType==='gif')return [original];}
  if(files.length&&files.every(file=>file.type==='image/png')&&html&&typeof DOMParser!=='undefined'){
    const doc=new DOMParser().parseFromString(html,'text/html'),images=[...doc.querySelectorAll('img')];
    const originals=images.map(img=>urlObject(img.getAttribute('src')||''));
    if(originals.length&&originals.every(o=>o?.mediaType==='gif'))return originals;
  }
  if(files.length)return files.map(file=>({file,fileType:clipboardFileType(file)}));
  if(text.length<=NOTEBOOK_FILE_LIMIT_BYTES&&new TextEncoder().encode(text).length<=NOTEBOOK_FILE_LIMIT_BYTES){const notebook=notebookDocument(text.trim());if(notebook)return [{notebookDocument:notebook}];}
  if(uriList.trim()){
    const urls=uriList.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
    const objects=urls.map(urlObject);if(objects.length&&objects.every(Boolean))return objects;
  }
  if(html&&typeof DOMParser!=='undefined'){
    const doc=new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll('script,style,iframe,object,template').forEach(node=>node.remove());
    const images=[...doc.querySelectorAll('img')];
    if(images.length&&!doc.body.textContent.trim()){
      const objects=images.map(img=>{const src=img.getAttribute('src')||'';const media=inspectShareUrl(src);return /^https:\/\//i.test(src)&&media?(isGif(src)?urlObject(src):{kind:'image',src:media.url,width:.3}):null;});
      if(objects.every(Boolean))return objects;
    }
    const links=[...doc.querySelectorAll('a[href]')];
    if(links.length===1&&doc.body.textContent.trim()===links[0].textContent.trim()){
      const object=urlObject(links[0].getAttribute('href')||'');if(object)return [{...object,...(object.kind==='link'?{title:links[0].textContent.trim()||object.title}:{})}];
    }
    if(!text)text=doc.body.innerText||doc.body.textContent||'';
  }
  if(!text.trim())return [];
  const urls=text.trim().split(/\r?\n/).filter(x=>x.trim()).map(x=>urlObject(x.trim()));
  if(urls.length&&urls.every(Boolean))return urls;
  return [clipboardTextObject(text)];
}

// Some browsers expose copied files only through DataTransfer.items.
export function clipboardDataContent(data) {
  const files=Array.from(data.files||[]);
  if(!files.length)for(const entry of Array.from(data.items||[])){
    if(entry.kind==='file'){const file=entry.getAsFile();if(file)files.push(file);}
  }
  return {files,text:data.getData('text/plain')||data.getData('application/x-ipynb+json')||data.getData('application/json'),html:data.getData('text/html'),uriList:data.getData('text/uri-list')};
}

export async function resolveExternalClipboardObjects(content) {
  const objects=externalClipboardObjects(content);
  for(const entry of objects){
    const file=entry.file;
    // Clipboard.read() loses the original filename; recognize notebook JSON by
    // its nbformat/cells schema instead of requiring an .ipynb extension.
    if(!file||file.size>NOTEBOOK_FILE_LIMIT_BYTES||entry.fileType==='notebook'||!['text',null].includes(entry.fileType))continue;
    if(file.type&&!['application/json','application/octet-stream','text/plain'].includes(file.type)&&!/\.json$/i.test(file.name||''))continue;
    const document=notebookDocument((await file.text()).replace(/^\uFEFF/, '').trim());
    if(document){entry.fileType='notebook';entry.notebookDocument=document;}
  }
  return objects;
}

export async function readClipboardEntries(entries) {
  const content={files:[],text:'',html:'',uriList:''};
  for(const entry of entries){
    const binary=entry.types.find(type=>['application/x-ipynb+json','application/json','application/octet-stream'].includes(type))|| (entry.types.includes('image/gif')?'image/gif':entry.types.find(type=>type.startsWith('image/')||type.startsWith('video/')||type==='application/pdf'));
    if(binary){const blob=await entry.getType(binary);const extension=binary==='application/x-ipynb+json'?'ipynb':binary==='application/json'?'json':binary==='application/octet-stream'?'bin':binary==='application/pdf'?'pdf':binary.split('/')[1];content.files.push(new File([blob],`clipboard.${extension}`,{type:binary}));}
    for(const [type,key] of [['text/plain','text'],['text/html','html'],['text/uri-list','uriList']])if(entry.types.includes(type))content[key]+=await (await entry.getType(type)).text();
  }
  return content;
}
