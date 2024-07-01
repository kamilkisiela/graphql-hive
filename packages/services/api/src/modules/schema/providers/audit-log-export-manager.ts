import { ClickHouse, Logger } from "@hive/api";
import { S3Config, S3_CONFIG } from "../../shared/providers/s3-config";
import { Inject } from "graphql-modules";

export class AuditLogExportManager {
  private logger: Logger;

  constructor(
    @Inject(S3_CONFIG) private s3: S3Config,
    logger: Logger,
    private clickHouse: ClickHouse,

  ) {
    this.logger = logger.child({ service: 'f' });
  }


  async writeExportCSV() {
    const result = this.clickHouse.query({
      query
    });
  }
    
}