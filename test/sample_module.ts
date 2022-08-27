import { expect } from 'chai'
import { Elector_Status, set_vote, start_poll_back, try_democratie_amour, emoji_to_vote } from "../src/entity/Bot"
import "reflect-metadata"

import { Client, TextChannel } from 'discord.js'
import { AppDataSource, start_bot } from '../src/app'
import { Poll, Poll_State } from '../src/entity/Poll'
import { Candidate } from '../src/entity/Candidate'
import * as bcrypt from "bcrypt"
import { Vote } from '../src/entity/Vote'

let right_democracy_question = "La démocratie à Grignon c'est quoi ?"
let wrong_democracy_question = "La démocratei à Grignon c'est quoi ?"
let channel_1_id = "919198908352167947"
let author_1_id = "1234567890"
let author_2_id = "1357902468"
let author_3_id = "9876543210"
const saltRounds = 10

let try_democratie_amour_ok = async (message: string, channel_id: string) => {
	let bot = await start_bot()
	let client = bot.client

	let channel = await client.channels.fetch(channel_id) as TextChannel
	let message_sent = await channel.send(message)

	let result = await try_democratie_amour(message_sent)
	// await AppDataSource.destroy()
	return result
}

let create_poll = async function(client: Client, author_id: string, channel_id: string, command: string): Promise<Poll> { // Here we consider there is a trigger on the user and he's trying to create a poll
	await start_poll_back(client, command, author_id, channel_id)

	let poll_created = await AppDataSource.getRepository(Poll).findOneBy({ id: 1 })
	return poll_created
}

let create_poll_wanted = async function(author_id: string, title: string, end_date: string, channel_id: string, candidates_s: string[]): Promise<Poll> {
	let poll_wanted = await AppDataSource.getRepository(Poll).findOneBy({ id:
		(await AppDataSource.createQueryBuilder()
			.insert()
			.into(Poll)
			.values({
				author_hash_id: await bcrypt.hash(author_id, saltRounds),
				title: title,
				end_date_given: true,
				end_date: end_date,
				channel_id: channel_id,
				introduction_message_id: author_id,
				state: Poll_State.open,
				candidates_count: candidates_s.length
			})
			.execute()).identifiers[0].id
	})
	for (let i = 0; i < candidates_s.length; i++) {
		await AppDataSource.createQueryBuilder()
			.insert()
			.into(Candidate)
			.values({
				name: candidates_s[i],
				message_id: candidates_s[i]+author_id,
				order: i,
				poll: poll_wanted
			})
			.execute()
	}

	return poll_wanted
}

let try_create_right_poll = async function(): Promise<boolean> {
	let bot = await start_bot()
	let client = bot.client

	let author_id = author_1_id
	let command = `n Salut "C'est cool"\nA\nB`
	let title = "Salut"
	let end_date = "C'est cool"
	let channel_id = channel_1_id
	let candidates_s = ["A", "B"]

	let pc = await create_poll(client, author_id, channel_id, command)

	let result_no_candidates = pc.title === title
		&& pc.end_date_given === true
		&& pc.end_date === end_date
		&& pc.channel_id === channel_id
		&& pc.state === Poll_State.open
		&& pc.candidates_count === candidates_s.length
	let result_candidates = true
	let candidates_c = await AppDataSource.getRepository(Candidate)
		.createQueryBuilder("candidate")
		.leftJoinAndSelect("candidate.poll", "poll")
		.where("poll.id = :poll_id_p", { poll_id_p: pc.id })
		.getMany()
	for (let index of Array(candidates_s.length).keys()) {
		result_candidates = result_candidates && (candidates_c[index].name === candidates_s[index])
	}
	let result = result_no_candidates && result_candidates

	// await AppDataSource.destroy()
	return result
}

