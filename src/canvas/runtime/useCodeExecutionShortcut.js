import {useEffect,useRef} from 'react';
import {selectedRunnableForShortcut} from './codeExecutionShortcut.js';
import {isAgentInputItem,isAgentOrchestratorItem,isAgentRouterItem,isAgentRunnableItem} from '../agents/agentCanvasModel.js';

export default function useCodeExecutionShortcut(options) {
  const latest=useRef(options);latest.current=options;
  useEffect(()=>{
    let mounted=true;
    const onKeyDown=event=>{
      const {selectedIds,selectedIdsRef,itemsRef,editingId,editingIdRef,sessionRef,dragRef,store,multiAgentStore,onMessage,canExecuteItem}= latest.current;
      if(!sessionRef.current.editable||dragRef.current)return;
      const selection=(selectedIdsRef?.current??selectedIds).filter(id=>Boolean(itemsRef.current[id]));
      const id=selectedRunnableForShortcut(event,selection,itemsRef.current,editingIdRef?editingIdRef.current:editingId);
      if(id==null)return;
      const targetItem=itemsRef.current[id];
      const isAgent=isAgentRunnableItem(targetItem)&&Boolean(multiAgentStore);
      if (isAgent && !multiAgentStore.hasAgentAccess()) return;
      // Capture before Monaco so the shortcut never inserts a newline or runs twice.
      event.preventDefault();event.stopPropagation();
      if(event.repeat||(isAgent?multiAgentStore.isRunning():store.isRunning()))return;
      if(canExecuteItem&&!canExecuteItem(targetItem)){onMessage('이 그룹에는 실행 권한이 없습니다.');return;}
      if(isAgent){
        const run=isAgentOrchestratorItem(targetItem)
          ?multiAgentStore.runOrchestrator(id)
          :isAgentInputItem(targetItem)
            ?multiAgentStore.runInput(id)
            :isAgentRouterItem(targetItem)
              ?multiAgentStore.runRouter(id)
              :multiAgentStore.runAgent(id);
        void run.then(()=>{
          if(!mounted)return;
          const state=multiAgentStore.getNodeState(id);
          if(state?.error)onMessage(state.error);
          else if(state?.completed)onMessage(state.failed?'에이전트 작업에 실패했습니다.':'에이전트 작업을 완료했습니다.');
        });
        return;
      }
      const run=targetItem?.kind==='shape'&&targetItem?.runtimeRole==='executor'?store.run(id):store.runCode(id);
      void run.then(()=>{
        if(!mounted)return;
        const state=store.get(id);
        if(state?.error)onMessage(state.error);
        else if(state?.completed)onMessage(state.failed?'코드 실행에 실패했습니다. 연결된 결과 객체를 확인하세요.':'코드 실행을 완료했습니다.');
      });
    };
    document.addEventListener('keydown',onKeyDown,true);
    return()=>{mounted=false;document.removeEventListener('keydown',onKeyDown,true);};
  },[]);
}
