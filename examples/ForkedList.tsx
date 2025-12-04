export function ForkedList({ items }) {
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  );
}
