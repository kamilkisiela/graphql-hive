/**
 * @source https://github.com/shadcn-ui/ui/pull/318
 */
import React from 'react';
import { focusRing } from '@/components/ui/primitives/shared-styles';
import { lenient } from '@/lib/recipe';
import { cn } from '@/lib/utils';
import * as Stepperize from '@stepperize/react/headless';
import * as styles from './stepper.css';

//#region Types
type StepperVariant = 'horizontal' | 'vertical' | 'circle';
type StepperLabelOrientation = 'horizontal' | 'vertical';

type StepperConfig = {
  variant?: StepperVariant;
  labelOrientation?: StepperLabelOrientation;
  tracking?: boolean;
};

type StepState = 'active' | 'completed' | 'inactive';

type DefineStepperProps<Steps extends readonly Stepperize.Step[]> = Omit<
  Stepperize.StepperDefinition<Steps>,
  'Provider'
> & {
  StepperProvider: (
    props: Omit<Stepperize.ProviderProps<Steps>, 'children'> &
      StepperConfig & {
        children:
          | React.ReactNode
          | ((props: { stepper: Stepperize.Stepper<Steps> }) => React.ReactNode);
      },
  ) => React.ReactElement;
  StepperNavigation: (props: React.ComponentProps<'nav'>) => React.ReactElement;
  StepperStep: (
    props: React.ComponentProps<'button'> & {
      of: Stepperize.Get.Id<Steps>;
      icon?: React.ReactNode;
      clickable?: boolean;
    },
  ) => React.ReactElement;
  StepperTitle: (props: React.ComponentProps<'h4'>) => React.ReactElement;
  StepperDescription: (props: React.ComponentProps<'p'>) => React.ReactElement;
  StepperPanel: (props: React.ComponentProps<'div'>) => React.ReactElement;
  StepperControls: (props: React.ComponentProps<'div'>) => React.ReactElement;
};

type CircleStepIndicatorProps = {
  currentStep: number;
  totalSteps: number;
  size?: number;
  strokeWidth?: number;
};

//#endregion Types

//#region Context

const StepperContext = React.createContext<StepperConfig | null>(null);

const useStepperProvider = (): StepperConfig => {
  const context = React.useContext(StepperContext);
  if (!context) {
    throw new Error('useStepper must be used within a StepperProvider.');
  }
  return context;
};

//#endregion Context

//#region Define Stepper

const defineStepper = <const Steps extends readonly Stepperize.Step[]>(
  ...steps: Steps
): DefineStepperProps<Steps> => {
  // The library rejects duplicate ids at the type level, which it cannot prove for a generic
  // tuple; the cast hands it the tuple as given.
  const { Provider, useStepperContext, ...rest } = Stepperize.defineStepper(
    steps as Parameters<typeof Stepperize.defineStepper<Steps>>[0],
  );

  const StepperContainer = ({
    children,
  }: {
    children:
      | React.ReactNode
      | ((props: { stepper: Stepperize.Stepper<Steps> }) => React.ReactNode);
  }) => {
    const stepper = useStepperContext();
    return <>{typeof children === 'function' ? children({ stepper }) : children}</>;
  };

  return {
    ...rest,
    useStepperContext,
    StepperProvider: ({
      variant = 'horizontal',
      labelOrientation = 'horizontal',
      tracking = false,
      children,
      ...props
    }) => {
      return (
        <StepperContext.Provider value={{ variant, labelOrientation, tracking }}>
          <Provider {...props}>
            <StepperContainer>{children}</StepperContainer>
          </Provider>
        </StepperContext.Provider>
      );
    },
    StepperNavigation: ({
      children,
      className,
      'aria-label': ariaLabel = 'Stepper Navigation',
      ...props
    }) => {
      const { variant } = useStepperProvider();
      return (
        <nav
          aria-label={ariaLabel}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
          role="tablist"
          className={className}
          {...props}
        >
          <ol className={listVariants({ variant })}>{children}</ol>
        </nav>
      );
    },
    StepperStep: ({ children, className, icon, clickable, ...props }) => {
      const { variant, labelOrientation } = useStepperProvider();
      const stepper = useStepperContext();

      const steps = rest.steps;
      const stepIndex = steps.findIndex(step => step.id === props.of);

      const isLast = stepIndex === steps.length - 1;
      const isActive = stepper.is(props.of);

      const dataState = STATE_FOR_STATUS[stepper.status(props.of)];
      const childMap = useStepChildren(children);

      const title = childMap.get('title');
      const description = childMap.get('description');
      const panel = childMap.get('panel');

      if (variant === 'circle') {
        return (
          <li className={cn(styles.defineStepperLi, className)}>
            <CircleStepIndicator currentStep={stepIndex + 1} totalSteps={steps.length} />
            <div className={styles.defineStepperDiv}>
              {title}
              {description}
            </div>
          </li>
        );
      }

      return (
        <>
          <li
            className={cn([
              styles.defineStepperLi2,
              'group peer',
              styles.defineStepperLi3,
              styles.defineStepperLi4,
              styles.defineStepperLi5,
              styles.defineStepperLi6,
            ])}
            data-variant={variant}
            data-label-orientation={labelOrientation}
            data-state={dataState}
            data-disabled={props.disabled}
          >
            <button
              id={`step-${props.of}`}
              type="button"
              role="tab"
              tabIndex={dataState !== 'inactive' ? 0 : -1}
              className={cn(
                styles.defineStepperButton,
                focusRing,
                dataState !== 'inactive'
                  ? styles.defineStepperButton2
                  : styles.defineStepperButton3,
                clickable === false && styles.defineStepperButton4,
              )}
              aria-controls={`step-panel-${props.of}`}
              aria-current={isActive ? 'step' : undefined}
              aria-posinset={stepIndex + 1}
              aria-setsize={steps.length}
              aria-selected={isActive}
              onKeyDown={e => onStepKeyDown(e, steps[stepIndex + 1], steps[stepIndex - 1])}
              {...props}
            >
              {icon ?? stepIndex + 1}
            </button>
            {variant === 'horizontal' && labelOrientation === 'vertical' && (
              <StepperSeparator
                orientation="horizontal"
                labelOrientation={labelOrientation}
                isLast={isLast}
                state={dataState}
                disabled={props.disabled}
              />
            )}
            <div className={styles.defineStepperDiv2}>
              {title}
              {description}
            </div>
          </li>

          {variant === 'horizontal' && labelOrientation === 'horizontal' && (
            <StepperSeparator
              orientation="horizontal"
              isLast={isLast}
              state={dataState}
              disabled={props.disabled}
            />
          )}

          {variant === 'vertical' && (
            <div>
              {!isLast && (
                <div className={styles.defineStepperDiv3}>
                  <StepperSeparator
                    orientation="vertical"
                    isLast={isLast}
                    state={dataState}
                    disabled={props.disabled}
                  />
                </div>
              )}
              <div className={styles.defineStepperDiv4}>{panel}</div>
            </div>
          )}
        </>
      );
    },
    StepperTitle,
    StepperDescription,
    StepperPanel: ({ children, className, ...props }) => {
      const { tracking } = useStepperProvider();

      return (
        <div className={className} ref={node => scrollIntoStepperPanel(node, tracking)} {...props}>
          {children}
        </div>
      );
    },
    StepperControls: ({ children, className, ...props }) => {
      return (
        <div className={cn(styles.defineStepperDiv5, className)} {...props}>
          {children}
        </div>
      );
    },
  };
};

