export const VALUE_TYPES=['real','integer','button','select','text'];
export function createValue(type='real'){
 return {kind:'value',title:'',valueType:type,valueMin:0,valueMax:type==='real'?1:100,valueStep:type==='real'?.01:1,valueNumber:0,valueText:'',valueOptions:type==='select'?['A','B','C']:['꺼짐','켜짐'],width:.28,height:type==='real'?.21:.18};
}
export function validValue(item){
 if(item?.kind!=='value'||!VALUE_TYPES.includes(item.valueType)||typeof item.title!=='string'||item.title.length>128||typeof item.valueText!=='string'||item.valueText.length>4096||!Array.isArray(item.valueOptions)||item.valueOptions.length<1||item.valueOptions.length>32||item.valueOptions.some(v=>typeof v!=='string'||!v.trim()||v.length>128))return false;
 const {valueMin:min,valueMax:max,valueStep:step,valueNumber:value,valueType:type}=item;
 if(![min,max,step,value].every(Number.isFinite)||Math.abs(min)>1e12||Math.abs(max)>1e12||min>=max||step<=0||step>max-min)return false;
 if(type==='real')return value>=min&&value<=max;
 if(type==='integer')return [min,max,step,value].every(Number.isSafeInteger)&&value>=min&&value<=max;
 if(type==='button')return value===0||value===1;
 if(type==='select')return Number.isInteger(value)&&value>=0&&value<item.valueOptions.length;
 return true;
}
export function displayedValue(item){return item.valueType==='text'?item.valueText:item.valueType==='select'?item.valueOptions[item.valueNumber]:item.valueNumber;}
export function valueDefinition(item,patch){
 const next={...item,...patch};
 if(next.valueType==='real'||next.valueType==='integer'){
  if(!Number.isFinite(next.valueMin)||!Number.isFinite(next.valueMax)||next.valueMin>=next.valueMax)return null;
  if(next.valueType==='integer'&&![next.valueMin,next.valueMax,next.valueStep].every(Number.isSafeInteger))return null;
  next.valueNumber=Math.max(next.valueMin,Math.min(next.valueMax,next.valueType==='integer'?Math.round(next.valueNumber):next.valueNumber));
 }
 if(next.valueType==='select')next.valueNumber=Math.min(next.valueOptions.length-1,Math.max(0,Math.round(next.valueNumber)));
 return validValue(next)?next:null;
}
