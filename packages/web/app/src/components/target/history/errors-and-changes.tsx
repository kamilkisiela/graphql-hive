import { ReactElement } from 'react';
import { clsx } from 'clsx';
import reactStringReplace from 'react-string-replace';
import { Label } from '@/components/common';
import { Accordion } from '@/components/v2';
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
      <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
        {titleMap[criticality]}
      </h2>
      <ul className="list-inside list-disc pl-3 text-base leading-relaxed">
        {filteredChanges.map((change, key) => (
          <li key={key} className={clsx(criticalityLevelMapping[criticality] ?? 'text-red-400')}>
            <span className="text-gray-600 dark:text-white">{labelize(change.message)}</span>
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
  const generalErrors = props.errors.nodes.filter(err => err.message.startsWith('[') === false);
  const groupedServiceErrors = new Map<string, string[]>();

  props.errors.nodes.forEach(err => {
    if (err.message.startsWith('[')) {
      const [service, ...message] = err.message.split('] ');
      const serviceName = service.replace('[', '');
      const errorMessage = message.join('] ');

      if (!groupedServiceErrors.has(serviceName)) {
        groupedServiceErrors.set(serviceName, [errorMessage]);
      }

      groupedServiceErrors.get(serviceName)!.push(errorMessage);
    }
  });

  const serviceErrorEntries = Array.from(groupedServiceErrors.entries());

  return (
    <Accordion type="multiple" defaultValue={props.changes.total > 0 ? 'changes' : 'errors'}>
      {props.changes.total ? (
        <Accordion.Item value="changes">
          <Accordion.Header>Changes</Accordion.Header>
          <Accordion.Content>
            <div className="space-y-3 p-6">
              <ChangesBlock changes={props.changes.nodes} criticality={CriticalityLevel.Breaking} />
              <ChangesBlock
                changes={props.changes.nodes}
                criticality={CriticalityLevel.Dangerous}
              />
              <ChangesBlock changes={props.changes.nodes} criticality={CriticalityLevel.Safe} />
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ) : null}
      {props.errors.total ? (
        <Accordion.Item value="errors">
          <Accordion.Header>Composition errors</Accordion.Header>
          <Accordion.Content>
            <ul className="list-inside list-disc pl-3 text-base leading-relaxed">
              {generalErrors.map((error, key) => (
                <li key={key}>
                  <span className="text-gray-600 dark:text-white">{labelize(error.message)}</span>
                </li>
              ))}
              {serviceErrorEntries.map(([service, errors]) => (
                <li key={service}>
                  <span className="text-gray-600 dark:text-white">{service}</span>
                  <ul className="list-inside list-disc pl-3 text-base leading-relaxed">
                    {errors.map((error, key) => (
                      <li key={key}>
                        <span className="text-gray-600 dark:text-white">{labelize(error)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Accordion.Content>
        </Accordion.Item>
      ) : null}
    </Accordion>
  );
}
