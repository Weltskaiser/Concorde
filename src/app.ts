//import { User, UserManager } from 'discord.js'
import { createConnection, Connection, getConnection, getRepository, EntityNotFoundError } from "typeorm"
import "reflect-metadata"
import { Bot, Elector_Status } from './entity/Bot'
import { Poll_State, Poll } from './entity/Poll'
import { Elector } from "./entity/Elector"
//import { Message_Id } from './entity/Message_Id'
import { Candidate } from './entity/Candidate'

(async () => {
	let bot = new Bot()
	
	await bot.login()
	
	let connection = await createConnection({
		type: "sqlite",
		//database: "C:\\Users\\Nicolas\\Documents\\Tech1\\Discord\\DB\\concorde2.db",
		database: "concorde.db",
		entities: [
			__dirname + "/entity/**/*.ts"
		],
		synchronize: true
	})
	await connection.runMigrations()
	console.log("!!!!!!");

	/*let i_1 = (await getConnection()
		.createQueryBuilder()
		.insert()
		.into(Poll)
		.values({ title: "title", end_date_given: true, end_date: "now", channel_id: "4814984", introduction_message_id: "4526", state: Poll_State.open, candidates_count: 2 })
		.execute()).identifiers
	console.log(i_1)
	let poll_1: Poll
	try {
		poll_1 = await getRepository(Poll)
			.createQueryBuilder("poll")
			.where("poll.id = :id_p", { id_p: i_1[0].id })
			.getOneOrFail()
	} catch (error) {
		console.log("Aïe 1")
	}
	console.log(poll_1)
	let i_2 = (await getConnection()
		.createQueryBuilder()
		.insert()
		.into(Poll)
		.values({ title: "title !", end_date_given: true, end_date: "now", channel_id: "4814984", introduction_message_id: "4526", state: Poll_State.open, candidates_count: 2 })
		.execute()).identifiers
	console.log(i_2)
	let poll_2: Poll
	try {
		poll_2 = await getRepository(Poll)
			.createQueryBuilder("poll")
			.where("poll.id = :id_p", { id_p: i_2[0].id })
			.getOneOrFail()
	} catch (error) {
		console.log("Aïe 2")
	}
	console.log(poll_2)

	await getConnection()
		.createQueryBuilder()
		.insert()
		.into(Elector)
		.values({
			hash_id: 1,
			///hash_id: 1,
			complete: Elector_Status.uncomplete,
			poll: poll_1
		})
		.execute()
	console.log("Here")
	await getConnection()
		.createQueryBuilder()
		.insert()
		.into(Elector)
		.values({
			hash_id: 1,
			///hash_id: 1,
			complete: Elector_Status.uncomplete,
			poll: poll_2
		})
		.execute()
	console.log(await Elector.find({ relations: ["poll"] }))*/

	/*let elector: Elector
	for (let i = 0; i < 2; i++) {
		try {
			console.log(await Elector.find({ relations: ["poll"] }))
			//console.log(await Poll.find({ relations: ["electors"] }))
			console.log("Repère")
			//console.log(string_to_hash(user.id), 1)
			elector = await getRepository(Elector)
				.createQueryBuilder("elector")
				.leftJoinAndSelect("elector.poll", "poll")
				.where("elector.hash_id = :hash_id_p", { hash_id_p: 18465 })
				.andWhere("poll.id = :poll_id_p", { poll_id_p: poll.id })
				.getOneOrFail()
		} catch (error) {
			console.log("°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°")
			try {
				elector = await getRepository(Elector)
					.createQueryBuilder("elector")
					.leftJoinAndSelect("elector.poll", "poll")
					.where("elector.hash_id = :elector_hash_id_p", { elector_hash_id_p: (await getConnection()
						.createQueryBuilder()
						.insert()
						.into(Elector)
						.values({
							hash_id: 18465,
							///hash_id: 1,
							complete: Elector_Status.uncomplete,
							poll: poll
						})
						.execute()).identifiers[0].hash_id })
					.getOneOrFail()
			} catch (error) {
				console.log("Impossible")
			}
		}
		console.log(elector)
		poll = elector.poll
	}
	console.log("--------------------------------------------------------")*/

	/*let user = new Elector()
	user.age = 9001
	user.firstName = "Henri"
	user.lastName = "Martin"
	await user.save()*/

	//let candidates = ["Lui", "Lui", "Et lui"]
	//console.log("Ima herrrrre")
	/*let polli = new Poll("title", true, "now", "4814984")
	await connection.manager.save(polli)
	let poll: Poll
	try {
		poll = await getRepository(Poll)
			.createQueryBuilder("poll")
			.where("poll.id = :id_p", { id_p: 100 })
			.getOneOrFail()
	} catch (error) {
		console.log("Déluge puis ?")
		if (error == EntityNotFoundError) {
			console.log("Tempête")
		}
	}*/

	/*/*await getConnection()
		.createQueryBuilder()
		.insert()
		.into(Poll)
		.values({ title: "title", end_date_given: true, end_date: "now", channel_id: "4814984", introduction_message_id: "4526", state: Poll_State.open, candidates_count: 2 })
		.execute()
	let poll: Poll
	try {
		poll = await getRepository(Poll)
		.createQueryBuilder("poll")
		.where("poll.title = :title_p", { title_p: "title"})
		.getOne()
	} catch (error) {
		console.log("Aïe 1")
	}
	console.log(poll)

	await getConnection()
		.createQueryBuilder()
		.insert()
		.into(Candidate)
		.values({ message_id: "1561", name: "Nicolas", poll: poll })
		.execute()
	console.log(await Poll.find( { relations: ["candidates"] }))
	console.log(await Candidate.find( { relations: ["poll"] }))
	let candidate: Candidate
	try {
		candidate = await getRepository(Candidate)
			.createQueryBuilder("candidate")
			.leftJoinAndSelect("candidate.poll", "poll")
			.where("candidate.message_id = :message_id_p", { message_id_p: "1561" })
			.andWhere("poll.id = :poll_id_p", { poll_id_p: poll.id })
			.getOneOrFail()
	} catch (error) {
		console.log("Aïe 2")
	}
	console.log(candidate)
	console.log(candidate.poll)
	
	await getConnection()
		.createQueryBuilder()
		.insert()
		.into(Elector)
		.values({ hash_id: 1561, complete: Elector_Status.uncomplete, poll: poll })
		.execute()
	console.log(await Poll.find( { relations: ["electors"] }))
	console.log(await Elector.find( { relations: ["poll"] }))
	let elector: Elector
	try {
		elector = await getRepository(Elector)
			.createQueryBuilder("elector")
			.leftJoinAndSelect("elector.poll", "poll")
			.where("elector.hash_id = :hash_id_p", { hash_id_p: 1561 })
			.andWhere("poll.id = :poll_id_p", { poll_id_p: poll.id })
			.getOneOrFail()
	} catch (error) {
		console.log("Aïe 3")
	}
	console.log(elector)
	console.log(elector.poll)
	/*poll.end_date_given = true
	poll.end_date = "new"
	//poll.candidates = []
	poll.channel_id = "4814984"
	poll.introduction_message_id = "2"
	poll.state = "5"*/
	//console.log("Ima heeeeeeeere")
	/*for (let i = 0; i < candidates.length; i++) {
		let candidate = new Candidate(candidates[i])
		//candidate.poll = poll
		candidate.save()
	}
	console.log("Imaaaaaaa here")*/
	//console.log("Iiiiiiima here")

	/*await getRepository(Poll_Message_Id)
		.createQueryBuilder()
		.insert()
		.values({  })*/
	/*let message_id_1 = new Message_Id("984242465424186286"/*, poll*//*)
	message_id_1.poll = poll
	await connection.manager.save(message_id_1)
	let message_id_2 = new Message_Id("184242465424186286"/*, poll*//*)
	message_id_2.poll = poll
	await connection.manager.save(message_id_2)

	console.log(await Poll.find())
//	console.log(await Candidate.find())
	console.log(await Message_Id.find())

	console.log(poll)
	
	console.log(message_id_1.poll)*/

	/*let poll_n = await getRepository(Poll)
		.createQueryBuilder("poll")
		.leftJoinAndSelect("poll.messages_ids", "message_id")
		.where("message_id = :message_id_p", { message_id_p: message_id_1})
		.getOne()
	console.log(poll_n)*/
	/*let poll_1 = await connection
		.getRepository(Poll)
		.createQueryBuilder("poll")
		.where("poll.id = :id", { id: 1 })
		.getOne();
	
	console.log(poll_1)
	console.log(poll_1.id)*/

	/*const firstUser = connection.getRepository(Elector)
	console.log(firstUser)*/
})()