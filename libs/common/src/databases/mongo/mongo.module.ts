import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CommonLogRepositories,
  CommonLogRepository,
} from './interface/common-log-repository.interface';
import { CommonLogDocumentRepository } from './repositories/common-log-document.repository';
import mongoLogDocumentConfig from '@libs/common/config/mongo-log-document.config';

@Module({
  providers: [
    CommonLogDocumentRepository,
    {
      provide: CommonLogRepositories,
      inject: [CommonLogDocumentRepository],
      useFactory: (
        ...repositories: CommonLogRepository[]
      ): Record<string, CommonLogRepository> =>
        Object.fromEntries(
          repositories.map((it) => [it.connectionName.toUpperCase(), it]),
        ),
    },
  ],
  exports: [CommonLogRepositories],
})
export class MongoLogDocumentModule implements OnModuleDestroy {
  constructor(
    @Inject(CommonLogRepositories)
    private readonly commonLogRepositories: Record<string, CommonLogRepository>,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Object.values(this.commonLogRepositories).map((it) => it.close()),
    );
  }
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      connectionName: mongoLogDocumentConfig().dspName,
      inject: [mongoLogDocumentConfig.KEY],
      useFactory: async (config) => ({
        uri: config.uri,
        user: config.user,
        pass: config.pass,
        dbName: config.dspDatabase,
      }),
    }),

    MongooseModule.forRootAsync({
      connectionName: mongoLogDocumentConfig().ehName,
      inject: [mongoLogDocumentConfig.KEY],
      useFactory: async (config) => ({
        uri: config.uri,
        user: config.user,
        pass: config.pass,
        dbName: config.ehDatabase,
      }),
    }),

    MongoLogDocumentModule,
  ],
  exports: [MongoLogDocumentModule],
})
export class MongoModule {}
