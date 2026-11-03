export const QUESTION_TYPES=['choice','short-answer'];
export const questionVersion=()=>crypto.randomUUID();
export const newQuestion=()=>({questionType:'choice',questionPrompt:'',questionOptions:['',''],questionAnswer:'',questionSubmitted:false,questionMaxScore:10,questionScore:-1,questionFeedback:'',questionVersion:questionVersion(),questionGradedVersion:''});
export function validQuestion(item){
 return QUESTION_TYPES.includes(item.questionType)&&typeof item.questionPrompt==='string'&&item.questionPrompt.length<=4000
 &&Array.isArray(item.questionOptions)&&item.questionOptions.length>=2&&item.questionOptions.length<=10&&item.questionOptions.every(s=>typeof s==='string'&&s.length<=300)
 &&typeof item.questionAnswer==='string'&&item.questionAnswer.length<=8000&&typeof item.questionFeedback==='string'&&item.questionFeedback.length<=2000
 &&typeof item.questionSubmitted==='boolean'&&Number.isInteger(item.questionMaxScore)&&item.questionMaxScore>=1&&item.questionMaxScore<=1000
 &&Number.isFinite(item.questionScore)&&(item.questionScore===-1||item.questionScore>=0&&item.questionScore<=item.questionMaxScore)
 &&typeof item.questionVersion==='string'&&item.questionVersion.length>0&&item.questionVersion.length<=128&&typeof item.questionGradedVersion==='string'&&item.questionGradedVersion.length<=128
 &&(item.questionType!=='choice'||item.questionAnswer===''||/^(0|[1-9]\d*)$/.test(item.questionAnswer)&&Number(item.questionAnswer)<item.questionOptions.length)
 &&(!item.questionSubmitted||Boolean(item.questionPrompt.trim()&&item.questionAnswer.trim())&&(item.questionType!=='choice'||item.questionOptions.every(s=>s.trim())))
 &&(item.questionScore===-1||item.questionSubmitted&&item.questionGradedVersion===item.questionVersion);
}
const ungrade=()=>({questionScore:-1,questionFeedback:'',questionGradedVersion:'',questionVersion:questionVersion()});
export function questionDefinitionPatch(draft){
 return {questionType:draft.questionType,questionPrompt:draft.questionPrompt.trim(),questionOptions:draft.questionOptions.map(s=>s.trim()),questionMaxScore:Number(draft.questionMaxScore),questionAnswer:'',questionSubmitted:false,...ungrade()};
}
export const questionSubmissionPatch=answer=>({questionAnswer:answer,questionSubmitted:true,...ungrade()});
export function questionGradePatch(item,score,feedback){return {questionScore:Number(score),questionFeedback:feedback,questionGradedVersion:item.questionVersion};}
