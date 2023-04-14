import { ReactElement } from 'react';
import { clsx } from 'clsx';
import reactStringReplace from 'react-string-replace';
import { Label } from '@/components/common';
import { CriticalityLevel, SchemaChangeFieldsFragment } from '@/graphql';

function labelize(message: string) {
  // Turn " into '
  // Replace '...' with <Label>...</Label>
  return reactStringReplace(message.replace(/"/g, "'"), /'([^']+)'/gim, (match, i) => {
    return <Label key={i}>{match}</Label>;
  });
}

const titleMap: Record<CriticalityLevel, string> = {
  Safe: 'Safe Changes',
  Breaking: 'Breaking Changes',
  Dangerous: 'Dangerous Changes',
};

const criticalityLevelMapping = {
  [CriticalityLevel.Safe]: clsx('text-emerald-400'),
  [CriticalityLevel.Dangerous]: clsx('text-yellow-400'),
} as Record<CriticalityLevel, string>;

function ChangesBlock({
  changes,
  criticality,
}: {
  changes: SchemaChangeFieldsFragment[];
  criticality: CriticalityLevel;
}): ReactElement | null {
  const filteredChanges = changes.filter(c => c.criticality === criticality);

  if (!filteredChanges.length) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
        {titleMap[criticality]}
      </h2>
      <ul className="list-inside list-disc pl-3 text-sm leading-relaxed">
        {filteredChanges.map((change, key) => (
          <li key={key} className={clsx(criticalityLevelMapping[criticality] ?? 'text-red-400')}>
            <span className="text-gray-600 dark:text-white">{labelize(change.message)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorsBlock({ title, errors }: { errors: string[]; title: React.ReactNode }) {
  if (!errors.length) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">{title}</h2>
      <ul className="list-inside list-disc pl-3 text-sm leading-relaxed">
        {errors.map((error, key) => (
          <li key={key} className="text-red-400">
            <span className="text-gray-600 dark:text-white">{labelize(error)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VersionErrorsAndChanges(props: {
  changes: {
    nodes: SchemaChangeFieldsFragment[];
    total: number;
  };
  errors: {
    nodes: Array<{
      message: string;
    }>;
    total: number;
  };
}) {
  const generalErrors = props.errors.nodes
    .filter(err => err.message.startsWith('[') === false)
    .map(err => err.message);
  const groupedServiceErrors = new Map<string, string[]>();

  for (const err of props.errors.nodes) {
    if (err.message.startsWith('[')) {
      const [service, ...message] = err.message.split('] ');
      const serviceName = service.replace('[', '');
      const errorMessage = message.join('] ');

      if (!groupedServiceErrors.has(serviceName)) {
        groupedServiceErrors.set(serviceName, [errorMessage]);
      }

      groupedServiceErrors.get(serviceName)!.push(errorMessage);
    }
  }

  const serviceErrorEntries = Array.from(groupedServiceErrors.entries());

  return (
    <div className="p-5">
      <div>
        {props.changes.total ? (
          <div>
            <div className="font-semibold">Schema Changes</div>
            <div>
              <div className="space-y-3 p-6">
                <ChangesBlock
                  changes={props.changes.nodes}
                  criticality={CriticalityLevel.Breaking}
                />
                <ChangesBlock
                  changes={props.changes.nodes}
                  criticality={CriticalityLevel.Dangerous}
                />
                <ChangesBlock changes={props.changes.nodes} criticality={CriticalityLevel.Safe} />
              </div>
            </div>
          </div>
        ) : null}
        {props.errors.total ? (
          <div>
            <div className="font-semibold">Composition errors</div>
            <div className="space-y-3 p-6">
              {generalErrors.length ? (
                <ErrorsBlock title="Top-level errors" errors={generalErrors} />
              ) : null}
              {serviceErrorEntries.length ? (
                <>
                  {serviceErrorEntries.map(([service, errors]) => (
                    <ErrorsBlock
                      key={service}
                      title={
                        <>
                          Errors from the <strong>"{service}"</strong> service
                        </>
                      }
                      errors={errors}
                    />
                  ))}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
