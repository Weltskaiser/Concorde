import { expect } from 'chai'
import { Elector_Status, set_vote, start_poll_back, try_democratie_amour } from "../src/entity/Bot"
import "reflect-metadata"

import { Client, TextChannel, User } from 'discord.js'
import { AppDataSource, start_bot } from '../src/app'
import { Poll, Poll_State } from '../src/entity/Poll'
import { Candidate } from '../src/entity/Candidate'
import * as bcrypt from "bcrypt"
import { Vote } from '../src/entity/Vote'

// class Client extends Bot {

// 	static async create() {
// 		let res = new Client()
// 		await res.init()
// 		return res
// 	}

// 	private letructor () {
// 		super()
// 	}

// 	private init = async () => {
// 		await this.login()
// 	}
// }


// let client = await Client.create()
// let bot = await start()
// let client = bot.client
// bot.allow_self_respond()
// let channel = await client.get_channel("919198908352167947") as TextChannel

// let start = async function(): Promise<Bot> {
// 	let bot = new Bot()

// 	await bot.login()

// 	let connection = await createConnection({
// 		type: "sqlite",
// 		database: "concorde.db",
// 		entities: [
// 			__dirname + "/entity/**/*.ts"
// 		],
// 		synchronize: true
// 	})
// 	await connection.runMigrations()
// 	console.log("!!!!!!");

// 	return bot
// }

let right_democracy_question = "La démocratie à Grignon c'est quoi ?"
let wrong_democracy_question = "La démocratei à Grignon c'est quoi ?"
let channel_1_id = "919198908352167947"
let author_1_id = "1234567890"
const saltRounds = 10

let try_democratie_amour_ok = async (message: string, channel_id: string) => {
	// let bot = await start()
	// bot.allow_self_respond()
	let bot = await start_bot()
	let client = bot.client

	let channel = await client.channels.fetch(channel_id) as TextChannel
	let message_sent = await channel.send(message)

	let result = await try_democratie_amour(message_sent)
	// await getConnection().close()
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
				introduction_message_id: "1234567890",
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
				message_id: candidates_s[i],
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
	// console.log(await AppDataSource.getRepository(Poll).find())

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

let try_create_right_vote = async function(): Promise<boolean> {
	let bot = await start_bot()
	let client = bot.client

	let author_id = author_1_id
	let command = `n Salut "C'est cool"\nA\nB`
	let title = "Salut"
	let end_date = "C'est cool"
	let channel_id = channel_1_id
	let candidates_s = ["A", "B"]

	let poll_wanted = await create_poll_wanted(author_id, title, end_date, channel_id, candidates_s)
	// console.log("Srx ?", poll_wanted)


	let candidate_index = 0
	let candidates = await AppDataSource.getRepository(Candidate)
		.createQueryBuilder("candidate")
		.leftJoinAndSelect("candidate.poll", "poll")
		.where("poll.id = :poll_id_p", { poll_id_p: poll_wanted.id })
		.getMany()
	let candidate = candidates[candidate_index]
	let candidate_message_id = candidate.message_id
	let emoji_id = "1%E2%83%A3"

	await set_vote(client, poll_wanted, candidate, author_id, emoji_id)
	let vote_created = await AppDataSource.getRepository(Vote)
		.createQueryBuilder("vote")
		.leftJoinAndSelect("vote.candidate", "candidate")
		.leftJoinAndSelect("vote.elector", "elector")
		.leftJoinAndSelect("elector.poll", "poll")
		.where("candidate.message_id = :message_id_p", { message_id_p: candidate_message_id })
		.getOneOrFail()
	// console.log(vote_created, vote_created.elector)

	let result = vote_created.candidate_rank === 1
		&& await bcrypt.compare(author_id, vote_created.elector.hash_id)
		&& vote_created.elector.complete === Elector_Status.uncomplete
		&& vote_created.elector.poll.id === poll_wanted.id

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
})