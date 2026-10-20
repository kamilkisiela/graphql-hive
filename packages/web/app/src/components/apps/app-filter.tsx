import { useEffect, useRef, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/primitives/input/input';
import { useRouter } from '@tanstack/react-router';
import * as styles from './app-filter.css';

// The URL carries the settled term, so the route loader runs once per pause, not per keystroke.
export function AppFilter(props: { search: string }) {
  const router = useRouter();
  const [value, setValue] = useState(props.search);
  // The term the URL last agreed with; a change from elsewhere (back, Clear filter) resets to it.
  const settled = useRef(props.search);
  useEffect(() => {
    if (props.search !== settled.current) {
      settled.current = props.search;
      setValue(props.search);
    }
  }, [props.search]);
  useEffect(() => {
    if (value === settled.current) {
      return;
    }
    const handler = setTimeout(() => {
      settled.current = value;
      void router.navigate({
        to: '.',
        search: { ...router.latestLocation.search, search: value === '' ? undefined : value },
        replace: true,
      });
    }, 500);
    return () => clearTimeout(handler);
  }, [value, router]);

  return (
    <div className={styles.appFilterDiv}>
      <Input
        placeholder="Search by operation name..."
        leadingIcon={SearchIcon}
        value={value}
        onChange={event => setValue(event.target.value)}
      />
    </div>
  );
}
