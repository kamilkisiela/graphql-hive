import * as styles from './header.css';

type HeaderProps = {
  children?: React.ReactNode;
};

export function Header({ children }: HeaderProps) {
  return (
    <div className={styles.headerDiv}>
      <header className={styles.headerHeader}>{children}</header>
    </div>
  );
}
