import './Button.css';

export function PrimaryButton({ label, disabled }) {
  const handleClick = () => {
    if (disabled) return;
    alert(`Primary: ${label}`);
  };
  return (
    <button className="btn btn-primary" disabled={disabled} onClick={handleClick}>
      {label}
    </button>
  );
}
