/* eslint-disable import/no-extraneous-dependencies */

import 'graphiql/graphiql.css';
import 'twin.macro';

import { Page } from '@/components/common';
import { TargetView } from '@/components/target/View';
import { Button, useDisclosure, useColorModeValue } from '@chakra-ui/react';
import { VscPlug, VscSettings } from 'react-icons/vsc';
import { ConnectLabModal } from '@/components/lab/ConnectLabScreen';
import { CustomizeLabModal } from '@/components/lab/CustomizeLabScreen';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import React from 'react';
import type { GraphiQL as GraphiQLType } from 'graphiql';
import { Logo } from '@/components/common/Logo';
import { NoSchemasYet } from '@/components/target/NoSchemasYet';

const GraphiQL: typeof GraphiQLType = process.browser
  ? // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('graphiql').default
  : null;

export const ConnectLabTrigger: React.FC<{ endpoint: string }> = ({
  endpoint,
}) => {
  const { isOpen, onClose, onOpen: open } = useDisclosure();
  const color = useColorModeValue('#fff', '#000');

  return (
    <>
      <Button
        colorScheme="primary"
        type="button"
        size="sm"
        onClick={open}
        leftIcon={<VscPlug color={color} />}
      >
        Connect
      </Button>
      <ConnectLabModal isOpen={isOpen} onClose={onClose} endpoint={endpoint} />
    </>
  );
};

// TODO: unused
export const CustomizeLabTrigger = () => {
  const { isOpen, onClose, onOpen: open } = useDisclosure();

  return (
    <>
      <Button
        colorScheme="primary"
        type="button"
        onClick={open}
        leftIcon={<VscSettings color={'#ffffff'} />}
      >
        Customize
      </Button>
      <CustomizeLabModal isOpen={isOpen} onClose={onClose} />
    </>
  );
};

const SchemaLabContent: React.FC<{ endpoint: string }> = ({ endpoint }) => {
  return (
    <>
      <div tw="h-full">
        <GraphiQL
          fetcher={createGraphiQLFetcher({
            url: endpoint,
          })}
        >
          <GraphiQL.Logo>
            <Logo tw="w-6 h-6" />
          </GraphiQL.Logo>
        </GraphiQL>
      </div>
    </>
  );
};

export default function SchemaLabPage() {
  return (
    <TargetView title="Schema Laboratory">
      {({ organization, project, target }) => {
        const endpoint = `${window.location.origin}/api/lab/${organization.cleanId}/${project.cleanId}/${target.cleanId}`;
        const noSchemas =
          target.latestSchemaVersion?.schemas.nodes?.length === 0;

        return (
          <Page
            noPadding={true}
            title="Schema Laboratory"
            subtitle="Experiment, mock and create live environment for your schema, without running any backend."
            actions={
              GraphiQL && !noSchemas ? (
                <ConnectLabTrigger endpoint={endpoint} />
              ) : null
            }
          >
            {GraphiQL ? (
              noSchemas ? (
                <NoSchemasYet />
              ) : (
                <SchemaLabContent endpoint={endpoint} />
              )
            ) : null}
          </Page>
        );
      }}
    </TargetView>
  );
}
