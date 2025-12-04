import './BoxAlt.css';

export function StyleBoxAlt({ children }) {
  return (
    <div className="box base">
      <header className="box-header">Box</header>
      <section className="box-body">{children}</section>
    </div>
  );
}
