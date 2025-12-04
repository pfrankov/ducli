export function CardB({ title, description }) {
  const onSelect = () => console.log('select B');
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{description}</p>
      <button onClick={onSelect}>Open card</button>
    </div>
  );
}
