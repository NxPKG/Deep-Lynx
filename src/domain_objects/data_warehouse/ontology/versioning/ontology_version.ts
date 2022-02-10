import {NakedDomainClass} from '../../../../common_classes/base_domain_class';
import {IsDate, IsIn, IsOptional, IsString} from 'class-validator';
import {Type} from 'class-transformer';

/*
    Ontology version represents an ontology version record, which ties
    in to all pieces of the ontology
 */
export default class OntologyVersion extends NakedDomainClass {
    @IsOptional()
    @IsString()
    id?: string;

    @IsString()
    container_id?: string;

    @IsString()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    @IsString()
    @IsIn(['pending', 'approved', 'rejected', 'published', 'deprecated', 'ready', 'error'])
    status? = 'pending';

    @IsOptional()
    @IsString()
    status_message?: string;

    @IsString()
    @IsOptional()
    changelist_id?: string;

    @IsString()
    @IsOptional()
    created_by?: string;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    created_at?: Date;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    published_at?: Date;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    approved_at?: Date;

    @IsString()
    @IsOptional()
    approved_by?: string;

    constructor(input: {
        container_id: string;
        name: string;
        description?: string;
        changelist_id?: string;
        status?: 'pending' | 'approved' | 'rejected' | 'published' | 'deprecated' | 'ready';
        status_message?: string;
        published_at?: Date;
        created_by?: string;
    }) {
        super();

        if (input) {
            this.container_id = input.container_id;
            this.name = input.name;
            if (input.description) this.description = input.description;
            if (input.changelist_id) this.changelist_id = input.changelist_id;
            if (input.created_by) this.created_by = input.created_by;
            if (input.status) this.status = input.status;
            if (input.status_message) this.status_message = input.status_message;
            if (input.published_at) this.published_at = input.published_at;
        }
    }
}
