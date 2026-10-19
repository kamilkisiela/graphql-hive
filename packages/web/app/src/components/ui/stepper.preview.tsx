import { createPreview, type NavPath } from 'react-foundry';
import { Button } from '@/components/ui/primitives/button/button';
import { defineStepper } from './stepper';
import * as styles from './stepper.preview.css';

export const nav: NavPath = 'Components/Stepper';

// The create-access-token sheet's definition. The three token sheets share this shape; the OIDC
// domain sheet is the same pattern with three steps.
const Stepper = defineStepper(
  { id: 'step-1-general', title: 'General' },
  { id: 'step-2-permissions', title: 'Permissions' },
  { id: 'step-3-resources', title: 'Resources' },
  { id: 'step-4-confirmation', title: 'Confirm' },
);

type StepId = Parameters<typeof Stepper.get>[0];

function StepBody({ label }: { label: string }) {
  return <div className={styles.stepBodyDiv}>{label}</div>;
}

/**
 * The create-access-token sheet, transcribed: horizontal variant, four non-clickable steps, the
 * sheet footer's controls. The box on the overlay surface stands in for the sheet body, which is
 * why the buttons keep their raised surface. Go back is disabled on the first step and the last
 * step swaps Next for the submit button.
 */
function AccessTokenWizard(props: { defaultStep?: StepId }) {
  return (
    <div className={styles.accessTokenWizardDiv}>
      <Stepper.StepperProvider variant="horizontal" defaultStep={props.defaultStep}>
        {({ stepper }) => (
          <div className={styles.accessTokenWizardDiv2}>
            <Stepper.StepperNavigation>
              {stepper.steps.map(step => (
                <Stepper.StepperStep key={step.id} of={step.id} clickable={false}>
                  <Stepper.StepperTitle>{step.title}</Stepper.StepperTitle>
                </Stepper.StepperStep>
              ))}
            </Stepper.StepperNavigation>
            {stepper.match({
              'step-1-general': () => <StepBody label="Title and description fields" />,
              'step-2-permissions': () => <StepBody label="Permission selector" />,
              'step-3-resources': () => <StepBody label="Resource selector" />,
              'step-4-confirmation': () => <StepBody label="Summary of the token" />,
            })}
            <Stepper.StepperControls>
              <Button
                variant="outline"
                onClick={() => void stepper.prev()}
                disabled={stepper.isFirst}
              >
                Go back
              </Button>
              {stepper.isLast ? (
                <Button onSurface="raised">Create Access Token</Button>
              ) : (
                <Button onSurface="raised" onClick={() => void stepper.next()}>
                  Next
                </Button>
              )}
            </Stepper.StepperControls>
          </div>
        )}
      </Stepper.StepperProvider>
    </div>
  );
}

export const CreateAccessToken = createPreview(() => <AccessTokenWizard />);

/**
 * Opened part-way through, the way the OIDC domain sheet opens a pending domain on its challenge
 * step. Earlier steps show as completed.
 */
export const StartingOnResources = createPreview(() => (
  <AccessTokenWizard defaultStep="step-3-resources" />
));
