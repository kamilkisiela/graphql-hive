import { Skeleton } from '@/components/ui/primitives/skeleton/skeleton';

// Own module so foundry can render it: the subpage pulls in `@/env/frontend`, which previews cannot load.
export function SingleSignOnLoadingSkeleton() {
  return (
    <>
      {/* Overview Section */}
      <section className="space-y-8">
        <span className="flex w-24">
          <Skeleton variants={{ size: 'xl', width: 'full' }} />
        </span>
        <span className="flex w-72">
          <Skeleton variants={{ width: 'full' }} />
        </span>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-8">
              <span className="flex w-36">
                <Skeleton variants={{ width: 'full' }} />
              </span>
              <span className="flex w-80">
                <Skeleton variants={{ width: 'full' }} />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* OIDC Configuration Section */}
      <section className="space-y-8">
        <span className="flex w-40">
          <Skeleton variants={{ size: 'xl', width: 'full' }} />
        </span>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-8">
              <span className="flex w-36">
                <Skeleton variants={{ width: 'full' }} />
              </span>
              <span className="flex w-72">
                <Skeleton variants={{ width: 'full' }} />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Registered Domains Section */}
      <section className="space-y-8">
        <span className="flex w-44">
          <Skeleton variants={{ size: 'xl', width: 'full' }} />
        </span>
        <span className="flex w-96">
          <Skeleton variants={{ width: 'full' }} />
        </span>
        <div className="flex gap-8">
          <span className="flex w-24">
            <Skeleton variants={{ width: 'full' }} />
          </span>
          <span className="flex w-24">
            <Skeleton variants={{ width: 'full' }} />
          </span>
        </div>
      </section>

      {/* Access Settings Section */}
      <section className="space-y-8">
        <span className="flex w-36">
          <Skeleton variants={{ size: 'xl', width: 'full' }} />
        </span>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="flex w-40">
                <Skeleton variants={{ width: 'full' }} />
              </span>
              <span className="flex w-72">
                <Skeleton variants={{ size: 'sm', width: 'full' }} />
              </span>
            </div>
            <span className="block h-6 w-11">
              <Skeleton variants={{ shape: 'block' }} />
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
