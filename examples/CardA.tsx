export function CardA({ title, description }) {
  const onSelect = () => console.log('select A');
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{description}</p>
      <button onClick={onSelect}>Open</button>
    </div>
  );
}
