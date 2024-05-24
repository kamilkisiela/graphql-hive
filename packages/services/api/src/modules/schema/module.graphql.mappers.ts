import type { SchemaChangeType, SchemaCheckApprovalMetadata } from '@hive/storage';
import type { SchemaError } from '../../__generated__/types';
import type { SchemaCheckWarning } from './providers/models/shared';

export type SchemaChangeConnectionMapper = ReadonlyArray<SchemaChangeType>;
export type SchemaChangeMapper = SchemaChangeType;
export type SchemaChangeApprovalMapper = SchemaCheckApprovalMetadata;
export type SchemaErrorConnectionMapper = readonly SchemaError[];
export type SchemaWarningConnectionMapper = readonly SchemaCheckWarning[];
