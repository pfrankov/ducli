import { useState, useEffect } from 'react';

export function ToggleB({ defaultOn = false }) {
  const [value, setValue] = useState(defaultOn);
  useEffect(() => {
    console.log('mounted B');
  }, []);
  const onToggle = () => setValue((v) => !v);
  return (
    <section>
      <p>Status: {value ? 'on' : 'off'}</p>
      <button onClick={onToggle}>flip</button>
    </section>
  );
}
