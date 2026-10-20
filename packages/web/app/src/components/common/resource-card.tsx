import { useMemo, type ReactNode } from 'react';
import { Globe, History } from 'lucide-react';
import { Card } from '@/components/ui/primitives/card/card';
import { Sparkline } from '@/components/ui/primitives/chart/sparkline';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { subDays } from '@/lib/date-time';
import { useFormattedNumber } from '@/lib/hooks';
import { pluralize } from '@/lib/utils';
import * as styles from './resource-card.css';

export function ResourceCard(props: {
  /** Names the resource in the schema-versions tooltip, and reserves a skeleton line for `subtitle`. */
  kind: 'project' | 'target';
  /** `null` while loading, which is what swaps the name and counts for skeletons. */
  name: string | null;
  /** Second line under the name. Projects show their type here; targets have nothing to show. */
  subtitle?: string;
  renderLink: (children: ReactNode) => ReactNode;
  highestNumberOfRequests: number;
  requestsOverTime: { date: string; value: number }[] | null;
  schemaVersionsCount: number | null;
  days: number;
}) {
  const { highestNumberOfRequests } = props;

  const requests = useMemo(() => {
    if (props.requestsOverTime?.length) {
      return props.requestsOverTime.map<[string, number]>(node => [node.date, node.value]);
    }

    // A flat pair rather than an empty array, so the chart draws a baseline instead of nothing.
    return [
      [new Date(subDays(new Date(), props.days)).toISOString(), 0],
      [new Date().toISOString(), 0],
    ] as [string, number][];
  }, [props.requestsOverTime]);

  const totalNumberOfRequests = useMemo(
    () => requests.reduce((acc, [_, value]) => acc + value, 0),
    [requests],
  );
  const totalNumberOfVersions = props.schemaVersionsCount ?? 0;

  const requestsInDateRange = useFormattedNumber(totalNumberOfRequests);
  const schemaVersionsInDateRange = useFormattedNumber(totalNumberOfVersions);

  return (
    <div className={styles.resourceCardDiv}>
      <Card variants={{ onSurface: 'raised', interactive: true, bodyPadding: 'none' }}>
        {props.renderLink(
          <>
            <div className={styles.resourceCardDiv2}>
              <div className={styles.resourceCardDiv3}>
                <div>
                  <Sparkline
                    name="Requests"
                    data={requests}
                    max={highestNumberOfRequests}
                    animation={props.name != null}
                  />
                </div>
                <div className={styles.resourceCardDiv4}>
                  {props.name != null ? (
                    <div>
                      <h4 className={styles.resourceCardH4}>{props.name}</h4>
                      {props.subtitle ? (
                        <p className={styles.resourceCardP}>{props.subtitle}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <div className={styles.resourceCardDiv5} />
                      {/* Only reserve the second line for a kind that has a subtitle to load into. */}
                      {props.kind === 'project' ? (
                        <div className={styles.resourceCardDiv6} />
                      ) : null}
                    </div>
                  )}
                  <div className={styles.resourceCardDiv7}>
                    {props.name != null ? (
                      <>
                        <Tooltip
                          trigger={
                            <div className={styles.resourceCardDiv8}>
                              <Globe className={styles.resourceCardGlobe} />
                              <div className={styles.resourceCardDiv9}>
                                {requestsInDateRange}{' '}
                                {pluralize(totalNumberOfRequests, 'request', 'requests')}
                              </div>
                            </div>
                          }
                          content={`Number of GraphQL requests in the last ${props.days} days.`}
                        />
                        <Tooltip
                          trigger={
                            <div className={styles.resourceCardDiv10}>
                              <History className={styles.resourceCardHistory} />
                              <div className={styles.resourceCardDiv11}>
                                {schemaVersionsInDateRange}{' '}
                                {pluralize(totalNumberOfVersions, 'commit', 'commits')}
                              </div>
                            </div>
                          }
                          content={`Number of schemas pushed to this ${props.kind} in the last ${props.days} days.`}
                        />
                      </>
                    ) : (
                      <>
                        <div className={styles.resourceCardDiv12} />
                        <div className={styles.resourceCardDiv13} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>,
        )}
      </Card>
    </div>
  );
}
