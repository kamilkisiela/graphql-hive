import React from 'react';
import tw, { styled } from 'twin.macro';
import { useMutation } from 'urql';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Button,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react';
import { Card, Description, Label } from '@/components/common';
import {
  TargetFieldsFragment,
  TargetValidationSettingsFieldsFragment,
  SetTargetValidationDocument,
  UpdateTargetValidationSettingsDocument,
  TargetEssentialsFragment,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

function ensureNumber(val: number | string): number {
  if (typeof val === 'string') {
    return parseInt(val, 10);
  }
  return val;
}

const Check = {
  Label: styled.label(
    ({ selected, disabled }: { selected: boolean; disabled?: boolean }) => [
      tw`px-2 py-1 rounded-md text-sm`,
      disabled ? tw`cursor-default` : tw`cursor-pointer`,
      selected
        ? tw`
      bg-yellow-50 dark:bg-white dark:bg-opacity-10
      text-yellow-500 dark:text-yellow-300
      border-2 border-yellow-100 dark:border-white dark:border-opacity-10
    `
        : tw`
      bg-white dark:bg-gray-800
      text-gray-400 dark:text-gray-500
      border-2 border-gray-100 dark:border-gray-700
    `,
    ]
  ),
  Input: tw.input`hidden`,
  Content: tw.div`font-medium`,
};

const Checkbox: React.FC<{
  selected: boolean;
  disabled?: boolean;
  value?: string;
  name: string;
  onBlur: (event: any) => void;
  onChange: (event: any) => void;
}> = ({ children, disabled, selected, name, value, onBlur, onChange }) => {
  return (
    <Check.Label selected={selected} disabled={disabled}>
      <Check.Input
        type="checkbox"
        name={name}
        value={value}
        onBlur={onBlur}
        onChange={onChange}
        disabled={disabled}
      />
      <Check.Content>{children}</Check.Content>
    </Check.Label>
  );
};

export const ValidationSettings: React.FC<{
  target: TargetFieldsFragment;
  settings: TargetValidationSettingsFieldsFragment;
  possibleTargets: TargetEssentialsFragment[];
}> = ({ target, possibleTargets, settings }) => {
  const router = useRouteSelector();
  const enabled = settings.enabled;
  const [, setValidation] = useMutation(SetTargetValidationDocument);
  const [, updateValidation] = useMutation(
    UpdateTargetValidationSettingsDocument
  );

  const [updating, setUpdating] = React.useState(false);

  const toggle = React.useCallback(() => {
    setUpdating(true);
    setValidation({
      input: {
        target: target.cleanId,
        project: router.projectId,
        organization: router.organizationId,
        enabled: !enabled,
      },
    }).finally(() => {
      setUpdating(false);
    });
  }, [setUpdating, setValidation, enabled]);

  const formik = useFormik({
    initialValues: {
      percentage: settings.percentage,
      period: settings.period,
      targets: settings.targets.map((t) => t.id),
    },
    validationSchema: Yup.object().shape({
      percentage: Yup.number().min(0).max(100).required('Required'),
      period: Yup.number().min(1).max(30).required('Required'),
      targets: Yup.array().of(Yup.string()).min(1).required('Required'),
    }),
    async onSubmit(values) {
      await updateValidation({
        input: {
          organization: router.organizationId,
          project: router.projectId,
          target: target.cleanId,
          percentage: ensureNumber(values.percentage),
          period: ensureNumber(values.period),
          targets: values.targets,
        },
      });
    },
  });

  const disabled = formik.isSubmitting || !enabled || updating;

  return (
    <Card.Root>
      <Card.Title tw="flex flex-row justify-between items-center">
        Conditional Breaking Changes{' '}
        <Switch
          colorScheme="primary"
          isChecked={enabled}
          isDisabled={updating || formik.isSubmitting}
          onChange={toggle}
        />
      </Card.Title>
      <Card.Content>
        <form
          onSubmit={formik.handleSubmit}
          style={{ opacity: enabled ? 1 : 0.2 }}
        >
          <div tw="flex flex-row items-center">
            A schema change is considered as breaking only if affects more than{' '}
            <NumberInput
              colorScheme="primary"
              name="percentage"
              inputMode="numeric"
              max={100}
              min={0}
              step={1}
              maxW={16}
              size="sm"
              defaultValue={formik.initialValues.percentage}
              isDisabled={disabled}
              isInvalid={!!formik.errors.percentage}
              onChange={(value) => formik.setFieldValue('percentage', value)}
              onBlur={formik.handleBlur}
              value={formik.values.percentage}
              tw="mx-3"
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            % of traffic in past{' '}
            <NumberInput
              isDisabled={disabled}
              isInvalid={!!formik.errors.period}
              max={30}
              min={1}
              step={1}
              maxW={16}
              inputMode="numeric"
              size="sm"
              tw="mx-3"
              name="period"
              defaultValue={formik.initialValues.period}
              value={formik.values.period}
              onChange={(value) => formik.setFieldValue('period', value)}
              onBlur={formik.handleBlur}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            days
          </div>
          <div role="group" tw="mt-3 flex flex-row items-center space-x-4">
            <div>Check collected usage data from these targets:</div>
            {possibleTargets.map((pt) => (
              <Checkbox
                key={pt.id}
                {...formik.getFieldProps('targets')}
                value={pt.id}
                selected={formik.values.targets.includes(pt.id)}
                disabled={disabled}
              >
                {pt.name}
              </Checkbox>
            ))}
          </div>
          <Description tw="mt-6">
            Example settings: Removal of a field is considered breaking if
          </Description>
          <Description tw="mt-3">
            <Label>0%</Label> - the field was used at least once in past 30 days
          </Description>
          <Description tw="mt-2">
            <Label>10%</Label> - the field was requested by more than 10% of all
            GraphQL operations in recent 30 days
          </Description>
          <div tw="flex flex-row mt-6 space-x-4 items-center">
            <Button
              colorScheme="primary"
              disabled={disabled || !formik.isValid}
              onClick={formik.handleSubmit as any}
            >
              Save
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card.Root>
  );
};
