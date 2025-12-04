import { useState, useEffect } from 'react';

export function ToggleA({ initial = false }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    console.log('mounted A');
  }, []);
  const onToggle = () => setValue((v) => !v);
  return (
    <div>
      <span>{value ? 'on' : 'off'}</span>
      <button onClick={onToggle}>toggle</button>
    </div>
  );
}
