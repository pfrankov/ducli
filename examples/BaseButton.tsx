export function BaseButton(props) {
  return (
    <button {...props}>
      {props.icon ? <span className="icon">{props.icon}</span> : null}
      {props.children}
    </button>
  );
}
