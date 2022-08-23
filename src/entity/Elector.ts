import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany, ManyToOne, getRepository } from "typeorm"
import { Poll } from "./Poll"
import { Elector_Status } from "./Bot"
import { Vote } from "./Vote"

@Entity()
export class Elector extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number
	
	@Column()
	hash_id: string

	@Column()
	complete: Elector_Status

	@ManyToOne(() => Poll, poll => poll.electors)
	poll: Poll

	@OneToMany(() => Vote, vote => vote.elector)
	votes: Array<Vote>

	get_result = async function(): Promise<Array<Array<number>>> {
		let votes: Array<Vote>
		try {
			votes = await getRepository(Vote)
				.createQueryBuilder("vote")
				.leftJoinAndSelect("vote.elector", "elector")
				.leftJoinAndSelect("vote.candidate", "candidate")
				.where("elector.hash_id = :elector_hash_id_p", { elector_hash_id_p: this.hash_id })
				.getMany()
		} catch (error) {
			console.log("Snif 4")
		}
		let votes_sorted_by_poll_candidates = votes.sort((a, b) => a.candidate.order - b.candidate.order)
		let result = new Array<Array<number>>(votes.length)
		for (let i = 0; i < result.length; i++) {
			let line = new Array<number>(votes_sorted_by_poll_candidates.length).fill(0)
			result[i] = line
		}
		for (let i = 0; i < votes_sorted_by_poll_candidates.length; i++) {
			for (let j = 0; j < i; j++) {
				let values: number[] = []
				if (votes_sorted_by_poll_candidates[i].candidate_rank < votes_sorted_by_poll_candidates[j].candidate_rank) {
					values = [1, 0]
				} else if (votes_sorted_by_poll_candidates[i].candidate_rank > votes_sorted_by_poll_candidates[j].candidate_rank) {
					values = [0, 1]
				} else {
					values = [0, 0]
				}
				result[i][j] = values[0]
				result[j][i] = values[1]
			}
		}
		return result
	}
}