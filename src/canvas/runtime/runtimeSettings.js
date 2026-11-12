
export function runtimeSettingsApi({request}) {
  const invoke=management=>request(management);
  return {
    load:()=>invoke({action:'settings_get'}),
    resources:(template,revision)=>invoke({action:'resources_set',template,revision}),
    disk:(sizeGiB,revision)=>invoke({action:'disk_set',sizeGiB,revision}),
    installJava:()=>invoke({action:'java_dependencies'}),
    apply:(language,config,revision)=>invoke({action:'settings_set',language,config,revision}),
  };
}

export function selectRuntimeEngine(language, config, engine) {
  return {...config,engine,...(language==='java'?{release:engine.replace(/^jdk/,'')}: {})};
}
