export function ForkedListVariant({ items, highlight }) {
  const filtered = highlight ? items.filter((i) => i.label.includes(highlight)) : items;
  const total = filtered.length;
  return (
    <div>
      <div className="list-count">Total: {total}</div>
      <ul className="list">
        {filtered.map((item) => (
          <li key={item.id}>
            {item.label}
            {item.urgent ? <span className="badge">!</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