//#endregion Define Stepper

//#region Stepper Title

const StepperTitle = ({ children, className, ...props }: React.ComponentProps<'h4'>) => {
  return (
    <h4 className={cn(styles.stepperTitleH4, className)} {...props}>
      {children}
    </h4>
  );
};

//#endregion Stepper Title

//#region Stepper Description

const StepperDescription = ({ children, className, ...props }: React.ComponentProps<'p'>) => {
  return (
    <p className={cn(styles.stepperDescriptionP, className)} {...props}>
      {children}
    </p>
  );
};

//#endregion Stepper Description

//#region Stepper Separator

const StepperSeparator = ({
  orientation,
  isLast,
  labelOrientation,
  state,
  disabled,
}: {
  isLast: boolean;
  state: string;
  disabled?: boolean;
} & NonNullable<Parameters<typeof classForSeparator>[0]>) => {
  if (isLast) {
    return null;
  }
  return (
    <div
      data-orientation={orientation}
      data-state={state}
      data-disabled={disabled}
      role="separator"
      tabIndex={-1}
      className={classForSeparator({ orientation, labelOrientation })}
    />
  );
};

//#endregion Stepper Separator

//#region Circle Indicator

const CircleStepIndicator = ({
  currentStep,
  totalSteps,
  size = 80,
  strokeWidth = 6,
}: CircleStepIndicatorProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const fillPercentage = (currentStep / totalSteps) * 100;
  const dashOffset = circumference - (circumference * fillPercentage) / 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      tabIndex={-1}
      className={styles.circleStepIndicatorDiv}
    >
      <svg width={size} height={size}>
        <title>Step Indicator</title>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={styles.circleStepIndicatorCircle}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={styles.circleStepIndicatorCircle2}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.circleStepIndicatorDiv2}>
        <span className={styles.circleStepIndicatorSpan} aria-live="polite">
          {currentStep} of {totalSteps}
        </span>
      </div>
    </div>
  );
};

//#endregion Circle Indicator

//#region Styles

const listVariants = lenient(styles.listVariants);

const classForSeparator = lenient(styles.classForSeparator);

//#endregion Styles

//#region Utils

const STATE_FOR_STATUS: Record<Stepperize.StepStatus, StepState> = {
  active: 'active',
  previous: 'completed',
  upcoming: 'inactive',
};

function scrollIntoStepperPanel(node: HTMLDivElement | null, tracking?: boolean) {
  if (tracking) {
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

const useStepChildren = (children: React.ReactNode) => {
  return React.useMemo(() => extractChildren(children), [children]);
};

const extractChildren = (children: React.ReactNode) => {
  const childrenArray = React.Children.toArray(children);
  const map = new Map<string, React.ReactNode>();

  for (const child of childrenArray) {
    if (React.isValidElement(child)) {
      if (child.type === StepperTitle) {
        map.set('title', child);
      } else if (child.type === StepperDescription) {
        map.set('description', child);
      } else {
        map.set('panel', child);
      }
    }
  }

  return map;
};

const onStepKeyDown = (
  e: React.KeyboardEvent<HTMLButtonElement>,
  nextStep: Stepperize.Step | undefined,
  prevStep: Stepperize.Step | undefined,
) => {
  const { key } = e;
  const directions = {
    next: ['ArrowRight', 'ArrowDown'],
    prev: ['ArrowLeft', 'ArrowUp'],
  };

  if (directions.next.includes(key) || directions.prev.includes(key)) {
    const direction = directions.next.includes(key) ? 'next' : 'prev';
    const step = direction === 'next' ? nextStep : prevStep;

    if (!step) {
      return;
    }

    const stepElement = document.getElementById(`step-${step.id}`);
    if (!stepElement) {
      return;
    }

    const isActive = stepElement.parentElement?.getAttribute('data-state') !== 'inactive';
    if (isActive || direction === 'prev') {
      stepElement.focus();
    }
  }
};

//#endregion Utils

export { defineStepper };
