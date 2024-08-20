import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../lib';
import { BookIcon } from './book-icon';
import { CallToAction } from './call-to-action';
import { CheckIcon } from './check-icon';
import { HighlightDecoration } from './decorations';
import { Heading } from './heading';
import styles from './ecosystem-management.module.css';

export function EcosystemManagementSection({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'bg-green-1000 relative overflow-hidden rounded-3xl text-white' +
          ' p-8 pb-[160px] sm:pb-[112px] md:p-[72px] md:pb-[112px] lg:pb-[72px]',
        className,
      )}
    >
      <div className="relative mx-auto flex w-[1392px] max-w-full flex-col gap-x-4 gap-y-6 md:gap-y-12 lg:flex-row [@media(min-width:1400px)]:gap-x-[120px]">
        <div className="flex flex-col gap-12 lg:w-[488px]">
          <Heading as="h3" size="sm">
            360° GraphQL Ecosystem Management
          </Heading>
          <ul className="mx-auto flex list-none flex-col gap-y-4 text-white/80 lg:gap-y-6">
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
          <div className="bottom-0 flex w-full flex-col gap-x-4 gap-y-2 max-lg:absolute max-lg:translate-y-[calc(100%+24px)] sm:flex-row">
            <CallToAction
              href="https://the-guild.dev/graphql/hive/docs/use-cases/apollo-studio"
              variant="primary-inverted"
            >
              Migrate from Apollo
            </CallToAction>
            <CallToAction href="https://github.com/the-guild-org" variant="secondary">
              <BookIcon />
              Explore the full Ecosystem
            </CallToAction>
          </div>
        </div>
        <Illustration className="" />
      </div>
      <HighlightDecoration className="pointer-events-none absolute right-0 top-[-22px] overflow-visible" />
    </section>
  );
}

const edgeTexts = [
  'Apps send requests to the Mesh Gateway which is the entrypoint to the internal GraphQL service/subgraph infrastructure.',
  'Developers that build the apps/api clients will use GraphQL Codegen for generating type-safe code that makes writing apps safer and faster.',
  'Codegen uses Hive to pull the GraphQL schema for generating the code.',
  'Mesh pulls the composite schema / supergraph from the Hive schema registry that gives it all the information about the subgraphs and data available to server to the outside world/clients.',
  'Mesh delegates GraphQL requests to the corresponding Yoga subgraphs within your internal network.',
  'Check the subgraph schema against the Hive registry before deployment to ensure integrity. After deploying a new subgraph version, publish its schema to Hive, which generates the supergraph used by Mesh.',
];
const longestEdgeText = edgeTexts.reduce((a, b) => (a.length > b.length ? a : b));

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const EDGE_HOVER_INTERVAL_TIME = 5000;
const EDGE_HOVER_RESET_TIME = 10_000;

