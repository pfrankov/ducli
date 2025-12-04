import './Button.css';

export function SecondaryButton({ label, disabled }) {
  const handleClick = () => {
    if (disabled) return;
    alert(`Secondary: ${label}`);
  };
  return (
    <button className="btn btn-secondary" disabled={disabled} onClick={handleClick}>
      {label}
    </button>
  );
}
