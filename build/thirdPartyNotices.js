import {existsSync,readFileSync,readdirSync,mkdirSync,copyFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';

const noticeName=/^(?:licen[cs]e|notice|copying|ofl|third.*notices?)(?:[._ -].*)?$/i;
const supplements={
 '@pixi/colord':'licenses/upstream/colord-LICENSE.md',
 '@mathjax/mathjax-newcm-font':'node_modules/mathjax/LICENSE',
 '@napi-rs/canvas-linux-x64-gnu':'node_modules/@napi-rs/canvas/LICENSE',
 '@napi-rs/canvas-linux-x64-musl':'node_modules/@napi-rs/canvas/LICENSE',
};
export function emitThirdPartyNotices(root,output){
 const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
 const target=join(output,'licenses');mkdirSync(target,{recursive:true});
 const components=[];
 for(const [path,entry] of Object.entries(lock.packages)){
  if(!path||entry.dev||!existsSync(join(root,path,'package.json')))continue;
  if(!path.startsWith('node_modules/')||path.split('/').includes('..'))throw Error('Invalid package lock path');
  const directory=join(root,path),pkg=JSON.parse(readFileSync(join(directory,'package.json'),'utf8'));
  const folder=path.replaceAll('/','_')+'@'+pkg.version,files=[];
  const destination=join(target,'npm',folder);mkdirSync(destination,{recursive:true});
  for(const name of readdirSync(directory))if(noticeName.test(name)&&statSync(join(directory,name)).isFile()){
   copyFileSync(join(directory,name),join(destination,name));files.push('npm/'+folder+'/'+name);
  }
  const supplemental=supplements[pkg.name];
  if(!files.length&&supplemental){copyFileSync(join(root,supplemental),join(destination,'LICENSE-supplement.txt'));files.push('npm/'+folder+'/LICENSE-supplement.txt');}
  components.push({name:pkg.name,version:pkg.version,license:pkg.license||'UNKNOWN',notices:files,...(supplemental&&!files.some(f=>!f.endsWith('LICENSE-supplement.txt'))?{supplementalSource:supplemental}:{})});
 }
 components.sort((a,b)=>a.name.localeCompare(b.name));
 writeFileSync(join(target,'npm-inventory.json'),JSON.stringify({scope:'Installed production npm dependency superset; not a claim that every package is bundled',components},null,2)+'\n');
 for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])copyFileSync(join(root,name),join(target,name));
 return components;
}
export function thirdPartyNotices(){let root,output;return {name:'third-party-notices',configResolved(config){root=config.root;output=resolve(root,config.build.outDir);},closeBundle(){emitThirdPartyNotices(root,output);}};}
