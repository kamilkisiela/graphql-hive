import { Component, ReactNode } from 'react';
import { UseQueryState } from 'urql';
import { QueryError } from '@/components/common/DataWrapper';
import { Spinner } from '@/components/v2';

export class DataWrapper<TData, TVariables> extends Component<{
  query: UseQueryState<TData, TVariables>;
  showStale?: boolean;
  children(props: { data: TData }): ReactNode;
  spinnerComponent?: ReactNode;
}> {
  render() {
    const { query, children, spinnerComponent } = this.props;

    if (query.fetching) {
      return spinnerComponent ?? <Spinner />;
    }

    if (query.error) {
      return <QueryError error={query.error} />;
    }

    if (!query.data) {
      return spinnerComponent ?? <Spinner />;
    }

    return children({ data: query.data });
  }
}
