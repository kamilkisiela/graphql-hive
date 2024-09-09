import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CallToAction,
  DecorationIsolation,
  Heading,
  HighlightDecoration,
} from '@theguild/components';
import { cn } from '../../lib';
import { BookIcon } from '../book-icon';
import { CheckIcon } from '../check-icon';
import styles from './ecosystem-management.module.css';

const svgHref = new URL('./ecosystem-management.svg', import.meta.url).toString();

export function EcosystemManagementSection({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'bg-green-1000 relative isolate overflow-hidden rounded-3xl text-white' +
          ' p-8 pb-[160px] sm:pb-[112px] md:p-[72px] md:pb-[112px] lg:pb-[72px]',
        className,
      )}
    >
      <div className="relative mx-auto flex w-[1392px] max-w-full flex-col gap-x-4 gap-y-6 md:gap-y-12 lg:flex-row [@media(min-width:1400px)]:gap-x-[120px]">
        <div className="flex flex-col gap-12 lg:w-[488px]">
          <Heading as="h3" size="sm">
            360° GraphQL Lifecycle
          </Heading>
          <ul className="mx-auto flex list-none flex-col gap-y-4 text-white/80 lg:gap-y-6">
            {[
              'A complete ecosystem covering all your dev and production needs.',
              'Full Apollo Federation Support. Drop-in replacement for Apollo GraphOS (Apollo Studio)',
              <>
                Use tools of your choice — either dive into our full GraphQL ecosystem,
                or&nbsp;build your own stack, connecting GraphQL federation, Hive Gateway, GraphQL
                Mesh and more.
              </>,
              'Learn how to migrate from Apollo and keep your GraphQL stack vendor-unlocked.',
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
              Explore the ecosystem
            </CallToAction>
          </div>
        </div>
        <Illustration />
      </div>
      <DecorationIsolation>
        <HighlightDecoration className="pointer-events-none absolute right-0 top-[-22px] overflow-visible" />
      </DecorationIsolation>
    </section>
  );
}

