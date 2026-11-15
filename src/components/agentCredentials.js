const storageKey='agora-agent-personal-api-key';
export function normalizeAgentKey(value){if(typeof value!=='string')return '';const key=value.trim();return key.length<=4096&&/^[\x21-\x7e]*$/.test(key)?key:'';}
export function loadAgentKey(){try{return normalizeAgentKey(sessionStorage.getItem(storageKey));}catch{return '';}}
export function saveAgentKey(value){const key=normalizeAgentKey(value);try{if(key)sessionStorage.setItem(storageKey,key);else sessionStorage.removeItem(storageKey);}catch{/* Keep the key only in component memory if browser storage is unavailable. */}return key;}