let try_set_vote = async function(client: Client, poll_wanted: Poll, candidates: Candidate[], elector_id: string, candidate_index: number, emoji_id: string) {
	let candidate_rank = emoji_to_vote.get(emoji_id)
	let candidate = candidates[candidate_index]
	let candidate_message_id = candidate.message_id

	await set_vote(client, poll_wanted, candidate, elector_id, emoji_id)
	let vote_created = await AppDataSource.getRepository(Vote)
		.createQueryBuilder("vote")
		.leftJoinAndSelect("vote.candidate", "candidate")
		.leftJoinAndSelect("vote.elector", "elector")
		.leftJoinAndSelect("elector.poll", "poll")
		.where("candidate.message_id = :message_id_p", { message_id_p: candidate_message_id })
		.getOneOrFail()
	// console.log(vote_created, vote_created.elector)

	let result = vote_created.candidate_rank === candidate_rank
		&& await bcrypt.compare(elector_id, vote_created.elector.hash_id)
		&& vote_created.elector.complete === Elector_Status.uncomplete
		&& vote_created.elector.poll.id === poll_wanted.id

	return result
}

let try_create_right_vote = async function(): Promise<boolean> {
	let bot = await start_bot()
	let client = bot.client

	let poll_author_id = author_2_id
	let command = `n Salut "C'est cool"\nA\nB`
	let title = "Salut"
	let end_date = "C'est cool"
	let channel_id = channel_1_id
	let candidates_s = ["A", "B"]

	let poll_wanted = await create_poll_wanted(poll_author_id, title, end_date, channel_id, candidates_s)
	let candidates = await AppDataSource.getRepository(Candidate)
		.createQueryBuilder("candidate")
		.leftJoinAndSelect("candidate.poll", "poll")
		.where("poll.id = :poll_id_p", { poll_id_p: poll_wanted.id })
		.getMany()

	let elector_id = author_1_id
	let candidate_index = 0
	let emoji_id = "1%E2%83%A3"
	let result = try_set_vote(client, poll_wanted, candidates, elector_id, candidate_index, emoji_id)

	return result
}

let try_create_2_right_votes = async function(): Promise<boolean> {
	let bot = await start_bot()
	let client = bot.client

	let poll_author_id = author_1_id
	let command = `n Salut "C'est cool"\nA\nB`
	let title = "Salut"
	let end_date = "C'est cool"
	let channel_id = channel_1_id
	let candidates_s = ["A", "B"]

	let poll_wanted = await create_poll_wanted(poll_author_id, title, end_date, channel_id, candidates_s)
	let candidates = await AppDataSource.getRepository(Candidate)
		.createQueryBuilder("candidate")
		.leftJoinAndSelect("candidate.poll", "poll")
		.where("poll.id = :poll_id_p", { poll_id_p: poll_wanted.id })
		.getMany()

	let elector_1_id = author_2_id
	let elector_2_id = author_3_id
	let candidate_index_1 = 0
	let candidate_index_2 = 1
	let emoji_1_id = "1%E2%83%A3"
	let emoji_2_id = "2%E2%83%A3"
	let result_1 = await try_set_vote(client, poll_wanted, candidates, elector_1_id, candidate_index_1, emoji_1_id)
	let result_2 = await try_set_vote(client, poll_wanted, candidates, elector_2_id, candidate_index_2, emoji_2_id)

	let result = result_1 && result_2

	return result
}

describe('Module', () => {
	it('démocratie_amour_ok', async () => {
		expect(await try_democratie_amour_ok(right_democracy_question, channel_1_id)).to.equal(true)
	})
	it('démocratie_amour_no', async () => {
		expect(await try_democratie_amour_ok(wrong_democracy_question, channel_1_id)).to.equal(false)
	})
	it('create_poll', async () => {
		expect(await try_create_right_poll()).to.equal(true)
	})
	it('vote', async () => {
		expect(await try_create_right_vote()).to.equal(true)
	})
	it('vote 2 electors', async () => {
		expect(await try_create_2_right_votes()).to.equal(true)
	})
})