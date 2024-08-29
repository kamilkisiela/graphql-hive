export type Breadcrumb = (message: string) => void;

export function createBreadcrumb() {
  return (message: string) => {
    console.debug(message);
  };
}
