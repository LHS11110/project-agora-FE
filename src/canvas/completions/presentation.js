/** Plain preview of Monaco snippets, preserving repeated placeholder values. */
export function snippetPreview(source) {
  const defaults=new Map();
  for(const match of source.matchAll(/\$\{(\d+):([^}]*)\}/g))defaults.set(match[1],match[2]);
  return source.replace(/\$\{(\d+)(?::([^}]*))?\}|\$(\d+)/g,(_match,index,value,reference)=>value??defaults.get(index??reference)??'').replace(/\\\$/g,'$');
}

const symbols={
  python:{Function:'len sorted open isinstance',Class:'range enumerate zip list dict set tuple str int float'},
  java:{Class:'System String Integer Optional',Interface:'List Map Set'},
  c:{Function:'printf scanf malloc free strlen memcpy'},
  cpp:{Module:'std',Class:'vector string unique_ptr shared_ptr',Variable:'cout cin'},
};
const categoryLabels={Function:'함수',Class:'타입',Interface:'타입',Module:'네임스페이스',Variable:'변수',Keyword:'키워드'};
export function vocabularyPresentation(language,label){
  for(const [kind,names] of Object.entries(symbols[language]||{}))if(names.split(' ').includes(label))return {kind,description:categoryLabels[kind]};
  return {kind:'Keyword',description:categoryLabels.Keyword};
}