function Illustration(props: { className?: string }) {
  const [highlightedEdge, setHighlightedEdge] = useState<number | null>(4);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useIsomorphicLayoutEffect(() => {
    intervalRef.current = setInterval(() => {
      setHighlightedEdge(prev => (prev % 6) + 1);
    }, EDGE_HOVER_INTERVAL_TIME);

    return () => clearInterval(intervalRef.current);
  }, []);

  const onPointerOverEdge = (event: React.PointerEvent<HTMLElement>) => {
    const edgeNumber = parseInt(event.currentTarget.textContent);
    if (Number.isNaN(edgeNumber) || edgeNumber < 1 || edgeNumber > 6) {
      return;
    }

    clearInterval(intervalRef.current);
    setHighlightedEdge(edgeNumber);

    // after 10 seconds, we'll start stepping through edges again
    intervalRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setHighlightedEdge(prev => (prev % 6) + 1);
      }, EDGE_HOVER_INTERVAL_TIME);
    }, EDGE_HOVER_RESET_TIME);
  };

  return (
    <div
      className={cn(
        'relative flex min-h-[400px] flex-1 flex-col items-center',
        props.className,
        styles.container,
      )}
    >
      <div className={'flex flex-row ' + styles.vars}>
        <Edge top bottom left highlighted={highlightedEdge === 5}>
          <div
            style={{
              height:
                'calc(var(--node-h) / 2 + var(--gap) + var(--big-node-h) / 2 - var(--label-h) / 2)',
            }}
            className="ml-[calc(1rem+1px-var(--bw))] mt-[calc(var(--node-h)/2)] w-10 rounded-tl-xl"
          />
          <EdgeLabel onPointerOver={onPointerOverEdge}>5</EdgeLabel>
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
            <EdgeLabel onPointerOver={onPointerOverEdge}>4</EdgeLabel>
            <div className="ml-[calc(var(--label-h)/2-.5px)] h-[calc((var(--gap)-var(--label-h))/2)]" />
          </Edge>
          <Node
            className="h-[var(--big-node-h)] w-[var(--node-w)] flex-col text-center"
            title="Hive"
            description="Decision-making engine"
            highlighted={[3, 4, 6].includes(highlightedEdge)}
          >
            <svg className="size-[var(--big-logo-size)]">
              <use width="100%" height="100%" xlinkHref="/ecosystem-management.svg#hive" />
            </svg>
          </Node>
          <Edge
            left
            className="ml-[calc(var(--node-w)/2-var(--label-h)/2-4px)]"
            highlighted={highlightedEdge === 6}
          >
            <div className="ml-[calc(var(--label-h)/2-.5px)] h-6" />
            <EdgeLabel onPointerOver={onPointerOverEdge}>6</EdgeLabel>
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
            <EdgeLabel onPointerOver={onPointerOverEdge}>1</EdgeLabel>
            <div className="w-[calc(var(--label-h)/1.6)]" />
          </Edge>
          <div className="h-[var(--gap)]" />
          <Edge
            top
            highlighted={highlightedEdge === 3}
            className="flex h-[var(--big-node-h)] flex-row items-center"
          >
            <div className="w-[calc(var(--label-h)/1.6)]" />
            <EdgeLabel onPointerOver={onPointerOverEdge}>3</EdgeLabel>
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
            <EdgeLabel onPointerOver={onPointerOverEdge}>2</EdgeLabel>
            <div className="flex-1" />
          </Edge>
          <Node
            title="Codegen"
            description={
              <span className="[@media(max-width:1438px)]:hidden">GraphQL Code Generation</span>
            }
            highlighted={[2, 3].includes(highlightedEdge)}
          >
            <svg width={48} height={48} viewBox="0 0 48 48">
              <use xlinkHref="/ecosystem-management.svg#codegen" />
            </svg>
          </Node>
        </div>
      </div>
      <p className={cn('relative text-white/80', styles.text)}>
        {/* We use the longest text to ensure we have enough space. */}
        <span className="invisible">{longestEdgeText}</span>
        <span className="absolute inset-0">{edgeTexts[highlightedEdge - 1]}</span>
      </p>
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

interface EdgeLabelProps extends React.HTMLAttributes<HTMLElement> {
  onPointerOver: React.PointerEventHandler<HTMLElement>;
}
function EdgeLabel(props: EdgeLabelProps) {
  return (
    <div
      className={
        'flex size-8 h-[var(--label-h)] items-center justify-center' +
        ' cursor-default rounded bg-green-700 text-sm font-medium leading-5'
      }
      {...props}
    />
  );
}

interface NodeProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: ReactNode;
  highlighted: boolean;
}
function Node({ title, description, children, highlighted, className, ...rest }: NodeProps) {
  return (
    <div
      className={cn(
        styles.node,
        'relative z-10 flex h-[var(--node-h)] items-center gap-2 rounded-2xl p-4 xl:gap-4 xl:p-[22px]' +
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
          <div
            className="mt-0.5 text-sm leading-5 text-green-200"
            style={{
              display: 'var(--node-desc-display)',
            }}
          >
            {description}
          </div>
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
        <stop stopColor="#8CBEB3" />
        <stop offset="1" stopColor="#68A8B6" />
      </linearGradient>
      <linearGradient
        id="linear-white"
        x1="0"
        y1="0"
        x2="100%"
        y2="100%"
        gradientUnits="objectBoundingBox"
      >
        <stop stopColor="white" stopOpacity="0.4" />
        <stop offset="1" stopColor="white" stopOpacity="0.1" />
      </linearGradient>
    </defs>
  );
}
