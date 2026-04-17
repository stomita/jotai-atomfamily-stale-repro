import { atom, useAtomValue } from 'jotai';
import { atomFamily, useAtomCallback } from 'jotai/utils';
import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';

const sourceAtom = atom({ value: 1 });

const lensFamily = atomFamily(({ id }) =>
  atom(
    (get) => get(sourceAtom)[id] ?? null,
    (_get, set, val) => set(sourceAtom, (prev) => ({ ...prev, [id]: val })),
  ),
);

const derived = atom((get) => get(lensFamily({ id: 'value' })));

function App() {
  const value = useAtomValue(derived);
  const [results, setResults] = useState([]);

  const doTest = useAtomCallback(
    useCallback((get, set) => {
      const instance = lensFamily({ id: 'value' });
      const prev = get(instance);
      set(instance, prev + 1);

      // Read derived inside write context (same as test-stale.html)
      const direct1 = get(sourceAtom).value;
      const derived1 = get(derived);
      console.log(`[WRITE-1] direct=${direct1} derived=${derived1} match=${direct1 === derived1}`);

      return { get, set };
    }, []),
  );

  const doAsyncTest = useCallback(async () => {
    const { get, set } = await doTest();

    await new Promise(r => setTimeout(r, 100));

    const instance2 = lensFamily({ id: 'value' });
    const prev2 = get(instance2);
    set(instance2, prev2 + 1);

    const direct = get(sourceAtom).value;
    const derivedVal = get(derived);
    const match = direct === derivedVal;
    console.log(`[WRITE-2] direct=${direct} derived=${derivedVal} match=${match}`);

    setResults(r => [...r, { direct, derived: derivedVal, match }]);
  }, [doTest]);

  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h2>Jotai atomFamily stale-read reproduction</h2>
      <p>Derived value (from React): <strong>{value}</strong></p>
      <button onClick={doAsyncTest}>Run async test</button>
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
