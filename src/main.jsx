import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomFamily, useAtomCallback } from 'jotai/utils';
import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Minimal reproduction of Jotai atomFamily stale-read bug.
 *
 * Root cause: atomFamily without an `areEqual` argument uses reference
 * equality (Map.get) for its cache key. Since the parameter is an object
 * literal, every call creates a new atom instance. When a derived atom
 * (mounted via React) re-evaluates, it swaps its dependency to a new
 * instance. A subsequent write through yet another instance updates the
 * source atom, but `invalidateDependents` cannot reach the derived atom
 * because the instance it depends on is not the one being invalidated.
 * The mounted-atom fast path (which skips recursive dep checking) then
 * returns the stale cached value.
 *
 * Fix: pass `shallowEqual` (or any structural comparator) as the second
 * argument to `atomFamily` so that all calls with the same `{ id }` value
 * resolve to the same atom instance.
 */

// ---- atoms ----

const sourceAtom = atom({ value: 1 });

// BUG: no areEqual → every { id: 'value' } creates a new atom instance
const lensFamily = atomFamily(({ id }) =>
  atom(
    (get) => get(sourceAtom)[id] ?? null,
    (_get, set, val) => set(sourceAtom, (prev) => ({ ...prev, [id]: val })),
  ),
);

// Derived atom that reads through the family.
// Each evaluation calls lensFamily({ id: 'value' }) with a NEW object,
// producing a new atom instance (without areEqual).
const derived = atom((get) => get(lensFamily({ id: 'value' })));

// ---- write action ----

// Writable atom that increments the value via a (different) family instance,
// then reads `derived` in the same write context.
const writeAction = atom(null, (get, set) => {
  const instance = lensFamily({ id: 'value' });
  const prev = get(instance);
  set(instance, prev + 1);
  return { direct: get(sourceAtom).value, derived: get(derived) };
});

// ---- UI ----

function App() {
  const value = useAtomValue(derived); // mount via React subscription
  const [results, setResults] = useState([]);

  // useAtomCallback captures (get, set) in a closure — same pattern as
  // the real app's useActionHandler + async thunk actions.
  const captureGetSet = useAtomCallback(
    useCallback((get, set) => ({ get, set }), []),
  );

  const runTest = useCallback(async () => {
    // 1st write (synchronous, inside useAtomCallback)
    const { get, set } = captureGetSet();
    set(writeAction);

    // Wait for React re-render. This causes `derived` to re-evaluate,
    // which creates a new lensFamily instance and swaps the dependency.
    await new Promise((r) => setTimeout(r, 100));

    // 2nd write using the CAPTURED get/set (simulates an async callback
    // like enqueueExecution running after the React flush).
    const { direct, derived: derivedVal } = set(writeAction);
    const match = direct === derivedVal;

    setResults((r) => [
      ...r,
      { direct, derived: derivedVal, match },
    ]);
  }, [captureGetSet]);

  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h2>Jotai atomFamily stale-read reproduction</h2>
      <p>
        Derived value (from React): <strong>{value}</strong>
      </p>
      <button onClick={runTest}>Run async test</button>
      <h3>Results</h3>
      {results.map((r, i) => (
        <p key={i} style={{ color: r.match ? 'green' : 'red' }}>
          #{i + 1}: direct={r.direct} derived={r.derived}{' '}
          {r.match ? 'OK' : 'STALE!'}
        </p>
      ))}
      {results.length === 0 && <p>(click the button)</p>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
