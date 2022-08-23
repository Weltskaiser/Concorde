import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne } from "typeorm"
import { Candidate } from "./Candidate"
import { Elector } from "./Elector"

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
}