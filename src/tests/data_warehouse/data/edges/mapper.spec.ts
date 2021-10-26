import Logger from '../../../../services/logger';
import PostgresAdapter from '../../../../data_access_layer/mappers/db_adapters/postgres/postgres';
import MetatypeKeyMapper from '../../../../data_access_layer/mappers/data_warehouse/ontology/metatype_key_mapper';
import MetatypeMapper from '../../../../data_access_layer/mappers/data_warehouse/ontology/metatype_mapper';
import faker from 'faker';
import {expect} from 'chai';
import MetatypeRelationshipMapper from '../../../../data_access_layer/mappers/data_warehouse/ontology/metatype_relationship_mapper';
import MetatypeRelationshipPairMapper from '../../../../data_access_layer/mappers/data_warehouse/ontology/metatype_relationship_pair_mapper';
import EdgeMapper from '../../../../data_access_layer/mappers/data_warehouse/data/edge_mapper';
import DataSourceMapper from '../../../../data_access_layer/mappers/data_warehouse/import/data_source_mapper';
import MetatypeRelationshipKeyMapper from '../../../../data_access_layer/mappers/data_warehouse/ontology/metatype_relationship_key_mapper';
import Container from '../../../../domain_objects/data_warehouse/ontology/container';
import Metatype from '../../../../domain_objects/data_warehouse/ontology/metatype';
import ContainerMapper from '../../../../data_access_layer/mappers/data_warehouse/ontology/container_mapper';
import MetatypeRelationship from '../../../../domain_objects/data_warehouse/ontology/metatype_relationship';
import MetatypeRelationshipPair from '../../../../domain_objects/data_warehouse/ontology/metatype_relationship_pair';
import MetatypeKey from '../../../../domain_objects/data_warehouse/ontology/metatype_key';
import MetatypeRelationshipKey from '../../../../domain_objects/data_warehouse/ontology/metatype_relationship_key';
import NodeMapper from '../../../../data_access_layer/mappers/data_warehouse/data/node_mapper';
import Node from '../../../../domain_objects/data_warehouse/data/node';
import Edge from '../../../../domain_objects/data_warehouse/data/edge';
import DataSourceRecord from '../../../../domain_objects/data_warehouse/import/data_source';

