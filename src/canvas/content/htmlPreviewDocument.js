const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const BLOCKED_LINK_REL = /\brel\s*=\s*(?:"[^"]*\b(?:stylesheet|preload|modulepreload|prefetch|prerender|icon|manifest|shortcut|font|import|subresource)\b[^"]*"|'[^']*\b(?:stylesheet|preload|modulepreload|prefetch|prerender|icon|manifest|shortcut|font|import|subresource)\b[^']*'|(?:\b(?:stylesheet|preload|modulepreload|prefetch|prerender|icon|manifest|shortcut|font|import|subresource)\b))/i;
const BLOCKED_LINK_AS = /\bas\s*=\s*(?:"[^"]*\b(?:style|script|font|fetch|worker)\b[^"]*"|'[^']*\b(?:style|script|font|fetch|worker)\b[^']*'|(?:\b(?:style|script|font|fetch|worker)\b))/i;
const BLOCKED_LINK_TYPE = /\btype\s*=\s*(?:"[^"]*(?:text\/css|javascript)[^"]*"|'[^']*(?:text\/css|javascript)[^']*')/i;
const EXTERNAL_RESOURCE_ATTR = /(?:^|\s)(?:src|xlink:href|href)\s*=/i;
const CSS_IMPORT = /(^|[;{}])\s*@import\s+(?:url\s*\(\s*(?:"[^"]*"|'[^']*'|[^)"'\n]*)\s*\)|"[^"]*"|'[^']*')[^;{}]*(?:;|$)?/gi;
const SANDBOX_RESOURCE_TOKEN = /<!--[\s\S]*?-->|<\?xml-stylesheet\b[\s\S]*?\?>|<style\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/style\s*>|<script\b((?:[^>"']|"[^"]*"|'[^']*')*?(?:["'\s]))\/\s*>|<script\b((?:[^>"']|"[^"]*"|'[^']*')*?\b(?:src|xlink:href|href)\s*=(?:[^>"']|"[^"]*"|'[^']*')*)>(?:(?!<script\b)[\s\S])*?<\/script\s*>|<script\b((?:[^>"']|"[^"]*"|'[^']*')*?\b(?:src|xlink:href|href)\s*=(?:[^>"']|"[^"]*"|'[^']*')*)>|<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>[\s\S]*?<\/script\s*>|<link\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

export function stripSandboxedExternalCssImports(css) {
  return String(css ?? '').replace(CSS_IMPORT, '$1');
}

export function stripSandboxedExternalTags(source) {
  return String(source ?? '').replace(
    SANDBOX_RESOURCE_TOKEN,
    (match, styleAttrs, styleBody, selfScriptAttrs, extPairedAttrs, extOpenAttrs, inlineScriptAttrs, linkAttrs) => {
      if (typeof styleAttrs === 'string') {
        const cleaned = stripSandboxedExternalCssImports(styleBody);
        return cleaned === styleBody ? match : `<style${styleAttrs}>${cleaned}</style>`;
      }
      if (typeof selfScriptAttrs === 'string') {
        return EXTERNAL_RESOURCE_ATTR.test(selfScriptAttrs) ? '' : match;
      }
      if (typeof extPairedAttrs === 'string' || typeof extOpenAttrs === 'string') {
        return '';
      }
      if (typeof inlineScriptAttrs === 'string') {
        return match;
      }
      if (typeof linkAttrs === 'string') {
        const hasTarget = /(?:^|\s)(?:href|imagesrcset)\s*=/i.test(linkAttrs);
        if (hasTarget && (BLOCKED_LINK_REL.test(linkAttrs) || BLOCKED_LINK_AS.test(linkAttrs) || BLOCKED_LINK_TYPE.test(linkAttrs))) {
          return '';
        }
        return match;
      }
      if (match.startsWith('<?')) return '';
      return match;
    },
  );
}

export function htmlPreviewDocument(source, assets = { css: [], js: [] }) {
  const header = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: https:; font-src data:; base-uri \'none\'; form-action \'none\'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:light}body{margin:16px;font:14px/1.5 system-ui;overflow-wrap:anywhere}img{max-width:100%}</style>';
  const sanitized = stripSandboxedExternalTags(source);
  const safeCss = (assets?.css || []).map(stripSandboxedExternalCssImports);
  const safeJs = assets?.js || [];
  const bridge = `<script>(()=>{let values=Object.freeze(JSON.parse(${json(JSON.stringify(assets?.values||{}))}));const names=new Set();Object.defineProperty(window,'canvasValues',{get:()=>values});const apply=next=>{values=Object.freeze(next);for(const name of Object.keys(values)){if(/^[A-Za-z_$][\\w$]*$/.test(name)&&!(name in window)&&!names.has(name)){Object.defineProperty(window,name,{configurable:true,get:()=>values[name]});names.add(name);}}};apply(values);window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='frelog-values'||!event.data.values)return;apply(event.data.values);window.dispatchEvent(new CustomEvent('canvasvalueschange',{detail:values}));});})();</script>`;
  return header + bridge + `<script>window.addEventListener('error',e=>{const show=()=>{const p=document.createElement('pre');p.style='white-space:pre-wrap;color:#b42335;background:#fff1f2;padding:10px';p.textContent='JavaScript: '+e.message;document.body.append(p);};document.body?show():window.addEventListener('DOMContentLoaded',show,{once:true});});</script>` + sanitized + `<script>for(const css of ${json(safeCss)}){const style=document.createElement('style');style.textContent=css;document.head.append(style);}for(const source of ${json(safeJs)}){const script=document.createElement('script');script.textContent=source;document.body.append(script);}</script>`;
}