const edgeTexts = [
  'Apps send requests to Hive Gateway that acts as the entrypoint to data from your GraphQL service/subgraphs.',
  'Developers that build the apps/api clients will use GraphQL Codegen for generating type-safe code that makes writing apps safer and faster.',
  'Codegen uses Hive to pull the GraphQL schema for generating the code.',
  'Hive Gateway pulls the composite schema / supergraph from the Hive schema registry that gives it all the information about the subgraphs and available data to serve to the outside world.',
  'Hive Gateway delegates GraphQL requests to the corresponding Yoga subgraphs within your internal network.',
  'Check the subgraph schema against the Hive registry before deployment to ensure integrity. After deploying a new subgraph version, publish its schema to Hive, to generate the supergraph used by Gateway.',
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
      setHighlightedEdge(prev => (prev! % 6) + 1);
    }, EDGE_HOVER_INTERVAL_TIME);

    return () => clearInterval(intervalRef.current || undefined);
  }, []);

  const highlightEdge = (edgeNumber: number) => {
    clearInterval(intervalRef.current || undefined);

    setHighlightedEdge(edgeNumber);

    // after 10 seconds, we'll start stepping through edges again
    intervalRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setHighlightedEdge(prev => (prev! % 6) + 1);
      }, EDGE_HOVER_INTERVAL_TIME);
    }, EDGE_HOVER_RESET_TIME);
  };

  const onPointerOverEdge = (event: React.PointerEvent<HTMLElement>) => {
    const edgeNumber = parseInt(event.currentTarget.textContent!);
    if (Number.isNaN(edgeNumber) || edgeNumber < 1 || edgeNumber > 6) {
      return;
    }

    highlightEdge(edgeNumber);
  };

  const highlightIterators = useRef<{ node: number[]; index: number }>({ node: [], index: -1 });
  const onHighlightNode = (edges: number[]) => {
    clearInterval(intervalRef.current || undefined);

    let previousIndex: number;
    if (highlightIterators.current.node.every((x, i) => edges[i] === x)) {
      previousIndex = highlightIterators.current.index;
    } else {
      highlightIterators.current.node = edges;
      previousIndex = -1;
    }

    let index = (previousIndex + 1) % edges.length;

    // if edge under index is already highlighted, we move forward
    if (highlightedEdge === edges[index]) {
      index = (index + 1) % edges.length;
    }

    highlightIterators.current.index = index;
    highlightEdge(edges[index]);
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
            title={
              <>
                <span className={styles.smHidden}>Hive</span> Gateway
              </>
            }
            description="Gateway"
            edges={[1, 4, 5]}
            highlightedEdge={highlightedEdge}
            onHighlight={onHighlightNode}
          >
            <svg width={48} height={48}>
              <SafariLinearGradientDefs />
              <use width="100%" height="100%" xlinkHref={`${svgHref}#hive`} />
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
            description="Registry and CDN"
            edges={[3, 4, 6]}
            highlightedEdge={highlightedEdge}
            onHighlight={onHighlightNode}
          >
            <svg className="size-[var(--big-logo-size)]">
              <use width="100%" height="100%" xlinkHref={`${svgHref}#hive`} />
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
            edges={[5, 6]}
            highlightedEdge={highlightedEdge}
            onHighlight={onHighlightNode}
          >
            <svg width={48} height={48}>
              <use xlinkHref={`${svgHref}#yoga`} />
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
            title="Client"
            description={
              <span className="[@media(max-width:1438px)]:hidden">GraphQL client of choice</span>
            }
            edges={[1, 2]}
            highlightedEdge={highlightedEdge}
            onHighlight={onHighlightNode}
          >
            <svg width={48} height={48} viewBox="0 0 100 100">
              <use xlinkHref={`${svgHref}#gql-logo`} />
            </svg>
          </Node>
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
            edges={[2, 3]}
            highlightedEdge={highlightedEdge}
            onHighlight={onHighlightNode}
          >
            <svg width={48} height={48} viewBox="0 0 48 48">
              <use xlinkHref={`${svgHref}#codegen`} />
            </svg>
          </Node>
        </div>
      </div>
      <p className={cn('relative text-white/80', styles.text)}>
        {/* We use the longest text to ensure we have enough space. */}
        <span className="invisible">{longestEdgeText}</span>
        <span className="absolute inset-0">
          {highlightedEdge !== null ? edgeTexts[highlightedEdge - 1] : null}
        </span>
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
        ' cursor-default rounded bg-green-700 text-sm font-medium leading-5' +
        ' hover:ring-2 hover:ring-green-700'
      }
      {...props}
    />
  );
}

interface NodeProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  edges: number[];
  highlightedEdge: number | null;
  onHighlight: (edges: number[]) => void;
}
function Node({
  title,
  description,
  children,
  edges,
  highlightedEdge,
  className,
  onHighlight,
  ...rest
}: NodeProps) {
  const highlighted = edges.includes(highlightedEdge!);

  const hovered = useRef(false);

  return (
    <div
      onPointerOver={event => {
        if (hovered.current || event.currentTarget !== event.target) {
          return;
        }

        hovered.current = true;

        if (edges.includes(highlightedEdge!)) return;
        onHighlight([edges[0]]);
      }}
      onPointerOut={event => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node) &&
          event.currentTarget === event.target
        ) {
          hovered.current = false;
        }
      }}
      onClick={() => onHighlight(edges)}
      className={cn(
        styles.node,
        'relative z-10 flex h-[var(--node-h)] items-center gap-2 rounded-2xl p-4 xl:gap-4 xl:p-[22px]' +
          ' bg-[linear-gradient(135deg,rgb(255_255_255/0.10),rgb(255_255_255/0.20))]' +
          ' cursor-pointer transition-colors duration-500 [&>svg]:flex-shrink-0',
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

/**
 * This must be included in one of the SVGs here so they work nicely in Safari.
 */
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
