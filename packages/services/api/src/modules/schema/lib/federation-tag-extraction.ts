import { Kind, visit, type DirectiveNode, type DocumentNode } from 'graphql';

type TagExtractionStrategy = (directiveNode: DirectiveNode) => string | null;

const tagDirectiveImportUrl = 'https://specs.apollo.dev/tag/';

function createFederationDirectiveStrategy(directiveName: string): TagExtractionStrategy {
  return (directiveNode: DirectiveNode) => {
    if (
      directiveNode.name.value === directiveName &&
      directiveNode.arguments?.[0].name.value === 'name' &&
      directiveNode.arguments?.[0]?.value.kind === Kind.STRING
    ) {
      return directiveNode.arguments[0].value.value ?? null;
    }
    return null;
  };
}

export function getTagDirectiveNameFromFederation2SupergraphSDL(
  documentNode: DocumentNode,
): string | null {
  for (const definition of documentNode.definitions) {
    if (
      (definition.kind !== Kind.SCHEMA_DEFINITION && definition.kind !== Kind.SCHEMA_EXTENSION) ||
      !definition.directives
    ) {
      continue;
    }

    for (const directive of definition.directives) {
      // TODO: maybe not rely on argument order - but the order seems stable
      if (
        directive.name.value === 'link' &&
        directive.arguments?.[0].name.value === 'url' &&
        directive.arguments[0].value.kind === Kind.STRING &&
        directive.arguments[0].value.value.startsWith(tagDirectiveImportUrl)
      ) {
        if (
          directive.arguments[1]?.name.value === 'as' &&
          directive.arguments[1].value.kind === Kind.STRING
        ) {
          return directive.arguments[1].value.value;
        }
        return 'tag';
      }
    }
    return null;
  }
  return null;
}

/**
 * Extract all
 */
export function extractTagsFromFederation2SupergraphSDL(documentNode: DocumentNode) {
  const federationDirectiveName = getTagDirectiveNameFromFederation2SupergraphSDL(documentNode);

  if (federationDirectiveName === null) {
    return null;
  }

  const tagStrategy = createFederationDirectiveStrategy(federationDirectiveName);

  const tags = new Set<string>();

  function collectTagsFromDirective(directiveNode: DirectiveNode) {
    const tag = tagStrategy(directiveNode);
    if (tag) {
      tags.add(tag);
    }
  }

  visit(documentNode, {
    [Kind.DIRECTIVE](directive) {
      collectTagsFromDirective(directive);
    },
  });

  return Array.from(tags);
}
