/** Decode bounded NDJSON without assuming TCP chunks align with UTF-8 or JSON lines. */
export async function readRuntimeStream(response, onOutput = () => {}) {
  if (!response.body) throw new Error('실행 출력 스트림을 열 수 없습니다.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', result, finished = false, total = 0;
  const frame = line => {
    if (!line.trim()) return;
    const value = JSON.parse(line);
    if (finished) throw new Error('실행 출력 순서가 올바르지 않습니다.');
    if (value.type === 'output' && typeof value.output === 'string') {
      total += value.output.length;
      if (total > 196608) throw new Error('실행 출력이 너무 큽니다.');
      onOutput(value.output);
    } else if (value.type === 'result' && value.result && typeof value.result === 'object') {
      finished = true; result = value.result;
    } else if (value.type === 'error') throw new Error(value.message || '코드 실행에 실패했습니다.');
    else throw new Error('실행 출력 형식을 확인할 수 없습니다.');
  };
  try {
    while (true) {
      const {value, done} = await reader.read();
      pending += decoder.decode(value, {stream: !done});
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) { frame(pending.slice(0, newline)); pending = pending.slice(newline + 1); }
      if (pending.length > 400000) throw new Error('실행 응답이 너무 큽니다.');
      if (done) break;
    }
    if (pending.trim()) frame(pending);
    if (!finished) throw new Error('실행 결과를 받기 전에 연결이 종료되었습니다.');
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
