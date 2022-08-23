import { Entity, BaseEntity, PrimaryColumn } from "typeorm"

@Entity()
export class Trigger extends BaseEntity {
	@PrimaryColumn()
	author_hash_id: string

	@PrimaryColumn()
	channel_id: string
}