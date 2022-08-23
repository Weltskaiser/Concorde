import { Entity, Column, BaseEntity, PrimaryColumn, OneToMany, ManyToOne } from "typeorm"
import { Poll } from "./Poll"
import { Vote } from "./Vote"

@Entity()
export class Candidate extends BaseEntity {
	@PrimaryColumn()
	message_id: string

	@Column()
	order: number

	@Column()
	name: string

	@ManyToOne(() => Poll, poll => poll.candidates)
	poll: Poll

	@OneToMany(() => Vote, vote => vote.candidate)
	votes: Array<Vote>
}