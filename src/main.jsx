import { atom, useAtomValue } from 'jotai';
import { atomFamily, useAtomCallback } from 'jotai/utils';
import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';

const sourceAtom = atom({ value: 1 });

const lensFamily = atomFamily(({ id }) =>
  atom(
    (get) => get(sourceAtom)[id] ?? null,
    (_get, set, val) => set(sourceAtom, (prev) => ({ ...prev, [id]: val }))
  )
);

const derivedAtom = atom((get) => get(lensFamily({ id: 'value' })));

function App() {
  const value = useAtomValue(derivedAtom);
  const [results, setResults] = useState([]);

  const doAsyncTest = useAtomCallback(async (get, set) => {
    const instance1 = lensFamily({ id: 'value' });
    const prev = get(instance1);
    set(instance1, prev + 1);

    const direct1 = get(sourceAtom).value;
    const derived1 = get(derivedAtom);
    const match1 = direct1 === derived1;
    console.log(
      `[WRITE-1] direct=${direct1} derived=${derived1} match=${match1}`
    );

    await new Promise((r) => setTimeout(r, 100));

    const instance2 = lensFamily({ id: 'value' });
    const prev2 = get(instance2);
    set(instance2, prev2 + 1);

    const direct2 = get(sourceAtom).value;
    const derived2 = get(derivedAtom);
    const match2 = direct2 === derived2;
    console.log(
      `[WRITE-2] direct=${direct2} derived=${derived2} match=${match2}`
    );

    setResults((r) => [
      ...r,
      { direct: direct1, derived: derived1, match: match1 },
      { direct: direct2, derived: derived2, match: match2 },
    ]);
  }, []);

  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h2>Jotai atomFamily stale-read reproduction</h2>
      <p>
        Derived value (from React): <strong>{value}</strong>
      </p>
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
