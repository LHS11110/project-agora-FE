# Logic circuit display diagnostics

Reported: the 8-bit adder canvas (#2039) listed its logic wires as unrouteable.
A fresh browser on the existing deployment loaded all 189 objects with zero
recovery warnings. The reporter's already-open client bundle could not be
inspected, so a stale client is a possibility rather than a confirmed cause.

Confirmed diagnostic invalidation defect: a full spatial rebuild sets
`changedIds` to null. ObjectRecoveryControls treated this as an empty list and
could retain earlier invalid geometry results when item references had not
changed. The extracted diagnostic cache now rechecks all items for a full
rebuild and keeps the existing incremental path for partial updates.

Logic pin routing now obtains both endpoint rectangles directly. Enclosing
boards and unrelated objects do not participate in pin-route construction.
This also avoids enumerating every object to route each logic wire. Normal
connector obstacle avoidance is unchanged.

Regression checks cover all 46 example wires, finite path coordinates,
full spatial rebuilds, gate movement/rotation, missing endpoints and recovery,
and direct pin lookup with an enclosing board and structurally shared view.
The full Node suite passes 159 tests. No example objects were deleted or
rewritten to hide the warnings. Existing tabs need a reload to load the update.

Deployment verification: Project Orchestra production frontend export and HTTPS
gateway probe passed. Chrome loaded `/assets/index-BZdOoFCT.js` and canvas #2039
with 189 objects, zero recovery warnings, and the same result after reload.
