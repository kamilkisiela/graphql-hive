import { ReactElement } from 'react';
import { clsx } from 'clsx';
import reactStringReplace from 'react-string-replace';
import { Label } from '@/components/common';
import { Tooltip } from '@/components/v2';
import { CriticalityLevel, SchemaChangeFieldsFragment } from '@/graphql';

export function labelize(message: string) {
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

export function ChangesBlock(props: {
  changes: SchemaChangeFieldsFragment[];
  criticality: CriticalityLevel;
}): ReactElement | null {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
        {titleMap[props.criticality]}
      </h2>
      <ul className="list-inside list-disc pl-3 text-sm leading-relaxed">
        {props.changes.map((change, key) => (
          <li
            key={key}
            className={clsx(criticalityLevelMapping[props.criticality] ?? 'text-red-400', ' my-1')}
          >
            <MaybeWrapTooltip tooltip={change.criticalityReason ?? null}>
              <span className="text-gray-600 dark:text-white">{labelize(change.message)}</span>
            </MaybeWrapTooltip>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MaybeWrapTooltip(props: { children: React.ReactNode; tooltip: string | null }) {
  return props.tooltip ? (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip content={props.tooltip}>{props.children}</Tooltip>
    </Tooltip.Provider>
  ) : (
    <>{props.children}</>
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
          <li key={key} className="my-1 text-red-400">
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

  const breakingChanges = props.changes.nodes.filter(
    c => c.criticality === CriticalityLevel.Breaking,
  );
  const dangerousChanges = props.changes.nodes.filter(
    c => c.criticality === CriticalityLevel.Dangerous,
  );
  const safeChanges = props.changes.nodes.filter(c => c.criticality === CriticalityLevel.Safe);

  return (
    <div className="p-5">
      <div>
        {props.changes.total ? (
          <div>
            <div className="font-semibold">Schema Changes</div>
            <div>
              <div className="space-y-3 p-6">
                {breakingChanges.length ? (
                  <ChangesBlock changes={breakingChanges} criticality={CriticalityLevel.Breaking} />
                ) : null}
                {dangerousChanges.length ? (
                  <ChangesBlock
                    changes={dangerousChanges}
                    criticality={CriticalityLevel.Dangerous}
                  />
                ) : null}
                {safeChanges.length ? (
                  <ChangesBlock changes={safeChanges} criticality={CriticalityLevel.Safe} />
                ) : null}
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
