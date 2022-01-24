import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, PrimaryColumn, OneToMany, ManyToMany, ManyToOne } from "typeorm"
import { Candidate } from "./Candidate"
import { Elector } from "./Elector"
import { Poll } from "./Poll"

@Entity()
export class Vote extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number

	@Column()
	candidate_rank: number

	@ManyToOne(() => Elector, elector => elector.votes)
	elector: Elector

	@ManyToOne(() => Candidate, candidate => candidate.votes)
	candidate: Candidate

	/*constructor(candidate_rank: number) {
		super()

		this.candidate_rank = candidate_rank
	}*/
}