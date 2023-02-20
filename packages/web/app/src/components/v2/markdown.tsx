import { ReactElement } from 'react';
import { sanitize } from 'dompurify';
import snarkdown from 'snarkdown';
import { css } from '@emotion/react';

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}): ReactElement {
  return (
    <div
      className={className}
      css={css`
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
      `}
      dangerouslySetInnerHTML={{ __html: sanitize(snarkdown(content)) }}
    />
  );
}
