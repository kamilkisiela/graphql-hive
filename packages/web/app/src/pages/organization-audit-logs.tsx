import { ReactElement } from 'react';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


function AuditLogPageContent(props: { organizationId: string }) {
  return (
    <OrganizationLayout
      page={Page.AuditLogs}
      organizationId={props.organizationId}
      className="flex flex-col gap-y-10"
    >
      <div>
        <div className="grow">
          <div className="flex flex-row items-center justify-between py-6">
            <div>
              <Title>Audit Logs</Title>
              <Subtitle>Explore the audit logs for your organization</Subtitle>
            </div>
            <div>
              <div className="flex flex-row items-center gap-x-2">
                <div className="relative">
                  <Button>
                    Export Audit Logs
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Explore Audit Logs</CardTitle>
            <CardDescription>
              Audit logs are generated for all actions taken in your organization.
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-white'>Event Action Name</TableHead>
                <TableHead className='text-white'>Event Time</TableHead>
                <TableHead className='text-white'>Description</TableHead>
                <TableHead className='text-white'>Event Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className='mx-10' >
              <TableRow >
                <TableCell>Project Created</TableCell>
                <TableCell>2021-08-25 12:00:00</TableCell>
                <TableCell>Project created by user</TableCell>
                <TableCell>ProjectCreatedAuditLog</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Project Updated</TableCell>
                <TableCell>2021-08-25 12:00:00</TableCell>
                <TableCell>Project updated by user</TableCell>
                <TableCell>ProjectUpdatedAuditLog</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>
    </OrganizationLayout>
  );
}

export function OrganizationAuditLogsPage(props: { organizationId: string }): ReactElement {
  return (
    <>
      <Meta title="Audit Logs" />
      <AuditLogPageContent organizationId={props.organizationId} />
    </>
  );
}
