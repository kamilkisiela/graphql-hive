import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { authenticated } from '@/components/authenticated-container';
import { Avatar, Button, Heading, Input, MetaTitle, Tabs } from '@/components/v2';
import { graphql } from '@/gql';
import { MeDocument } from '@/graphql';
import { withSessionProtection } from '@/lib/supertokens/guard';

const UpdateMeMutation = graphql(`
  mutation updateMe($input: UpdateMeInput!) {
    updateMe(input: $input) {
      ok {
        updatedUser {
          id
          fullName
          displayName
        }
      }
      error {
        message
        inputErrors {
          fullName
          displayName
        }
      }
    }
  }
`);

function SettingsPage(): ReactElement {
  const [meQuery] = useQuery({ query: MeDocument });
  const [mutation, mutate] = useMutation(UpdateMeMutation);

  const me = meQuery.data?.me;

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        fullName: me?.fullName || '',
        displayName: me?.displayName || '',
      },
      validationSchema: Yup.object().shape({
        fullName: Yup.string().required('Full name is required'),
        displayName: Yup.string().required('Display name is required'),
      }),
      onSubmit: values => mutate({ input: values }),
    });

  return (
    <>
      <MetaTitle title="Profile settings" />
      <header className="container flex items-center pb-5">
        <div className="mr-4 rounded-full">
          <Avatar
            src={null}
            alt="Your profile photo"
            shape="circle"
            fallback={me?.displayName[0] ?? '?'}
            className="!h-[94px] !w-[94px] text-4xl"
          />
        </div>
        <div className="overflow-hidden">
          <Heading size="2xl" className="line-clamp-1">
            {me?.displayName}
          </Heading>
          <span className="text-xs font-medium text-gray-500">{me?.email}</span>
        </div>
      </header>
      <Tabs defaultValue="personal-info" className="container">
        <Tabs.List>
          <Tabs.Trigger value="personal-info">Personal Info</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="personal-info" asChild>
          <form onSubmit={handleSubmit} className="mx-auto flex w-1/2 flex-col gap-y-5">
            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold" htmlFor="name">
                Full name
              </label>
              <Input
                placeholder="Full name"
                name="fullName"
                value={values.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                isInvalid={touched.fullName && !!errors.fullName}
              />
              {touched.fullName && errors.fullName && (
                <span className="text-red-500">{errors.fullName}</span>
              )}
              {mutation.data?.updateMe.error?.inputErrors.fullName && (
                <span className="text-red-500">
                  {mutation.data.updateMe.error.inputErrors.fullName}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold" htmlFor="name">
                Display name
              </label>
              <Input
                placeholder="Display name"
                name="displayName"
                value={values.displayName}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                isInvalid={touched.displayName && !!errors.displayName}
              />
              {touched.displayName && errors.displayName && (
                <span className="text-red-500">{errors.displayName}</span>
              )}
              {mutation.data?.updateMe.error?.inputErrors.displayName && (
                <span className="text-red-500">
                  {mutation.data.updateMe.error.inputErrors.displayName}
                </span>
              )}
            </div>

            {mutation.error && <span className="text-red-500">{mutation.error.message}</span>}
            {mutation.data?.updateMe.error?.message && (
              <span className="text-red-500">{mutation.data.updateMe.error.message}</span>
            )}

            <Button type="submit" variant="primary" size="large" block disabled={isSubmitting}>
              Save Changes
            </Button>
          </form>
        </Tabs.Content>
      </Tabs>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(SettingsPage);
