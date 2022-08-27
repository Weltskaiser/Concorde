//import { User, UserManager } from 'discord.js'
import { EntityNotFoundError, DataSource } from "typeorm"
import "reflect-metadata"
import { Bot, Elector_Status } from './entity/Bot'
import { Client } from "discord.js"
// import { Poll_State, Poll } from './entity/Poll'
// import { Elector } from "./entity/Elector"
// //import { Message_Id } from './entity/Message_Id'
// import { Candidate } from './entity/Candidate'
// import { Vote } from "./entity/Vote"
// const QuickChart = require('quickchart-js')
// import { Client, MessageEmbed, TextChannel } from "discord.js"

export let start_bot = async function(): Promise<Bot> {
	let bot = new Bot()

	await bot.login()

	// let connection = await createConnection({
	// 	type: "sqlite",
	// 	database: "concorde.db",
	// 	entities: [
	// 		__dirname + "/entity/**/*.ts"
	// 	],
	// 	synchronize: true
	// })
	// await connection.runMigrations()
	// console.log("!!!!!!");

	// let i_1 = (await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Poll)
	// 	.values({ title: "title", end_date_given: true, end_date: "now", channel_id: "1010885068698439710", introduction_message_id: "4526", state: Poll_State.open, candidates_count: 3 })
	// 	.execute()).identifiers
	// console.log(i_1)
	// let poll_1: Poll
	// try {
	// 	poll_1 = await getRepository(Poll)
	// 		.createQueryBuilder("poll")
	// 		.where("poll.id = :id_p", { id_p: i_1[0].id })
	// 		.getOneOrFail()
	// } catch (error) {
	// 	console.log("Aïe 1")
	// }
	// console.log(poll_1)
	// /*let i_2 = (await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Poll)
	// 	.values({ title: "title !", end_date_given: true, end_date: "now", channel_id: "4814984", introduction_message_id: "4526", state: Poll_State.open, candidates_count: 2 })
	// 	.execute()).identifiers
	// console.log(i_2)
	// let poll_2: Poll
	// try {
	// 	poll_2 = await getRepository(Poll)
	// 		.createQueryBuilder("poll")
	// 		.where("poll.id = :id_p", { id_p: i_2[0].id })
	// 		.getOneOrFail()
	// } catch (error) {
	// 	console.log("Aïe 2")
	// }
	// console.log(poll_2)

	// */let i_e_1 = (await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Elector)
	// 	.values({
	// 		hash_id: 1,
	// 		///hash_id: 1,
	// 		complete: Elector_Status.complete,
	// 		poll: poll_1
	// 	})
	// 	.execute()).identifiers
	// let i_e_2 = (await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Elector)
	// 	.values({
	// 		hash_id: 2,
	// 		///hash_id: 1,
	// 		complete: Elector_Status.complete,
	// 		poll: poll_1
	// 	})
	// 	.execute()).identifiers
	// let i_e_3 = (await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Elector)
	// 	.values({
	// 		hash_id: 3,
	// 		///hash_id: 1,
	// 		complete: Elector_Status.complete,
	// 		poll: poll_1
	// 	})
	// 	.execute()).identifiers
	// console.log(i_e_1, i_e_2, i_e_3)
	// let elector_1, elector_2, elector_3: Elector
	// try {
	// 	elector_1 = await getRepository(Elector)
	// 		.createQueryBuilder("elector")
	// 		.leftJoinAndSelect("elector.poll", "poll")
	// 		.where("poll.id = :id_p", { id_p: i_1[0].id })
	// 		.andWhere("elector.id = :i_e_p", { i_e_p: i_e_1[0].id })
	// 		.getOneOrFail()
	// 	elector_2 = await getRepository(Elector)
	// 		.createQueryBuilder("elector")
	// 		.leftJoinAndSelect("elector.poll", "poll")
	// 		.where("poll.id = :id_p", { id_p: i_1[0].id })
	// 		.andWhere("elector.id = :i_e_p", { i_e_p: i_e_2[0].id })
	// 		.getOneOrFail()
	// 	elector_3 = await getRepository(Elector)
	// 		.createQueryBuilder("elector")
	// 		.leftJoinAndSelect("elector.poll", "poll")
	// 		.where("poll.id = :id_p", { id_p: i_1[0].id })
	// 		.andWhere("elector.id = :i_e_p", { i_e_p: i_e_3[0].id })
	// 		.getOneOrFail()
	// } catch (error) {
	// 	console.log("Aïe 2")
	// }
	// console.log(elector_1, elector_2, elector_3)
	// console.log("Here")
	// /*await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Elector)
	// 	.values({
	// 		hash_id: 1,
	// 		///hash_id: 1,
	// 		complete: Elector_Status.uncomplete,
	// 		poll: poll_2
	// 	})
	// 	.execute()
	// console.log(await Elector.find({ relations: ["poll"] }))*/

	// await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Candidate)
	// 	.values({ message_id: "1561", order: 1, name: "Adrien", poll: poll_1 })
	// 	.execute()
	// await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Candidate)
	// 	.values({ message_id: "1563", order: 2, name: "Nicolas", poll: poll_1 })
	// 	.execute()
	// await getConnection()
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(Candidate)
	// 	.values({ message_id: "1565", order: 3, name: "Sylvain", poll: poll_1 })
	// 	.execute()
	// let candidate_1, candidate_2, candidate_3: Candidate
	// try {
	// 	candidate_1 = await getRepository(Candidate)
	// 		.createQueryBuilder("candidate")
	// 		.where("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: "1561" })
	// 		.getOneOrFail()
	// 	candidate_2 = await getRepository(Candidate)
	// 		.createQueryBuilder("candidate")
	// 		.where("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: "1563" })
	// 		.getOneOrFail()
	// 	candidate_3 = await getRepository(Candidate)
	// 		.createQueryBuilder("candidate")
	// 		.where("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: "1565" })
	// 		.getOneOrFail()
	// } catch (error) {
	// 	console.log(error)
	// }

	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 1,
	// 	elector: elector_1,
	// 	candidate: candidate_1
	// })
	// .execute()
	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 2,
	// 	elector: elector_1,
	// 	candidate: candidate_2
	// })
	// .execute()
	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 3,
	// 	elector: elector_1,
	// 	candidate: candidate_3
	// })
	// .execute()
	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 3,
	// 	elector: elector_2,
	// 	candidate: candidate_1
	// })
	// .execute()
	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 1,
	// 	elector: elector_2,
	// 	candidate: candidate_2
	// })
	// .execute()
	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 2,
	// 	elector: elector_2,
	// 	candidate: candidate_3
	// })
	// .execute()
	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 2,
	// 	elector: elector_3,
	// 	candidate: candidate_1
	// })
	// .execute()
	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 3,
	// 	elector: elector_3,
	// 	candidate: candidate_2
	// })
	// .execute()
	// await getConnection()
	// .createQueryBuilder()
	// .insert()
	// .into(Vote)
	// .values({
	// 	candidate_rank: 1,
	// 	elector: elector_3,
	// 	candidate: candidate_3
	// })
	// .execute()
	// console.log(await Vote.find({relations:["elector", "candidate"]}))
	
	// let client = bot.client

	// let channel = await client.channels.fetch(poll_1.channel_id) as TextChannel

	// /*let candidates_count = (await getRepository(Candidate)
	// 	.createQueryBuilder("candidate")
	// 	.where("candidate.poll = :poll_p", { poll_p: this })
	// 	.getMany()).length*/
	// //let results_complete = new Array<Array<number>>(this.candidates.length)
	// let results_complete = new Array<Array<number>>(poll_1.candidates_count)
	// for (let i = 0; i < results_complete.length; i++) {
	// 	//let line = new Array<number>(this.candidates.length).fill(0)
	// 	let line = new Array<number>(poll_1.candidates_count).fill(0)
	// 	results_complete[i] = line
	// }
	// let complete_electors: Array<Elector>
	// try {
	// 	complete_electors = await getRepository(Elector)
	// 		.createQueryBuilder("elector")
	// 		.leftJoinAndSelect("elector.poll", "poll")
	// 		.where("poll.id = :poll_id_p", { poll_id_p: poll_1.id })
	// 		.andWhere("elector.complete = :elector_complete_p", { elector_complete_p: Elector_Status.complete })
	// 		.getMany()
	// } catch (error) {
	// 	console.log("Snif 6")
	// }
	// for (let e = 0; e < complete_electors.length; e++) {
	// 	let elector_result = await complete_electors[e].get_result()
	// 	//console.log(elector_result)

	// 	//channel.send("====")
	// 	//channel.send(this.electors[e].id)
	// 	//channel.send(complete_electors[e].hash_id.toString())
	// 	let lines = "\`\`\`\n" + complete_electors[e].hash_id.toString()
	// 	for (let i = 0; i < elector_result.length; i++) {
	// 		let line = ""
	// 		for (let j = 0; j < elector_result.length; j++) {
	// 			line += elector_result[i][j] + " "
	// 		}
	// 		//channel.send(line)
	// 		lines += "\n" + line
	// 	}
	// 	lines += "\`\`\`"
	// 	channel.send(lines)

	// 	for (let i = 0; i < results_complete.length; i++) {
	// 		for (let j = 0; j < results_complete.length; j++) {
	// 			results_complete[i][j] += elector_result[i][j]
	// 			//console.log(i, j, results_complete)
	// 		}
	// 	}
	// }

	// //channel.send("====")
	// let lines = "\`\`\`\n"
	// for (let i = 0; i < results_complete.length; i++) {
	// 	let line = ""
	// 	for (let j = 0; j < results_complete.length; j++) {
	// 		line += results_complete[i][j] + " "
	// 	}
	// 	//channel.send(line)
	// 	lines += "\n" + line
	// }
	// lines += "\`\`\`"
	// channel.send(lines)

	// let results_wins_counts = []
	// for (let i = 0; i < results_complete.length; i++) {
	// 	let wins_count = 0
	// 	for (let j = 0; j < results_complete.length; j++) {
	// 		if (results_complete[i][j] > results_complete[j][i]) {
	// 			wins_count++
	// 		}
	// 	}
	// 	results_wins_counts[i] = wins_count
	// }

	// let candidates_names: Array<Candidate>
	// try {
	// 	candidates_names = await getRepository(Candidate)
	// 		.createQueryBuilder("candidate")
	// 		.leftJoinAndSelect("candidate.poll", "poll")
	// 		.select("name")
	// 		.where("poll.id = :poll_id_p", { poll_id_p: poll_1.id })
	// 		.getRawMany()
	// } catch (error) {
	// 	console.log("Snif 7")
	// }
	// let raw_candidates_names_p: Array<string> = Array<string>()
	// for (let c of candidates_names) {
	// 	raw_candidates_names_p.push(c.name)
	// }
	// //console.log(raw_candidates_names_p)
	// const chart = new QuickChart();
	// chart.setConfig({
	// 	type: 'bar',
	// 	//data: { labels: this.candidates, datasets: [{ label: 'Nombre de duels gagnés par candidat', data: results_wins_counts }] },
	// 	data: { labels: raw_candidates_names_p, datasets: [{ label: 'Nombre de duels gagnés par candidat', data: results_wins_counts }] },
	// });
	// ///console.log(chart, chart.getUrl())

	// const chartEmbed = new MessageEmbed()
	// 	.setTitle("Résultats du vote : " + poll_1.title)
	// 	//.setDescription('Here\'s a chart that I generated')
	// 	.setImage(
	// 		chart.getUrl()
	// 	)
	// channel.send({ embeds: [chartEmbed] });
	return bot
}

start_bot()

export let AppDataSource = new DataSource({
	type: "sqlite",
	database: "concorde.db",
	entities: [
		__dirname + "/entity/**/*.ts"
	],
	synchronize: true
})
AppDataSource.initialize().then(() => { console.log("Database initialized!") })
// await connection.runMigrations()
console.log("!!!!!!");