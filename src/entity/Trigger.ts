import { Entity, BaseEntity, PrimaryColumn, Column } from "typeorm"

@Entity()
export class Trigger extends BaseEntity {
	@PrimaryColumn()
	author_hash_id: string

	@Column()
	channel_id: string
}