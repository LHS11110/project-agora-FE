import {useEffect,useId,useState} from 'react';
import {ui} from '../../i18n/locale.js';
import {useUiLocale} from '../../i18n/useUiLocale.js';
import {validQuestion,questionDefinitionPatch,questionSubmissionPatch,questionDraftPatch,questionGradePatch} from './questionData.js';
import './question-card.css';

export default function QuestionCard({id,item,readOnly,onChange}){
 useUiLocale();const group=useId();
 const [mode,setMode]=useState('answer'),[definition,setDefinition]=useState(item),[answer,setAnswer]=useState(item.questionAnswer),[score,setScore]=useState(item.questionScore<0?'':item.questionScore),[feedback,setFeedback]=useState(item.questionFeedback),[error,setError]=useState('');
 useEffect(()=>{setAnswer(item.questionAnswer);setScore(item.questionScore<0?'':item.questionScore);setFeedback(item.questionFeedback);},[item.questionVersion,item.questionScore,item.questionFeedback]);
 const change=patch=>{
  if(readOnly)return;const next={...item,...patch};
  if(!validQuestion(next)){setError('문제, 답안과 점수의 입력 범위를 확인하세요.');return false;}
  if(!onChange(id,patch)){setError('변경을 저장하지 못했습니다. 연결과 쓰기 권한을 확인하세요.');return false;}
  setError('');return true;
 };
 const open=value=>{setError('');setDefinition(item);setMode(value);};
 const submitDefinition=()=>{
  const patch=questionDefinitionPatch(definition);
  if(!patch.questionPrompt){setError('문제 내용을 입력하세요.');return;}
  if(change(patch))setMode('answer');
 };
 const canAnswer=item.questionPrompt.trim()&&(item.questionType!=='choice'||item.questionOptions.every(s=>s.trim()));
 return <section className="question-card" data-question-mode={mode} aria-label={ui('문제 객체')}>
  <header><div><span className="question-kicker">{ui(item.questionType==='choice'?'객관식':'주관식')}</span><strong>{ui('문제')}</strong></div><span className="question-points">{item.questionScore<0?`${item.questionMaxScore}${ui('점')}`:`${item.questionScore} / ${item.questionMaxScore}`}</span></header>
  <div className="question-content" data-object-action="question" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
   <nav aria-label={ui('문제 작업')}><button type="button" aria-pressed={mode==='answer'} onClick={()=>open('answer')}>{ui('공동 답안')}</button>{!readOnly&&<><button type="button" aria-pressed={mode==='edit'} onClick={()=>open('edit')}>{ui('문제 수정')}</button><button type="button" aria-pressed={mode==='grade'} disabled={!item.questionSubmitted} onClick={()=>open('grade')}>{ui('직접 채점')}</button></>}</nav>
   {mode==='edit'&&!readOnly?<div className="question-form">
    <label>{ui('문제 유형')}<select aria-label={ui('문제 유형')} value={definition.questionType} onChange={event=>setDefinition(d=>({...d,questionType:event.target.value}))}><option value="choice">{ui('객관식 · 하나 선택')}</option><option value="short-answer">{ui('주관식')}</option></select></label>
    <label>{ui('문제 내용')}<textarea aria-label={ui('문제 내용')} rows={3} maxLength={4000} value={definition.questionPrompt} onChange={event=>setDefinition(d=>({...d,questionPrompt:event.target.value}))}/></label>
    {definition.questionType==='choice'&&<fieldset><legend>{ui('보기')}</legend>{definition.questionOptions.map((option,index)=><div className="question-option-edit" key={index}><span>{index+1}.</span><input aria-label={ui('보기 {v0}',{v0:index+1})} maxLength={300} value={option} onChange={event=>setDefinition(d=>({...d,questionOptions:d.questionOptions.map((s,i)=>i===index?event.target.value:s)}))}/><button type="button" aria-label={ui('보기 삭제 {v0}',{v0:index+1})} disabled={definition.questionOptions.length<=2} onClick={()=>setDefinition(d=>({...d,questionOptions:d.questionOptions.filter((_,i)=>i!==index)}))}>×</button></div>)}<button type="button" disabled={definition.questionOptions.length>=10} onClick={()=>setDefinition(d=>({...d,questionOptions:[...d.questionOptions,'']}))}>{ui('보기 추가')}</button></fieldset>}
    <label>{ui('배점')}<input aria-label={ui('배점')} type="number" min={1} max={1000} step={1} value={definition.questionMaxScore} onChange={event=>setDefinition(d=>({...d,questionMaxScore:event.target.value}))}/></label>
    <p className="question-hint">{ui('문제를 수정하면 공동 답안과 채점 결과가 초기화됩니다.')}</p><button type="button" className="question-primary" onClick={submitDefinition}>{ui('문제 저장')}</button>
   </div>:<>
    <p className="question-prompt">{item.questionPrompt||ui('문제 수정에서 내용을 작성하세요.')}</p>
    {mode==='grade'&&!readOnly?<div className="question-form"><div className="question-answer-review"><small>{ui('제출된 공동 답안')}</small><p>{item.questionType==='choice'?item.questionOptions[Number(item.questionAnswer)]:item.questionAnswer}</p></div><label>{ui('점수')}<input aria-label={ui('점수')} type="number" min={0} max={item.questionMaxScore} step="any" value={score} onChange={event=>setScore(event.target.value)}/></label><label>{ui('채점 피드백')}<textarea aria-label={ui('채점 피드백')} maxLength={2000} rows={3} value={feedback} onChange={event=>setFeedback(event.target.value)}/></label><button type="button" className="question-primary" onClick={()=>{if(score===''){setError('점수를 입력하세요.');return;}if(!Number.isFinite(Number(score))||Number(score)<0||Number(score)>item.questionMaxScore){setError('점수는 0점부터 배점 사이로 입력하세요.');return;}if(change(questionGradePatch(item,score,feedback)))setMode('answer');}}>{ui('채점 저장')}</button></div>
    :<div className="question-form">{item.questionType==='choice'?<fieldset className="question-options" disabled={readOnly||!canAnswer}>{item.questionOptions.map((option,index)=><label key={index}><input type="radio" name={group} value={String(index)} checked={answer===String(index)} onChange={event=>{setAnswer(event.target.value);change(questionDraftPatch(event.target.value));}}/><span>{option||ui('보기를 입력하세요.')}</span></label>)}</fieldset>:<label>{ui('공동 답안')}<textarea aria-label={ui('주관식 답안')} rows={4} maxLength={8000} value={answer} readOnly={readOnly} disabled={!canAnswer} onChange={event=>{setAnswer(event.target.value);change(questionDraftPatch(event.target.value));}}/></label>}
     {!readOnly&&<button type="button" className="question-primary" disabled={!canAnswer||!answer.trim()} onClick={()=>change(questionSubmissionPatch(answer))}>{ui(item.questionSubmitted?'답안 다시 제출':'답안 제출')}</button>}
     <p className="question-hint" role="status">{ui(item.questionType==='choice'&&item.questionPrompt.trim()&&!canAnswer?'객관식 보기를 작성한 뒤 답안을 제출할 수 있습니다.':item.questionScore>=0?'채점 완료':item.questionSubmitted?'제출 완료 · 채점 대기':'공동 답안 · 참가자들과 공유됩니다.')}</p>
     {item.questionScore>=0&&<div className="question-grade"><strong>{item.questionScore} / {item.questionMaxScore} {ui('점')}</strong>{item.questionFeedback&&<p>{item.questionFeedback}</p>}</div>}
    </div>}
   </>}
   {error&&<p className="question-error" role="alert">{ui(error)}</p>}
  </div>
 </section>;
}
