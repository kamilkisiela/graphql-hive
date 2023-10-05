/**
 * Verify whether a string is a legit GitHub repository string.
 * Example: `foo/bar`
 */
export function isGitHubRepositoryString(repository: string): repository is `${string}/${string}` {
  const [owner, name] = repository.split('/');
  return !!owner && isLegitGitHubName(owner) && !!name && isLegitGitHubName(name);
}

/** @source https://stackoverflow.com/a/59082561 */
function isLegitGitHubName(str: string) {
  return /^[\w-\.]+$/i.test(str);
}
