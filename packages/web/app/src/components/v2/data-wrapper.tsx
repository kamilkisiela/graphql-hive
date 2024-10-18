import { Component, ReactNode } from 'react';
import { AnyVariables, UseQueryState } from 'urql';
import { QueryError } from '@/components/ui/query-error';

export class DataWrapper<TData, TVariables extends AnyVariables> extends Component<{
  query: UseQueryState<TData, TVariables>;
  showStale?: boolean;
  organizationSlug: string | null;
  children(props: { data: TData }): ReactNode;
  spinnerComponent?: ReactNode;
}> {
  render() {
    const { query, children, spinnerComponent } = this.props;
    const { fetching, error, data } = query;
    if (fetching) {
      return spinnerComponent;
    }

    if (error) {
      return <QueryError organizationSlug={this.props.organizationSlug} error={error} />;
    }

    if (!data) {
      return spinnerComponent;
    }

    return children({ data });
  }
}
