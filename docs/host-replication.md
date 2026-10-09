# Host-authoritative canvas replication

Persistent canvas objects use the hosted protocol (`host_protocol: 1`). Cursor,
laser and editor presence still use direct peer channels. Media connections are
unchanged. Object drawing previews remain local until approved by the host.

The running C++ image must include this protocol; updating source files alone
does not update an existing container. Rebuild and recreate the backend's `cpp`
service after protocol changes. A missing or incompatible host protocol now
shows an explicit server compatibility error instead of waiting indefinitely.
After changing `VITE_WS_BASE_URL`, recreate the frontend development container
as well. Keep it empty when using the HTTPS gateway so both canvas and RTC
sockets follow the current browser origin using WSS.

## Election and fencing

The signaling registry supplies a complete membership and a unique `host.term`.
The highest eligible peer ID is selected using the priority rule of the
[Bully algorithm](https://csis.pace.edu/~marchese/CS865/Papers/garcia_elections.pdf).
Because every participant already receives the full server membership, the
registry evaluates the priority directly rather than racing timeout elections.
An eligible host is an administrator or a participant whose groups cover every
active participant's groups. If nobody qualifies, approved replication stays
blocked; previously synchronized users can still queue private drafts.

Joining/leaving changes the term and pauses approved replication. Loss of a DataChannel
alone never removes a participant or elects an independent host. The server
rejects persistence from any socket other than the bound elected host, and from
any obsolete term. This applies to direct legacy object messages too.

## Initial state and host changes

1. Load the server's persisted objects as a baseline, under a loading overlay.
2. The coordinator gathers all members' **approved** object records and deletion
   tombstones, merging by version. Local drafts are excluded.
3. Send an ACL-filtered complete snapshot to each member on the reliable ordered
   sync channel. Large snapshots are partitioned by object.
4. Wait for every snapshot acknowledgement before announcing `host_ready`.
5. On first entry, only then enable pointer interaction, keyboard shortcuts and
   the code API. Once synchronized, users may keep editing through subsequent
   elections, reconnection and snapshot recovery.

All active members must be reachable during this barrier. This intentionally
prefers consistent initialization over availability. A successor re-saves the
approved records so an unsaved predecessor update that reached another member
is not lost. Snapshot and live-commit sequence gaps force another sync barrier.
Stored objects carry `__host_version`; deletions replace the object with a
`host-tombstone` containing only its version and original ACL. Tombstones are
excluded from visible objects. Keeping these versions across complete session
restarts prevents an old reconnecting participant from resurrecting a deletion
or overriding a newer stored update.

## Editing and rates

Editing handlers build private drafts. `useHostCanvas.setItems` turns field
differences into proposals. Local previews include pending work, while
`committedItemsRef`, shared records and storage contain only host-approved state. Text,
code and notes carry Automerge documents, which the host merges to preserve
concurrent edits. The host validates the whole proposal and the sender's object
permissions before assigning an approved version and sequence.

## Queues and request counters

During handoff, both unsent operations and sent-but-unacknowledged requests stay
in the originating tab's memory. Reconstruct local previews over each approved
snapshot; never send drafts as part of the approved-state handoff. After the
snapshot barrier, drain requests in order with one in-flight request per user,
while subsequent edits continue accumulating in the queue. Keep the request ID,
client session ID and request count across host terms and even an RTC peer ID
change. Retry unanswered requests at 500 ms intervals using the same immutable
payload and count. Queues are not persisted across closing/reloading the tab.

Before sending object changes, exchange `host_client_hello` / `host_client_state`
to bind the client session to its authenticated peer and synchronize the last
successful count (initially zero). Counter keys include the server-supplied
nickname/tag and a random tab session ID, so different users and different tabs
do not share a request stream. Every proposal includes `clientId`, `requestCount`
and `requestId = clientId-requestCount`.

The coordinator retains **one integer per client session**, not request receipts:

- Only `lastCount + 1` can be applied; update the count only after successful
  validation and application.
- `requestCount == lastCount` returns a matching success acknowledgement without
  applying the request again, allowing recovery from a lost response.
- Lower counts are rejected without execution; skipped counts are rejected too.
- Invalid requests never advance the count. Rejections stop that client's queue;
  the status strip offers retry of the same request/count. Subsequent work stays
  queued until that request succeeds.

`host_received`, broadcasts, snapshots and counter handshakes do **not** release
the next request. A matching `host_ack` must contain the exact request ID, client
session and count, with `lastCount == requestCount`. Its sequence must already be
applied locally; an early acknowledgement waits for the corresponding commit.
The acknowledgement is about host-approved application, not durable Redis storage.
Success responses include counts of creates, updates and deletes; duplicate
responses need only the matching count, and the sender derives the summary from
its unchanged pending payload. Only the latest UI response is retained locally.

Approved commits carry the updated counter alongside object records. Replicas
transfer current counters in bounded `host_counters` chunks during host handoff.
After restoring a snapshot, resend the still-pending request and require the new
host's matching success acknowledgement, even when its count already shows that
the request was applied. Deduplication memory depends on the number of client
sessions, not the number of requests. Counters are held in memory across handoff,
not persisted as a durable request log across a complete session restart.

- Proposals to the host: 30 FPS target.
- Host-approved broadcasts to followers: 30 FPS target.
- Coalesced host persistence batches: 10 FPS target.

These are time-based sampling rates, not counts of browser paint frames. Timer
throttling can reduce delivery frequency; safety does not depend on the timer.
Snapshots, commits and acknowledgements share one ordered DataChannel so bulk
transfers cannot overtake initialization. Duplicate proposal IDs and old terms
cannot reapply approved work. Storage errors freeze the session and require recovery instead of
silently applying independent follower state.

`host_batch_result: {ok: true, status: "queued"}` confirms admission to the
existing server FIFO persistence queue, **not** completion of a Redis write.
Host acknowledgement is likewise distinct from durable storage: if the host
and every replica disappear before storage completes, this protocol cannot
recover the lost state. A stronger guarantee needs durable server acknowledgements
or a consensus log before presenting changes as durable.

## Deployment and checks

Deploy the matching backend hosted protocol with the frontend. An older backend
does not provide host terms or support `host_item_batch`; the frontend therefore
keeps the loading gate closed. Existing legacy participants must reload before a
hosted session can become ready.

```sh
node --test tests/*.test.js
npm run build
```

The backend adds `cpp/tests/canvas_host_test.cpp` to CTest. A standalone election
and fencing check can also be built without the server's external dependencies:

```sh
c++ -std=c++17 -I cpp/include cpp/tests/canvas_host_test.cpp -o /tmp/canvas-host-test
/tmp/canvas-host-test
```
