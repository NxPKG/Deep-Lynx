import Changelist from '../../../../../domain_objects/data_warehouse/ontology/versioning/changelist';
import Mapper from '../../../mapper';
import {PoolClient, QueryConfig} from 'pg';
import Result from '../../../../../common_classes/result';
import OntologyVersion from '../../../../../domain_objects/data_warehouse/ontology/versioning/ontology_version';

const format = require('pg-format');
const resultClass = OntologyVersion;

export default class OntologyVersionMapper extends Mapper {
    public static tableName = 'ontology_versions';

    private static instance: OntologyVersionMapper;

    public static get Instance(): OntologyVersionMapper {
        if (!OntologyVersionMapper.instance) {
            OntologyVersionMapper.instance = new OntologyVersionMapper();
        }

        return OntologyVersionMapper.instance;
    }

    public async Create(userID: string, input: OntologyVersion, transaction?: PoolClient): Promise<Result<OntologyVersion>> {
        const r = await super.run(this.createStatement(userID, input), {
            transaction,
            resultClass,
        });
        if (r.isError) return Promise.resolve(Result.Pass(r));

        return Promise.resolve(Result.Success(r.value[0]));
    }

    public async Retrieve(id: string): Promise<Result<OntologyVersion>> {
        return super.retrieve(this.retrieveStatement(id), {resultClass});
    }

    public async Update(userID: string, m: OntologyVersion, transaction?: PoolClient): Promise<Result<OntologyVersion>> {
        const r = await super.run(this.fullUpdateStatement(userID, m), {
            transaction,
            resultClass,
        });
        if (r.isError) return Promise.resolve(Result.Pass(r));

        return Promise.resolve(Result.Success(r.value[0]));
    }

    public async Delete(id: string): Promise<Result<boolean>> {
        return super.runStatement(this.deleteStatement(id));
    }

    // Below are a set of query building functions. So far they're very simple
    // and the return value is something that the postgres-node driver can understand
    // My hope is that this method will allow us to be flexible and create more complicated
    // queries more easily.
    private createStatement(userID: string, ...versions: OntologyVersion[]): string {
        const text = `INSERT INTO ontology_versions(
                        name,
                        container_id,
                        changelist_id,
                        created_by) VALUES %L RETURNING *`;
        const values = versions.map((version) => [version.name, version.container_id, version.changelist_id, userID]);

        return format(text, values);
    }

    private fullUpdateStatement(userID: string, ...versions: OntologyVersion[]): string {
        const text = `UPDATE ontology_versions AS v SET
                        name = u.name,
                        container_id = u.container_id::bigint,
                        changelist_id = u.changelist_id::bigint,
                       FROM(VALUES %L) AS u(id, name, container_id, changelist_id)
                       WHERE u.id::bigint = v.id RETURNING v.*`;
        const values = versions.map((version) => [version.id, version.name, version.container_id, version.changelist_id]);

        return format(text, values);
    }

    private retrieveStatement(id: string): QueryConfig {
        return {
            text: `SELECT * FROM ontology_versions WHERE id = $1`,
            values: [id],
        };
    }

    private deleteStatement(id: string): QueryConfig {
        return {
            text: `DELETE FROM ontology_versions WHERE id = $1`,
            values: [id],
        };
    }
}
