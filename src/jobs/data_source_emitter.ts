/*
  Standalone loop for emitting data source run events. These are emitted every
  minute for each data source, a separate processing thread will take care of
  the messages from the queue
 */

import PostgresAdapter from '../data_access_layer/mappers/db_adapters/postgres/postgres';
import {QueueFactory} from '../services/queue/queue';
import DataSourceMapper from '../data_access_layer/mappers/data_warehouse/import/data_source_mapper';
import QueryStream from 'pg-query-stream';
import Logger from '../services/logger';
import Config from '../services/config';
import {parentPort} from 'worker_threads';
import {plainToClass} from 'class-transformer';
import DataSourceRecord from '../domain_objects/data_warehouse/import/data_source';
const devnull = require('dev-null');

const postgresAdapter = PostgresAdapter.Instance;
const dataSourceMapper = DataSourceMapper.Instance;

void postgresAdapter
    .init()
    .then(() => {
        QueueFactory()
            .then((queue) => {
                void postgresAdapter.Pool.connect((err, client, done) => {
                    const stream = client.query(new QueryStream(dataSourceMapper.listAllActiveStatement()));
                    const putPromises: Promise<boolean>[] = [];

                    stream.on('data', (data) => {
                        // we're simply putting the id on the queue here
                        putPromises.push(queue.Put(Config.data_sources_queue, plainToClass(DataSourceRecord, data as object).id));
                    });

                    stream.on('error', (e: Error) => {
                        Logger.error(`unexpected error in data source emitter thread ${e}`);
                        if (parentPort) parentPort.postMessage('done');
                        else {
                            process.exit(1);
                        }
                    });

                    stream.on('end', () => {
                        done();

                        Promise.all(putPromises)
                            .catch((e) => {
                                Logger.error(`unable to put data sources on queue ${e}`);
                            })
                            .finally(() => {
                                void PostgresAdapter.Instance.close();

                                if (parentPort) parentPort.postMessage('done');
                                else {
                                    process.exit(1);
                                }
                            })
                    });

                    stream.pipe(devnull({objectMode: true}));
                });
            })
            .catch((e) => {
                void PostgresAdapter.Instance.close();

                Logger.error(`unable to initiate data source emitter: ${e}`);
                if (parentPort) parentPort.postMessage('done');
                else {
                    process.exit(1);
                }
            });
    })
    .catch((e) => {
        void PostgresAdapter.Instance.close();

        Logger.error(`unexpected error in data source emitter thread ${e}`);
        if (parentPort) parentPort.postMessage('done');
        else {
            process.exit(1);
        }
    });
