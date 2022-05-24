import * as React from 'react';
import tw, { styled } from 'twin.macro';
import { useMutation } from 'urql';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import { CreateProjectDocument, ProjectType } from '@/graphql';
import { Description, Label } from '@/components/common';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { useTracker } from '@/lib/hooks/use-tracker';

const Option = {
  Root: styled.div<{ selected?: boolean }>`
    ${tw`
      rounded-md shadow p-3 cursor-pointer 
      border-2 border-opacity-0 border-transparent 
      dark:border-gray-600
    `}
    ${props =>
      props.selected
        ? tw`
          border-yellow-400 dark:border-yellow-400
          bg-yellow-50 dark:bg-yellow-200
          border-opacity-100
        `
        : tw`
          hover:border-gray-400 
          hover:bg-white
          dark:hover:bg-gray-600 
          border-opacity-100
        `}
  `,
  Title: styled.h3<{ selected?: boolean }>`
    ${tw`uppercase text-xs text-gray-400 font-semibold tracking-wide`}
    ${props => (props.selected ? tw`text-yellow-400 dark:text-yellow-700` : tw``)}
  `,
  Content: styled.h3<{ selected?: boolean }>`
    ${tw`text-xl text-gray-700 dark:text-white font-semibold tracking-wide`}
    ${props => (props.selected ? tw`dark:text-black` : tw``)}
  `,
  Description: styled.h3<{ selected?: boolean }>`
    ${tw`text-xs text-gray-500 dark:text-gray-300 tracking-wide`}
    ${props => (props.selected ? tw`dark:text-gray-700` : tw``)}
  `,
};

const ProjectTypeOption: React.FC<{
  type: string;
  label: string;
  onClick(): void;
  description?: string;
  selected?: boolean;
}> = ({ type, label, description, selected, onClick }) => {
  return (
    <Option.Root onClick={onClick} selected={selected}>
      <Option.Title selected={selected}>{type}</Option.Title>
      <Option.Content selected={selected}>{label}</Option.Content>
      {description && <Option.Description selected={selected}>{description}</Option.Description>}
    </Option.Root>
  );
};

export const ProjectCreator: React.FC<{
  isOpen: boolean;
  onClose(): void;
}> = ({ isOpen, onClose }) => {
  useTracker('PROJECT_CREATOR', isOpen);
  const router = useRouteSelector();
  const [{ fetching }, mutate] = useMutation(CreateProjectDocument);
  const [name, setName] = React.useState('');
  const [validationUrl, setValidationUrl] = React.useState('');
  const [buildUrl, setBuildUrl] = React.useState('');
  const [projectType, setProjectType] = React.useState<ProjectType>(ProjectType.Single);
  const submit = React.useCallback(
    evt => {
      evt.preventDefault();
      if (name && projectType) {
        mutate({
          input: {
            name,
            type: projectType,
            organization: router.organizationId,
            validationUrl,
            buildUrl,
          },
        }).then(result => {
          onClose();
          router.visitProject({
            organizationId: router.organizationId,
            projectId: result.data.createProject.ok.createdProject.cleanId,
          });
        });
      }
    },
    [mutate, router, name, projectType, validationUrl, buildUrl]
  );

  const onNameChange = React.useCallback(
    evt => {
      setName(evt.target.value);
    },
    [setName]
  );
  const onValidationUrlChange = React.useCallback(
    evt => {
      setValidationUrl(evt.target.value);
    },
    [setValidationUrl]
  );
  const onBuildUrlChange = React.useCallback(
    evt => {
      setBuildUrl(evt.target.value);
    },
    [setBuildUrl]
  );

  const isCustom = projectType === ProjectType.Custom;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submit}>
        <ModalHeader>Create a project</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Description>
            A project is built on top of <Label>Targets</Label>, which are just your environments.
          </Description>
          <Description>
            We will also create a default stack named <Label>experiment</Label> for you (don't worry, you can change it
            later).
          </Description>
          <div tw="pt-6 space-y-6">
            <div tw="relative flex-grow w-full flex-col">
              <FormControl>
                <FormLabel>Project Name</FormLabel>
                <Input
                  name="project-name"
                  value={name}
                  disabled={fetching}
                  onChange={onNameChange}
                  placeholder="Name your project"
                  type="text"
                />
              </FormControl>
            </div>
            <div tw="relative flex-grow w-full flex-col">
              <FormLabel>Project Type</FormLabel>
              <div tw="grid grid-cols-4 gap-4 place-items-stretch">
                <ProjectTypeOption
                  selected={projectType === ProjectType.Single}
                  onClick={() => setProjectType(ProjectType.Single)}
                  type="regular"
                  label="Single"
                  description="Single API approach"
                />
                <ProjectTypeOption
                  selected={projectType === ProjectType.Federation}
                  onClick={() => setProjectType(ProjectType.Federation)}
                  type="distributed"
                  label="Federation"
                  description="Apollo Federation specification"
                />
                <ProjectTypeOption
                  selected={projectType === ProjectType.Stitching}
                  onClick={() => setProjectType(ProjectType.Stitching)}
                  type="distributed"
                  label="Stitching"
                  description="Built using Schema Stitching"
                />
                <ProjectTypeOption
                  selected={projectType === ProjectType.Custom}
                  onClick={() => setProjectType(ProjectType.Custom)}
                  type="custom"
                  label="Custom"
                  description="Own validation and schema building"
                />
              </div>
            </div>
            {isCustom && (
              <>
                <FormControl>
                  <FormLabel>Validation endpoint</FormLabel>
                  <Input
                    type="text"
                    name="endpoint-validation"
                    value={validationUrl}
                    disabled={fetching}
                    onChange={onValidationUrlChange}
                    placeholder="Where validation should happen"
                  />
                  <Description tw="pt-2 px-2 text-xs">
                    In Custom mode, Hive will ask you to validate GraphQL Schemas.
                  </Description>
                  <Description tw="px-2 text-xs">
                    A POST request containing schemas will be made to the endpoint above.
                  </Description>
                </FormControl>
                <FormControl>
                  <FormLabel>Schema building endpoint</FormLabel>
                  <Input
                    type="text"
                    name="endpoint-build"
                    value={buildUrl}
                    disabled={fetching}
                    onChange={onBuildUrlChange}
                    placeholder="Where building should happen"
                  />
                  <Description tw="pt-2 px-2 text-xs">
                    In Custom mode, Hive will ask you to validate GraphQL Schemas.
                  </Description>
                  <Description tw="px-2 text-xs">
                    A POST request containing schemas will be made to the endpoint above.
                  </Description>
                </FormControl>
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter tw="space-x-6">
          <Button variant="ghost" type="button" disabled={fetching} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="primary" type="submit" disabled={fetching}>
            Create Project
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const ProjectCreatorTrigger = () => {
  const { isOpen, onClose, onOpen: open } = useDisclosure();

  return (
    <>
      <Button colorScheme="primary" type="button" size="sm" onClick={open}>
        New Project
      </Button>
      <ProjectCreator isOpen={isOpen} onClose={onClose} />
    </>
  );
};