describe('An Edge Mapper', async () => {
    let containerID: string = process.env.TEST_CONTAINER_ID || '';

    before(async function () {
        if (process.env.CORE_DB_CONNECTION_STRING === '') {
            Logger.debug('skipping nodes graph tests, no storage layer');
            this.skip();
        }

        await PostgresAdapter.Instance.init();
        const mapper = ContainerMapper.Instance;

        const container = await mapper.Create(
            'test suite',
            new Container({
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        );

        expect(container.isError).false;
        expect(container.value.id).not.null;
        containerID = container.value.id!;

        return Promise.resolve();
    });

    after(async () => {
        return ContainerMapper.Instance.Delete(containerID);
    });

    it('can save/create an Edge', async () => {
        const storage = EdgeMapper.Instance;
        const nStorage = NodeMapper.Instance;
        const kStorage = MetatypeKeyMapper.Instance;
        const mMapper = MetatypeMapper.Instance;
        const rMapper = MetatypeRelationshipMapper.Instance;
        const rkStorage = MetatypeRelationshipKeyMapper.Instance;
        const rpStorage = MetatypeRelationshipPairMapper.Instance;

        // SETUP
        const metatypes = await mMapper.BulkCreate('test suite', [
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        ]);

        expect(metatypes.isError).false;
        expect(metatypes.value).not.empty;

        const testKeys1 = [...test_keys];
        testKeys1.forEach((key) => (key.metatype_id = metatypes.value[0].id!));
        const keys = await kStorage.BulkCreate('test suite', testKeys1);
        expect(keys.isError).false;

        const testKeys2 = [...test_keys];
        testKeys2.forEach((key) => (key.metatype_id = metatypes.value[1].id!));
        const keys2 = await kStorage.BulkCreate('test suite', testKeys2);
        expect(keys2.isError).false;

        const mixed = [
            new Node({
                container_id: containerID,
                metatype: metatypes.value[0].id!,
                properties: payload,
            }),
            new Node({
                container_id: containerID,
                metatype: metatypes.value[1].id!,
                properties: payload,
            }),
        ];

        const nodes = await nStorage.BulkCreateOrUpdateByCompositeID('test suite', mixed);
        expect(nodes.isError, metatypes.error?.error).false;

        const relationship = await rMapper.Create(
            'test suite',
            new MetatypeRelationship({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        );

        expect(relationship.isError).false;
        expect(relationship.value).not.empty;

        const relationshipTestKeys = [...test_relationship_keys];
        relationshipTestKeys.forEach((key) => (key.metatype_relationship_id = relationship.value.id!));

        const rkeys = await rkStorage.BulkCreate('test suite', relationshipTestKeys);
        expect(rkeys.isError).false;

        const pair = await rpStorage.Create(
            'test suite',
            new MetatypeRelationshipPair({
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
                origin_metatype: metatypes.value[0].id!,
                destination_metatype: metatypes.value[1].id!,
                relationship: relationship.value.id!,
                relationship_type: 'one:one',
                container_id: containerID,
            }),
        );

        // EDGE SETUP
        const edge = await storage.Create(
            'test suite',
            new Edge({
                container_id: containerID,
                metatype_relationship_pair: pair.value.id!,
                properties: payload,
                origin_id: nodes.value[0].id,
                destination_id: nodes.value[1].id,
            }),
        );

        expect(edge.isError).false;

        return Promise.resolve();
    });

    it('can be created with original IDs in place of nodeIDS', async () => {
        const storage = EdgeMapper.Instance;
        const nStorage = NodeMapper.Instance;
        const kStorage = MetatypeKeyMapper.Instance;
        const mMapper = MetatypeMapper.Instance;
        const rMapper = MetatypeRelationshipMapper.Instance;
        const rpStorage = MetatypeRelationshipPairMapper.Instance;

        // we must create a valid data source for this test
        const dataStorage = DataSourceMapper.Instance;

        const exp = await dataStorage.Create(
            'test suite',
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: true,
                adapter_type: 'standard',
                data_format: 'json',
            }),
        );

        expect(exp.isError).false;
        expect(exp.value).not.empty;

        // SETUP
        const metatype = await mMapper.BulkCreate('test suite', [
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        ]);

        expect(metatype.isError).false;
        expect(metatype.value).not.empty;

        const testKeys1 = [...test_keys];
        testKeys1.forEach((key) => (key.metatype_id = metatype.value[0].id!));
        const keys = await kStorage.BulkCreate('test suite', testKeys1);
        expect(keys.isError).false;

        const testKeys2 = [...test_keys];
        testKeys2.forEach((key) => (key.metatype_id = metatype.value[1].id!));
        const keys2 = await kStorage.BulkCreate('test suite', testKeys2);
        expect(keys2.isError).false;

        const mixed = [
            new Node({
                container_id: containerID,
                data_source_id: exp.value.id!,
                metatype: metatype.value[0].id!,
                properties: payload,
                original_data_id: faker.name.firstName(),
            }),
            new Node({
                container_id: containerID,
                data_source_id: exp.value.id!,
                metatype: metatype.value[1].id!,
                properties: payload,
                original_data_id: faker.name.firstName(),
            }),
        ];

        const node = await nStorage.BulkCreateOrUpdateByCompositeID('test suite', mixed);
        expect(node.isError, metatype.error?.error).false;

        const relationship = await rMapper.Create(
            'test suite',
            new MetatypeRelationship({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        );

        expect(relationship.isError).false;
        expect(relationship.value).not.empty;

        const pair = await rpStorage.Create(
            'test suite',
            new MetatypeRelationshipPair({
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
                origin_metatype: metatype.value[0].id!,
                destination_metatype: metatype.value[1].id!,
                relationship: relationship.value.id!,
                relationship_type: 'one:one',
                container_id: containerID,
            }),
        );

        // EDGE SETUP
        const edge = await storage.Create(
            'test suite',
            new Edge({
                container_id: containerID,
                metatype_relationship_pair: pair.value.id!,
                properties: payload,
                origin_original_id: node.value[0].original_data_id,
                origin_data_source_id: exp.value.id!,
                origin_metatype_id: metatype.value[0].id!,
                destination_original_id: node.value[1].original_data_id,
                destination_data_source_id: exp.value.id!,
                destination_metatype_id: metatype.value[1].id!,
                data_source_id: exp.value.id!,
            }),
        );

        expect(edge.isError).false;

        return Promise.resolve();
    });

    it('can be archived and permanently deleted', async () => {
        const storage = EdgeMapper.Instance;
        const nStorage = NodeMapper.Instance;
        const kStorage = MetatypeKeyMapper.Instance;
        const mMapper = MetatypeMapper.Instance;
        const rMapper = MetatypeRelationshipMapper.Instance;
        const rpStorage = MetatypeRelationshipPairMapper.Instance;

        // SETUP
        const metatype = await mMapper.BulkCreate('test suite', [
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        ]);

        expect(metatype.isError).false;
        expect(metatype.value).not.empty;

        const testKeys1 = [...test_keys];
        testKeys1.forEach((key) => (key.metatype_id = metatype.value[0].id!));
        const keys = await kStorage.BulkCreate('test suite', testKeys1);
        expect(keys.isError).false;

        const testKeys2 = [...test_keys];
        testKeys2.forEach((key) => (key.metatype_id = metatype.value[1].id!));
        const keys2 = await kStorage.BulkCreate('test suite', testKeys2);
        expect(keys2.isError).false;

        const mixed = [
            new Node({
                container_id: containerID,
                metatype: metatype.value[0].id!,
                properties: payload,
            }),
            new Node({
                container_id: containerID,
                metatype: metatype.value[1].id!,
                properties: payload,
            }),
        ];

        const node = await nStorage.BulkCreateOrUpdateByCompositeID('test suite', mixed);
        expect(node.isError, metatype.error?.error).false;

        const relationship = await rMapper.Create(
            'test suite',
            new MetatypeRelationship({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        );

        expect(relationship.isError).false;
        expect(relationship.value).not.empty;

        const pair = await rpStorage.Create(
            'test suite',
            new MetatypeRelationshipPair({
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
                origin_metatype: metatype.value[0].id!,
                destination_metatype: metatype.value[1].id!,
                relationship: relationship.value.id!,
                relationship_type: 'one:one',
                container_id: containerID,
            }),
        );

        // EDGE SETUP
        const edge = await storage.Create(
            'test suite',
            new Edge({
                container_id: containerID,
                metatype_relationship_pair: pair.value.id!,
                properties: payload,
                origin_id: node.value[0].id,
                destination_id: node.value[1].id,
            }),
        );

        expect(edge.isError).false;

        const deleted = await storage.Delete(edge.value.id!);
        expect(deleted.isError).false;

        return Promise.resolve();
    });

    it('can be updated', async () => {
        const storage = EdgeMapper.Instance;
        const nStorage = NodeMapper.Instance;
        const kStorage = MetatypeKeyMapper.Instance;
        const mMapper = MetatypeMapper.Instance;
        const rMapper = MetatypeRelationshipMapper.Instance;
        const rpStorage = MetatypeRelationshipPairMapper.Instance;

        // SETUP
        const metatype = await mMapper.BulkCreate('test suite', [
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        ]);

        expect(metatype.isError).false;
        expect(metatype.value).not.empty;

        const testKeys1 = [...test_keys];
        testKeys1.forEach((key) => (key.metatype_id = metatype.value[0].id!));
        const keys = await kStorage.BulkCreate('test suite', testKeys1);
        expect(keys.isError).false;

        const testKeys2 = [...test_keys];
        testKeys2.forEach((key) => (key.metatype_id = metatype.value[1].id!));
        const keys2 = await kStorage.BulkCreate('test suite', testKeys2);
        expect(keys2.isError).false;

        const mixed = [
            new Node({
                container_id: containerID,
                metatype: metatype.value[0].id!,
                properties: payload,
            }),
            new Node({
                container_id: containerID,
                metatype: metatype.value[1].id!,
                properties: payload,
            }),
        ];

        const node = await nStorage.BulkCreateOrUpdateByCompositeID('test suite', mixed);
        expect(node.isError, metatype.error?.error).false;

        const relationship = await rMapper.Create(
            'test suite',
            new MetatypeRelationship({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        );

        expect(relationship.isError).false;
        expect(relationship.value).not.empty;

        const pair = await rpStorage.Create(
            'test suite',
            new MetatypeRelationshipPair({
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
                origin_metatype: metatype.value[0].id!,
                destination_metatype: metatype.value[1].id!,
                relationship: relationship.value.id!,
                relationship_type: 'one:one',
                container_id: containerID,
            }),
        );

        // EDGE SETUP
        const edge = await storage.Create(
            'test suite',
            new Edge({
                container_id: containerID,
                metatype_relationship_pair: pair.value.id!,
                properties: payload,
                origin_id: node.value[0].id,
                destination_id: node.value[1].id,
            }),
        );

        expect(edge.isError).false;
        expect(edge.value.properties).to.have.deep.property('flower_name', 'Daisy');

        edge.value.properties = updatePayload;

        const updatedEdge = await storage.Update('test suite', edge.value);
        expect(updatedEdge.isError, updatedEdge.error?.error).false;
        expect(updatedEdge.value.properties).to.have.deep.property('flower_name', 'Violet');

        return Promise.resolve();
    });

    it('can be linked to its proper node if created before the nodes needed', async () => {
        const storage = EdgeMapper.Instance;
        const nStorage = NodeMapper.Instance;
        const kStorage = MetatypeKeyMapper.Instance;
        const mMapper = MetatypeMapper.Instance;
        const rMapper = MetatypeRelationshipMapper.Instance;
        const rpStorage = MetatypeRelationshipPairMapper.Instance;

        // we must create a valid data source for this test
        const dataStorage = DataSourceMapper.Instance;

        const exp = await dataStorage.Create(
            'test suite',
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: true,
                adapter_type: 'standard',
                data_format: 'json',
            }),
        );

        expect(exp.isError).false;
        expect(exp.value).not.empty;

        // SETUP
        const metatype = await mMapper.BulkCreate('test suite', [
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
            new Metatype({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        ]);

        expect(metatype.isError).false;
        expect(metatype.value).not.empty;

        const testKeys1 = [...test_keys];
        testKeys1.forEach((key) => (key.metatype_id = metatype.value[0].id!));
        const keys = await kStorage.BulkCreate('test suite', testKeys1);
        expect(keys.isError).false;

        const testKeys2 = [...test_keys];
        testKeys2.forEach((key) => (key.metatype_id = metatype.value[1].id!));
        const keys2 = await kStorage.BulkCreate('test suite', testKeys2);
        expect(keys2.isError).false;

        const relationship = await rMapper.Create(
            'test suite',
            new MetatypeRelationship({
                container_id: containerID,
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        );

        expect(relationship.isError).false;
        expect(relationship.value).not.empty;

        const pair = await rpStorage.Create(
            'test suite',
            new MetatypeRelationshipPair({
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
                origin_metatype: metatype.value[0].id!,
                destination_metatype: metatype.value[1].id!,
                relationship: relationship.value.id!,
                relationship_type: 'one:one',
                container_id: containerID,
            }),
        );

        const mixed = [
            new Node({
                container_id: containerID,
                data_source_id: exp.value.id!,
                metatype: metatype.value[0].id!,
                properties: payload,
                original_data_id: faker.name.firstName(),
            }),
            new Node({
                container_id: containerID,
                data_source_id: exp.value.id!,
                metatype: metatype.value[1].id!,
                properties: payload,
                original_data_id: faker.name.firstName(),
            }),
        ];

        // EDGE SETUP
        const edge = await storage.Create(
            'test suite',
            new Edge({
                container_id: containerID,
                metatype_relationship_pair: pair.value.id!,
                properties: payload,
                origin_original_id: mixed[0].original_data_id,
                origin_data_source_id: exp.value.id!,
                origin_metatype_id: metatype.value[0].id!,
                destination_original_id: mixed[1].original_data_id,
                destination_data_source_id: exp.value.id!,
                destination_metatype_id: metatype.value[1].id!,
                data_source_id: exp.value.id!,
            }),
        );
        expect(edge.isError).false;

        // create one that shouldn't be linked
        let unlinkedEdge = await storage.Create(
            'test suite',
            new Edge({
                container_id: containerID,
                metatype_relationship_pair: pair.value.id!,
                properties: payload,
                origin_data_source_id: exp.value.id!,
                origin_metatype_id: metatype.value[0].id!,
                destination_data_source_id: exp.value.id!,
                destination_metatype_id: metatype.value[1].id!,
                data_source_id: exp.value.id!,
            }),
        );
        expect(unlinkedEdge.isError).false;

        // now we create the nodes
        const node = await nStorage.BulkCreateOrUpdateByCompositeID('test suite', mixed);
        expect(node.isError, metatype.error?.error).false;

        // run the linking service
        const linked = await storage.RunEdgeLinker();
        expect(linked.isError, linked.error?.error).false;

        const updatedEdge = await storage.Retrieve(edge.value.id!);
        expect(updatedEdge.isError).false;
        expect(updatedEdge.value.origin_id).not.null;
        expect(updatedEdge.value.destination_id).not.null;

        unlinkedEdge = await storage.Retrieve(unlinkedEdge.value.id!);
        expect(unlinkedEdge.isError).false;
        expect(unlinkedEdge.value.origin_id).null;
        expect(unlinkedEdge.value.destination_id).null;

        return Promise.resolve();
    });
});

const payload: {[key: string]: any} = {
    flower_name: 'Daisy',
    color: 'yellow',
    notRequired: 1,
};

const updatePayload: {[key: string]: any} = {
    flower_name: 'Violet',
    color: 'blue',
    notRequired: 1,
};

export const test_keys: MetatypeKey[] = [
    new MetatypeKey({
        name: 'Test',
        description: 'flower name',
        required: true,
        property_name: 'flower_name',
        data_type: 'string',
    }),
    new MetatypeKey({
        name: 'Test2',
        description: 'color of flower allowed',
        required: true,
        property_name: 'color',
        data_type: 'enumeration',
        options: ['yellow', 'blue'],
    }),
    new MetatypeKey({
        name: 'Test Not Required',
        description: 'not required',
        required: false,
        property_name: 'notRequired',
        data_type: 'number',
    }),
];

export const test_relationship_keys: MetatypeRelationshipKey[] = [
    new MetatypeRelationshipKey({
        name: 'Test',
        description: 'flower name',
        required: true,
        property_name: 'flower_name',
        data_type: 'string',
    }),
    new MetatypeRelationshipKey({
        name: 'Test2',
        description: 'color of flower allowed',
        required: true,
        property_name: 'color',
        data_type: 'enumeration',
        options: ['yellow', 'blue'],
    }),
    new MetatypeRelationshipKey({
        name: 'Test Not Required',
        description: 'not required',
        required: false,
        property_name: 'notRequired',
        data_type: 'number',
    }),
];
