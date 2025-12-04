import { css } from '@emotion/css';

const box = css`
  border: 1px solid red;
  padding: 8px;
`;

const Wrapper = (children) => children;

export function CssInJsExample({ label }) {
  return <Wrapper><div className={box}>{label}</div></Wrapper>;
}
