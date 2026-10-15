> 이전 브라우저 호스트 방식의 검증 기록입니다. 현재 동기화는 [호스트 없는 서버 동기화](canvas-server-sync.md)를 사용합니다.

# Recovering live synchronization without reconnecting

The reported canvas could remain in its synchronization overlay for more than
60 seconds despite both WebSockets being open. Reloading established a new term
and cleared the stalled handshake, but was not an acceptable recovery method.

Confirmed protocol gaps, reproduced in deterministic tests:

- A state reply or snapshot accepted by the local send queue was never retried
  if it did not reach its destination.
- A snapshot acknowledgment rejected by local backpressure was discarded.
- A lost multipart piece or acknowledgment could exhaust the four-part credit
  window forever.
- A follower already waiting for resync ignored newer ready markers.
- Snapshot ACKs were compared to the host's current sequence rather than the
  sequence actually sent, which could reject a valid ACK during live editing.

The session now retries handshake state and snapshots after one second, queues
blocked snapshot ACKs, retries missing parts after stalled progress, and remembers
up to 1,024 completed transfers per term to acknowledge duplicates without
applying them again. Duplicate snapshot ACKs cannot rewind peer progress.
Ready sequence checks run once per second; a missing last commit triggers a fresh
snapshot even when the follower is already waiting for recovery.

Broker-issued membership, host terms, ACL checks, client request counters,
translation idempotency and the existing four-part credit window remain in force.
Timeouts never promote a client or remove peers on their own. Permanent network
outages and suspended hosts cannot promise uninterrupted collaboration; these
changes address recoverable message loss/backpressure without manual reload.

Validation: all 167 Node tests pass. New regressions cover accepted-but-lost state,
snapshots, ACKs, multipart pieces/ACKs, blocked ACK sends, an already-paused
follower, a missing last translation commit and duplicate old ACKs.

A real Chrome/broker test injected six lost handshake/part/ACK/commit frames, transferred
approximately 2 MB of object state, and exercised four join/leave cycles while
sharing edits. The steady participant retained its original two sockets; the
follower also recovered on its existing sockets. The final shared coordinate was
verified in RedisJSON. No JavaScript exceptions occurred. Four storage HOST_FENCED results for old
membership terms were safely ignored after the term changed; neither steady
participant reconnected. These guards prevent stale hosts from persisting writes.
See `canvas-sync-recovery-results.json` for measured timings. Combined faults in
one handshake add multiple retry intervals, so these are recovery tests rather
than claims of zero network latency.

To repeat on a newly created, disposable empty canvas:

```sh
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs \
SYNC_SESSION_FILE=/owner-only/path/to/session.json \
node scripts/check-sync-recovery-browser.mjs
```

The session file contains `token`, `user`, and `canvas_id`; keep it private and
remove it after verification. The script refuses a nonempty canvas and uses the
normal app editor, broker, host protocol and storage path. Do not target a user's
working canvas. Existing browser tabs need one reload to load the new client;
subsequent tested recovery does not reload or reconnect.

An additional continuous-edit check on the final deployment performed 535
streamed edits through seven join/leave cycles (24 broker host-term changes).
The steady page retained exactly its two original sockets, had no error toasts
or JavaScript exceptions, and the final value was verified in RedisJSON and
by a fresh late joiner. Old-term fencing guards appeared in protocol frames
without causing a reconnect; see `canvas-sync-continuous-results.json`.
