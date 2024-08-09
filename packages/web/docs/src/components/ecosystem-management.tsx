import { ReactNode, useLayoutEffect, useState } from 'react';
import { cn } from '../lib';
import { BookIcon } from './book-icon';
import { CallToAction } from './call-to-action';
import { CheckIcon } from './check-icon';
import { HighlightDecoration } from './decorations';
import { Heading } from './heading';

export function EcosystemManagementSection() {
  return (
    <section
      className={
        'bg-green-1000 relative mx-1 overflow-hidden rounded-3xl text-white md:mx-6' +
        ' p-8 md:p-[72px]'
      }
    >
      <div className="mx-auto flex w-[1392px] max-w-full flex-row flex-wrap gap-x-[120px] gap-y-16">
        <div className="flex w-[488px] flex-col gap-12">
          <Heading as="h3" size="sm">
            360° GraphQL Ecosystem Management
          </Heading>
          <ul className="mx-auto flex list-none flex-col gap-y-6 text-white/80">
            {[
              'A complete ecosystem covering all your dev and management needs.',
              'Full Federation Support out of the box. Drop-in replacement for Apollo GraphOS (Apollo Studio)',
              <>
                Use tools of your choice — either dive into our full GraphQL ecosystem,
                or&nbsp;build your own stack, connecting Apollo Federation, GraphQL Mesh, Stitching
                and more.
              </>,
              'Learn how to effortlessly migrate from Apollo and keep your GraphQL management vendor-unlocked.',
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-4">
                <CheckIcon className="mt-0.5 shrink-0 text-blue-400" />
                {text}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-x-4 gap-y-2 md:flex-row">
            <CallToAction href="/" variant="primary-inverted">
              Migrate from Apollo
            </CallToAction>
            <CallToAction href="/" variant="secondary">
              <BookIcon />
              Explore the full Ecosystem
            </CallToAction>
          </div>
        </div>
        <Illustration />
      </div>
      <HighlightDecoration className="pointer-events-none absolute right-0 top-[-22px] overflow-visible" />
    </section>
  );
}

function Illustration() {
  const [highlightedEdge, setHighlightedEdge] = useState<number | null>(4);

  useLayoutEffect(() => {
    const interval = setInterval(() => {
      setHighlightedEdge(prev => (prev % 6) + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-[400px]">
      <div
        className="flex flex-row"
        style={{
          '--node-h': '96px',
          '--big-node-h': '222px',
          '--label-h': '32px',
          '--node-w': '240px',
          '--gap': '80px',
        }}
      >
        <Edge top bottom left highlighted={highlightedEdge === 5}>
          <div
            style={{
              height:
                'calc(var(--node-h) / 2 + var(--gap) + var(--big-node-h) / 2 - var(--label-h) / 2)',
            }}
            className="ml-[calc(1rem+1px-var(--bw))] mt-[calc(var(--node-h)/2)] w-10 rounded-tl-xl"
          />
          <EdgeLabel>5</EdgeLabel>
          <div
            style={{
              height:
                'calc(var(--node-h) / 2 + var(--gap) + var(--big-node-h) / 2 - var(--label-h) / 2)',
            }}
            className="ml-[calc(1rem+1px-var(--bw))] box-content w-10 rounded-bl-xl"
          />
        </Edge>
        <div>
          <Node
            title="Mesh"
            description="GraphQL Gateway"
            highlighted={[1, 4, 5].includes(highlightedEdge)}
          >
            <svg viewBox="0 0 48 48" width={48} height={48}>
              <SafariLinearGradientDefs />
              <use xlinkHref="/ecosystem-management.svg#mesh" />
            </svg>
          </Node>
          <Edge
            left
            className="ml-[calc(var(--node-w)/2-var(--label-h)/2-4px)]"
            highlighted={highlightedEdge === 4}
          >
            <div className="ml-[calc(var(--label-h)/2-.5px)] h-[calc((var(--gap)-var(--label-h))/2)]" />
            <EdgeLabel>4</EdgeLabel>
            <div className="ml-[calc(var(--label-h)/2-.5px)] h-[calc((var(--gap)-var(--label-h))/2)]" />
          </Edge>
          <Node
            className="h-[var(--big-node-h)] w-[var(--node-w)] flex-col text-center"
            title="Hive"
            description="Decision-making engine"
            highlighted={[3, 4, 6].includes(highlightedEdge)}
          >
            <svg width={112} height={112}>
              <use xlinkHref="/ecosystem-management.svg#hive" />
            </svg>
          </Node>
          <Edge
            left
            className="ml-[calc(var(--node-w)/2-var(--label-h)/2-4px)]"
            highlighted={highlightedEdge === 6}
          >
            <div className="ml-[calc(var(--label-h)/2-.5px)] h-6" />
            <EdgeLabel>6</EdgeLabel>
            <div className="ml-[calc(var(--label-h)/2-.5px)] h-6" />
          </Edge>
          <Node
            title="Yoga"
            description="GraphQL Subgraph"
            highlighted={[5, 6].includes(highlightedEdge)}
          >
            <svg width={48} height={48}>
              <use xlinkHref="/ecosystem-management.svg#yoga" />
            </svg>
          </Node>
        </div>
        <div>
          <Edge
            top
            className="flex h-[var(--node-h)] flex-row items-center"
            highlighted={highlightedEdge === 1}
          >
            <div className="w-[calc(var(--label-h)/1.6)]" />
            <EdgeLabel>1</EdgeLabel>
            <div className="w-[calc(var(--label-h)/1.6)]" />
          </Edge>
          <div className="h-[var(--gap)]" />
          <Edge
            top
            highlighted={highlightedEdge === 3}
            className="flex h-[var(--big-node-h)] flex-row items-center"
          >
            <div className="w-[calc(var(--label-h)/1.6)]" />
            <EdgeLabel>3</EdgeLabel>
            <div className="w-[calc(var(--label-h)/1.6)]" />
          </Edge>
        </div>
        <div>
          <Node
            title="GraphQL client"
            className="justify-center"
            highlighted={[1, 2].includes(highlightedEdge)}
          />
          <Edge
            left
            className="flex h-[calc(var(--gap)+var(--big-node-h)/2-var(--node-h)/2)] flex-col items-center"
            highlighted={highlightedEdge === 2}
          >
            <div className="flex-1" />
            <EdgeLabel>2</EdgeLabel>
            <div className="flex-1" />
          </Edge>
          <Node
            title="Codegen"
            description="GraphQL Code Generation"
            highlighted={[2, 3].includes(highlightedEdge)}
          >
            <svg width={48} height={48} viewBox="0 0 48 48">
              <use xlinkHref="/ecosystem-management.svg#codegen" />
            </svg>
          </Node>
        </div>
      </div>
    </div>
  );
}

interface EdgeProps extends React.HTMLAttributes<HTMLElement> {
  highlighted: boolean;
  top?: boolean;
  left?: boolean;
  bottom?: boolean;
}
function Edge({ highlighted, top, bottom, left, className, ...rest }: EdgeProps) {
  return (
    <div
      style={{ '--bw': highlighted ? '2px' : '1px' }}
      className={cn(
        className,
        '[&>*]:transition-colors [&>*]:duration-500 [&>:nth-child(odd)]:border-green-700',
        top &&
          (bottom
            ? '[&>:nth-child(1)]:border-t-[length:var(--bw)] [&>:nth-child(3)]:border-b-[length:var(--bw)]'
            : '[&>:nth-child(odd)]:border-t-[length:var(--bw)]'),
        left && '[&>:nth-child(odd)]:border-l-[length:var(--bw)]',
        highlighted &&
          '[&>*]:text-green-1000 [&>:nth-child(even)]:bg-green-300 [&>:nth-child(odd)]:border-green-300',
      )}
      {...rest}
    />
  );
}

interface EdgeLabelProps extends React.HTMLAttributes<HTMLElement> {}
function EdgeLabel(props: EdgeLabelProps) {
  return (
    <div
      className={
        'flex size-8 h-[var(--label-h)] items-center justify-center' +
        ' rounded bg-green-700 text-sm font-medium leading-[20px]'
      }
      {...props}
    />
  );
}

interface NodeProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  highlighted: boolean;
}
function Node({ title, description, children, highlighted, className, ...rest }: NodeProps) {
  return (
    <div
      className={cn(
        'relative z-10 flex h-[var(--node-h)] items-center gap-4 rounded-2xl p-[22px]' +
          ' bg-[linear-gradient(135deg,rgb(255_255_255/0.10),rgb(255_255_255/0.20))]' +
          ' transition-colors duration-500 [&>svg]:flex-shrink-0',
        // todo: linear gradients don't transition, so we should add white/10 background layer'
        highlighted &&
          'bg-[linear-gradient(135deg,rgb(255_255_255_/0.2),rgb(255_255_255/0.3))] ring ring-green-300',
        className,
      )}
      {...rest}
    >
      {children}
      <div>
        <div className="font-medium text-green-100">{title}</div>
        {description && (
          <div className="mt-0.5 text-sm leading-[20px] text-green-200">{description}</div>
        )}
      </div>
    </div>
  );
}

function SafariLinearGradientDefs() {
  return (
    <defs>
      <linearGradient
        id="linear-blue"
        x1="0"
        y1="0"
        x2="100%"
        y2="100%"
        gradientUnits="objectBoundingBox"
      >
        <stop stop-color="#8CBEB3" />
        <stop offset="1" stop-color="#68A8B6" />
      </linearGradient>
      <linearGradient
        id="linear-white"
        x1="0"
        y1="0"
        x2="100%"
        y2="100%"
        gradientUnits="objectBoundingBox"
      >
        <stop stop-color="white" stop-opacity="0.4" />
        <stop offset="1" stop-color="white" stop-opacity="0.1" />
      </linearGradient>
    </defs>
  );
}
