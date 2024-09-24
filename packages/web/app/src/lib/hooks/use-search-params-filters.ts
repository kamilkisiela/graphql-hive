import { useRouter } from '@tanstack/react-router';

type SearchParamsFilter = string | string[];

export function useSearchParamsFilter<TValue extends SearchParamsFilter>(
  name: string,
  defaultState: TValue,
): [TValue, (value: TValue) => void] {
  const router = useRouter();
  const searchParams = router.latestLocation.search as any;

  const rawSearchValue =
    ((name as string) in searchParams && (searchParams[name] as string)) || null;
  const searchValue = (deserializeSearchValue(rawSearchValue) ?? defaultState) as TValue;

  const setSearchValue = (value: TValue) => {
    void router.navigate({
      search: {
        ...searchParams,
        [name]: serializeSearchValue(value),
      },
      replace: true,
    });
  };

  return [searchValue, setSearchValue];
}

function serializeSearchValue(value: string | string[]) {
  return Array.isArray(value) ? value.join(',') : value;
}

function deserializeSearchValue(value: string | null) {
  return value?.split(',');
}
