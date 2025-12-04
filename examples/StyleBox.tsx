import './Box.css';

export function StyleBox({ children }) {
  return (
    <div className="box base">
      <div className="box-header">Box</div>
      <div className="box-body">{children}</div>
    </div>
  );
}
