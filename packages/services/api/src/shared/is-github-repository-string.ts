/**
 * Verify whether a string is a legit GitHub repository string.
 * Example: `foo/bar`
 */
export function isGitHubRepositoryString(repository: string): repository is `${string}/${string}` {
  const [owner, name] = repository.split('/');
  return !!owner && isAlphaNumeric(owner) && !!name && isAlphaNumeric(name);
}

function isAlphaNumeric(str: string) {
  return /^[a-z0-9]+$/i.test(str);
}
