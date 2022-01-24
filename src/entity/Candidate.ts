import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, PrimaryColumn, OneToMany, ManyToMany, ManyToOne, OneToOne, JoinColumn } from "typeorm"
import { Poll } from "./Poll"
import { Vote } from "./Vote"
//import { Message_Id } from "./Message_Id"

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

	/*@OneToOne(() => Message_Id, message_id => message_id.candidate)
	@JoinColumn()
	message_id: Message_Id*/

	@OneToMany(() => Vote, vote => vote.candidate)
	votes: Array<Vote>

	/*constructor(name: string) {
		super()

		this.name = name
	}*/
}