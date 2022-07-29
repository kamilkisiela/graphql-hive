import { css } from '@emotion/react';
import { sanitize } from 'dompurify';
import snarkdown from 'snarkdown';

const styles = css`
  a {
    color: #f4b740;
  }
  a:hover {
    text-decoration: underline;
  }

  code {
    color: #f4b740;
    background-color: #fcfcfc1a;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }
`;

export function Markdown(props: { content: string; className?: string }) {
  return (
    <div
      className={props.className}
      css={styles}
      dangerouslySetInnerHTML={{ __html: sanitize(snarkdown(props.content)) }}
    />
  );
}
