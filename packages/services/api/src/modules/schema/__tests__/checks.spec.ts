import { createCheck, runCheck } from '../providers/checks';

// <step status> (<requirement>) -> <step status> (<requirement>) = <failed step index 1,2...n> (<result status>)

runTest('skipped   (optional)   -> skipped    (optional)                          =   (completed)');
runTest('completed (optional)   -> skipped    (optional)                          =   (completed)');
runTest('skipped   (optional)   -> skipped    (required)                          = 2 (failed)');
runTest('skipped   (required)   -> skipped    (required)                          = 1 (failed)');
runTest('completed (required)   -> skipped    (required)                          = 2 (failed)');
runTest('completed (optional)   -> skipped    (required)                          = 2 (failed)');
runTest('completed (optional)   -> completed  (required)  -> failed (required)    = 3 (failed)');
runTest('completed (optional)   -> completed  (required)  -> failed (optional)    = 3 (failed)');

//

function parseResult(scenario: string) {
  const parts = scenario.trim().split('(');

  if (parts.length === 2) {
    return {
      index: parseInt(parts[0], 10) - 1,
      status: parts[1].replace(')', ''),
    };
  }

  return {
    index: null,
    status: parts[0].replace(')', ''),
  };
}

function parseSteps(scenario: string) {
  return scenario.split(' -> ').map((check, i) => {
    const [status, requirement] = Array.from(check.match(/(\w+)\s+\((\w+)\)/)!).slice(1);
    const stepId: string = `step-${i}` as const;

    if (requirement !== 'required' && requirement !== 'optional') {
      throw new Error(`Invalid requirement: ${requirement}`);
    }

    return {
      stepId,
      status: status as 'skipped' | 'completed' | 'failed',
      requirement: requirement as 'required' | 'optional',
    };
  });
}

function runTest(scenario: string) {
  const [stepsScenario, resultScenario] = scenario.split(' = ');

  const steps = parseSteps(stepsScenario).map(step => {
    return {
      ...step,
      check: createCheck(step.stepId, async () => {
        if (step.status === 'skipped') {
          return {
            status: 'skipped',
          };
        }
        if (step.status === 'completed') {
          return {
            status: 'completed',
            result: null,
          };
        }
        if (step.status === 'failed') {
          return {
            status: 'failed',
            reason: null,
          };
        }
        throw new Error(`Invalid status: ${step.status}`);
      }),
    };
  });

  const { index, status } = parseResult(resultScenario);

  test(scenario, async () => {
    const result = await runCheck(
      steps.map(s => s.check),
      steps.reduce((acc, s) => ({ ...acc, [s.check.id]: s.requirement }), {}),
    );

    const expectedState: any = {};

    for (const step of steps) {
      expectedState[step.stepId] = {
        id: step.stepId,
        status: 'skipped',
      };
    }

    for await (const [i, step] of steps.entries()) {
      if (index != null && i > index) {
        break;
      }

      const r = await step.check.runner();
      expectedState[step.stepId] = {
        ...r,
        id: step.stepId,
      };
    }

    if (index !== null) {
      expectedState;
    }

    expect(result).toEqual({
      status,
      state: expectedState,
      ...(index == null
        ? {}
        : {
            step: expectedState[`step-${index}`],
          }),
    });
  });
}
