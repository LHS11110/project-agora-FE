import { inspectShareUrl } from '../../components/shareMedia.js';

const TEXT_FILE = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|log|py|js|jsx|ts|tsx|cpp|cc|c|h|hpp|java|sh|sql|html|css|rs|go)$/i;
const CODE_LANG = {py:'python',js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',cpp:'cpp',cc:'cpp',c:'c',h:'cpp',hpp:'cpp',java:'java',sh:'shell',sql:'sql',json:'json',xml:'xml',html:'html',css:'css',rs:'rust',go:'go',yaml:'yaml',yml:'yaml'};
export const clipboardFileType = file => file.type?.startsWith('image/') ? 'image' : file.type==='application/pdf'||/\.pdf$/i.test(file.name||'') ? 'pdf' : /\.(csv|tsv|xlsx)$/i.test(file.name||'') ? 'sheet' : file.type?.startsWith('text/')||TEXT_FILE.test(file.name||'') ? 'text' : null;
export function clipboardTextObject(text, filename='') {
  if(new TextEncoder().encode(text).length>65536)throw new Error('붙여넣을 텍스트는 UTF-8 기준 64KiB 이하여야 합니다.');
  const extension=filename.split('.').at(-1)?.toLowerCase();
  return {kind:'text',text,renderMode:CODE_LANG[extension]?'code':['md','markdown'].includes(extension)?'markdown':'plain',...(filename?{filename}:{}),...(CODE_LANG[extension]?{language:CODE_LANG[extension]}:{}),width:.3};
}
const urlObject = raw => {
  if(!/^(?:https:\/\/|www\.)\S+$/i.test(raw))return null;
  const media=inspectShareUrl(raw);if(!media)return null;
  const url=new URL(media.url);
  if(/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(url.pathname))return {kind:'image',src:media.url,width:.3};
  const {defaultTitle,...fields}=media;
  return {kind:'link',...fields,title:defaultTitle,width:media.mediaType==='link'?.3:.36,height:media.mediaType==='link'?.15:.36};
};
export function externalClipboardObjects({text='',html='',uriList='',files=[]}) {
  // Files and their HTML/plain-text representations describe the same paste.
  if(files.length)return files.map(file=>({file,fileType:clipboardFileType(file)}));
  if(uriList.trim()){
    const urls=uriList.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
    const objects=urls.map(urlObject);if(objects.length&&objects.every(Boolean))return objects;
  }
  if(html&&typeof DOMParser!=='undefined'){
    const doc=new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll('script,style,iframe,object,template').forEach(node=>node.remove());
    const images=[...doc.querySelectorAll('img')];
    if(images.length&&!doc.body.textContent.trim()){
      const objects=images.map(img=>{const src=img.getAttribute('src')||'';const media=inspectShareUrl(src);return /^https:\/\//i.test(src)&&media?{kind:'image',src:media.url,width:.3}:null;});
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
