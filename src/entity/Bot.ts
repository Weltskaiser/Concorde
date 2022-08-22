import { Client, Guild, Channel, Intents, Message, TextChannel, User, TextBasedChannel, MessageReaction, MessageEmbed, ThreadChannel } from 'discord.js'
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, PrimaryColumn, OneToMany, ManyToMany, ManyToOne, OneToOne, getConnection, getRepository, EntityNotFoundError, Connection, createQueryBuilder } from "typeorm"
import { Poll_State,launch_poll, Poll } from "./Poll"
import { Bot_State, /*Start, */Trigger } from "./Bot_State"
import { Elector } from './Elector'
import { Vote } from './Vote'
import { Candidate } from "./Candidate"
import * as bcrypt from "bcrypt"

//export let polls = Array<Poll>()
//export let next_poll_id = 0

// let string_to_hash = function(string: string) {
// 	let hash = 0

// 	if (string.length === 0) return hash

// 	for (let i = 0; i < string.length; i++) {
// 		let char = string.charCodeAt(i)
// 		hash = ((hash << 5) - hash) + char
// 		hash |= 0
// 	}

// 	return hash
// }

export class Bot {
	// private client: Client
	public client: Client
	private self_respond_counter: number

	/*@OneToMany(() => Trigger, trigger => trigger.bot)
	triggers: Array<Trigger>

	@OneToMany(() => Start, start => start.bot)
	starts: Array<Start>*/

	/*guild: Guild
	channel: TextBasedChannels*/

	constructor () {
		this.client = new Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGES"], partials: ["REACTION", "USER", "MESSAGE", "CHANNEL"] })
		this.self_respond_counter = 0

		/*this.triggers = new Array<Trigger>()
		this.starts = new Array<Start>()*/

		this.client.on('ready', () => {
			console.log(`Hé !! Logged in as ${this.client.user.tag}!`)
		})

		this.client.on('messageCreate', async (message: Message) => {
			if (message.author.id === this.client.user.id) {
				if (this.self_respond_counter === 0) {
					return
				} else {
					this.self_respond_counter--
				}
			}

			if (await try_democratie_amour(message) === true) {
				return
			}

			let type = message.channel.type
			if (type === "DM") {
				message.author.send("Concorde ne fonctionne que sur les serveurs ! C'est compliqué de faire un vote dans une discussion de message privé...")
				return
			}

			// console.log("Début", await Trigger.find())
			//console.log(await Start.find())

			//if (!this.c_o(await try_command(this, message))) return
			let trigger_found = await try_command_trigger(this.client, message)
			///console.log(trigger_found)
			let start_found: Query_Result
			try {
				start_found = await try_command_start(this.client, message, trigger_found)
			} catch (error) {
				switch (error) {
					case Insert_Error.poll_insertion_failed: {
						console.log("Error while inserting poll.")
						throw error
					} case Insert_Error.candidate_insertion_failed: {
						console.log("Error while inserting candidate.")
						throw error
					} default: {
						throw error
					}
				}
			}
			// console.log(start_found)
			let vote_action_done = await try_command_vote_action(this.client, message, start_found)
			if (trigger_found === Query_Result.succeeded_create || trigger_found === Query_Result.failed_create
				|| start_found === Query_Result.succeeded_create || start_found === Query_Result.failed_create
				|| vote_action_done === Query_Result.succeeded_create || vote_action_done === Query_Result.failed_create) {
				message.delete()
			}
			/*if (trigger_found === true) {
				let start_found = await try_command_start(this.client, message)
				if (start_found === true)
			}*/

			// console.log("Fin", await Trigger.find())
			//console.log(await Start.find())
			// console.log("\n")
		})

		this.client.on('messageReactionAdd', async (reaction: MessageReaction, user: User) => {
			if (this.client.user.id === user.id) {
				return
			}

			try {
				await try_set_vote(reaction, user, this.client)
			} catch (error) {
				switch (error) {
					case Insert_Error.elector_insertion_failed: {
						console.log("Error while inserting elector.")
						throw error
					} default: {
						throw error
					}
				}
			}
		})
	}

	/*private c_o = (result: boolean | string) => {
		if (result !== true) {
			if (result !== "nmon") { // no message output needed
				console.log(result)			
			}
			return false
		}
		return true
	}*/

	async login () {
		await this.client.login(process.env.DISCORD_BOT_TOKEN)
	}

	get_channel = async (channel_id: string) => {
		return await this.client.channels.fetch(channel_id) as TextChannel
	}

	allow_self_respond = (nombre: number = 1) => {
		this.self_respond_counter = nombre
	}
}

/*let bot_already_stated_here = function(state: Array<Bot_State>, author_id: string, channel_id: string): any[] {
	for (let i = 0; i < state.length; i++) {
		let trigger = state[i]
		if (trigger.author_hash_id === string_to_hash(author_id) && trigger.channel_id === channel_id) {
			return [true, i]
		}
	}
	return [false]
}*/

let try_democratie_amour = async function(message: Message): Promise<boolean> {
	let message_sent: Message | undefined

	if (message.content === `La démocratie à Grignon c'est quoi ?`) {
		message_sent = await message.channel.send(`La démocratie à Grignon c'est le BDE et c'est que de l'amour, n'est-ce pas ?`)
	}
	
	return message_sent !== undefined
}

enum Insert_Error {
	poll_insertion_failed = 10,
	candidate_insertion_failed = 11,
	elector_insertion_failed = 12
}

enum Command_Error {
	empty_line = 0,
	unclosed_quotation_mark = 1,
	no_space_or_line_break_after_quotation_mark = 2,
	not_enough_elements_in_first_line = 3,
	too_many_elements_in_first_line = 4,
	first_character_not_n = 5,
	already_poll_in_channel_having_title = 6,
	not_enough_lines = 7,
	title_not_found = 8
}

/*interface error_E {
	empty_line: boolean
	unclosed_quotation_mark: boolean
	no_space_after_quotation_mark: boolean
}
type error = keyof error_E*/

let cut_into_lines = function(text: string): string[] {
	//console.log(text)
	let lines = []
	let line = ""
	let i = 0
	while (i < text.length) {
		if (text[i] === "\n") {
			lines.push(line)
			line = ""
			i++
			if (text[i] === "\n") throw Command_Error.empty_line
			if (i === text.length) {
				break
			}
		}
		line += text[i]
		i++
	}
	lines.push(line)
	//console.log(lines)

	return lines
}

let cut_command = function(string: string): string[] {
	let length = string.length
	let cut_string = []
	let i = 0
	let word = ""
	while (i < length) {
		if (string[i] === `"`) {
			i++
			if (i === length) throw Command_Error.unclosed_quotation_mark

			while (string[i] !== `"`) {
				word += string[i]

				i++
				if (i === length) throw Command_Error.unclosed_quotation_mark
			}

			if (i !== length - 1) {
				if (string[i + 1] !== " ") throw Command_Error.no_space_or_line_break_after_quotation_mark
			}

			cut_string.push(word)
			word = ""
		} else if (string[i] !== " ") {
			while (i < length) {
				if (string[i] === " ") {
					break
				}
				word += string[i]

				i++
			}

			cut_string.push(word)
			word = ""
		}

		i++
	}

	/*for (let i = 0; i < cut_string.length; i++) {
		console.log(cut_string[i])
	}
	console.log(cut_string.length)*/

	return cut_string
}

//let syntax_start_reminder = `\nExemple d'utilisation :\n> n "Vote lambda"\n> Candidat A\n> Candidat B\n> Candidat C\nPour arrêter de tenter de lancer un vote :\n> !ac`

let syntax_start_reminder = function(message_content: string): string {
	return "\nExemple d'utilisation (la date est optionnelle) :\n\`\`\`n \"Vote lambda\" \"Vendredi 24 décembre 2021, 12 h 34 m 56 s\"\nCandidat A\nCandidat B\nCandidat C\`\`\`"
	+ "\nVotre commande qui a échoué :\n\`\`\`\n" + message_content + "\`\`\`"
	+ "\nPour arrêter de tenter de lancer un vote :\n\`\`\`\n!ac\`\`\`"
}

/*let find_poll_from_channel = async function(channel_id: string): Promise<number> {
	let polls = await Poll.find()
	for (let i = 0; i < polls.length; i++) {
		if (channel_id === polls[i].channel_id) {
			return i
		}
	}
	return -1
}*/

enum Query_Result {
	not_a_command,
	failed_create,
	poll_not_close_properly,
	succeeded_create,
	found,
	not_found
}

let look_for_trigger = async function(message_channel_id: string, message_author_id: string): Promise<Query_Result> {
	let triggers = await getRepository(Trigger)
		.createQueryBuilder("trigger")
		// .where("trigger.author_hash_id = :author_hash_id_p", { author_hash_id_p: string_to_hash(message.author.id) })
		.where("trigger.channel_id = :channel_id_p", { channel_id_p: message_channel_id })
		.getMany()
	for (let trigger of triggers) {
		if (await bcrypt.compare(message_author_id, trigger.author_hash_id)) {
			return Query_Result.found
		}
	}
	return Query_Result.not_found
}

let try_command_trigger = async function(/*that: Bot*/client: Client, message: Message): Promise<Query_Result> {
	/*let triggered = bot_already_stated_here(that.triggers, message.author.id, message.channel.id)
	let started = bot_already_stated_here(that.starts, message.author.id, message.channel.id)*/
	if (await look_for_trigger(message.channel.id, message.author.id) === Query_Result.found) {
		return Query_Result.found
	} else { // No trigger, look_for_trigger returns Query_Result.not_found
		/*let message_content = message.content
		let message_author_id = message.author.id
		let message_channel_id = message.channel.id*/
		
		//message.delete()

		if (message.content !== "!cc") { /*!commencer Concorde*/
			return Query_Result.not_a_command
		}

		/*that.guild = message.guild
		that.channel = message.channel*/

		/*console.log(message.author.id)
		console.log(string_to_hash(message.author.id))
		console.log(message.channel.id)*/

		// Delete every trigger for every other channel
		let triggers = await getRepository(Trigger)
			.createQueryBuilder("trigger")
			.getMany()
		for (let trigger of triggers) {
			if (await bcrypt.compare(message.author.id, trigger.author_hash_id)) {
				await trigger.remove()
			}
		}

		// Now the trigger is on the current channel
		const saltRounds = 10
		await getConnection()
			.createQueryBuilder()
			.insert()
			.into(Trigger)
			.values({
				author_hash_id: await bcrypt.hash(message.author.id, saltRounds),
				channel_id: message.channel.id
			})
			.execute()
		//trigger.bot = this
		//await getConnection().manager.save(trigger)
		//that.triggers.push()

		//message.delete()

		return Query_Result.succeeded_create
	}
	/*if (!triggered[0]) {
		if (message.content !== "!cc") { /*!commencer Concorde*/
	/*		return
		}

		that.guild = message.guild
		that.channel = message.channel

		let trigger = new Trigger(string_to_hash(message.author.id), message.channel.id)
		trigger.bot = this
		await trigger.save()
		//that.triggers.push()

		message.delete()

		return
	} else if (!started[0]) {*/
}

let try_command_start = async function(client: Client, message: Message, trigger_found: Query_Result) : Promise<Query_Result> {
	//console.log("there")
	//console.log("Wait what?")
	if (trigger_found !== Query_Result.found) {
		//return Query_Result.not_a_command
		try {
			//console.log("Hello")
			/*await getRepository(Start)
				.createQueryBuilder("start")
				.where("start.author_hash_id = :author_hash_id_p", { author_hash_id_p: string_to_hash(message.author.id) })
				.andWhere("start.channel_id = :channel_id_p", { channel_id_p: message.channel.id })
				.getOneOrFail()*/
			await getRepository(Poll)
				.createQueryBuilder("poll")
				.where("poll.channel_id = :poll_channel_id_p", { poll_channel_id_p: message.channelId })
				.getOneOrFail()
		} catch (error) {
			return Query_Result.not_a_command
		}
		return Query_Result.found
	} else {
		//message.delete()

		let message_content = message.content
		let message_author = message.author
		let message_channel_id = message.channel.id

		if (message_content === "!ac") { /*!arrêter Concorde*/
			//that.triggers.splice(triggered[1])

			let triggers = await getRepository(Trigger)
				.createQueryBuilder("trigger")
				.where("channel_id = :channel_id_p", { channel_id_p: message_channel_id })
				.getMany()
			for (let trigger of triggers) {
				if (await bcrypt.compare(message.author.id, trigger.author_hash_id)) {
					await trigger.remove()
				}
			}

			return Query_Result.succeeded_create
		}

		try {
			let lines = cut_into_lines(message_content)

			let first_line = lines[0]

			let first_line_w = cut_command(first_line)
			//console.log(first_line_w)
			if (first_line_w.length < 2) throw Command_Error.not_enough_elements_in_first_line
			if (first_line_w.length > 3) throw Command_Error.too_many_elements_in_first_line
			if (first_line_w[0] !== "n") throw Command_Error.first_character_not_n

			let title = first_line_w[1]
			let polls_in_channel_having_title: Array<Poll>
			try {
				polls_in_channel_having_title = await getRepository(Poll)
					.createQueryBuilder("poll")
					.where("poll.title = :title_p", { title_p: title })
					.andWhere("poll.channel_id = :channel_id_p", { channel_id_p: message_channel_id })
					.getMany()
			} catch (error) {
				console.log("Snif 1")
			}
			if (polls_in_channel_having_title.length !== 0) {
				throw Command_Error.already_poll_in_channel_having_title
			}

			let end_date_given: boolean
			let end_date: string
			if (first_line_w.length === 3) {
				end_date_given = true
				end_date = first_line_w[2]
			} else {
				end_date_given = false
				end_date = "Now"
			}

			if (lines.length < 2) throw Command_Error.not_enough_lines
			let candidates = new Array<string>()
			for (let i = 1; i < lines.length; i++) {
				candidates.push(lines[i])
			}

			let state = Poll_State.open
			let messages_ids = await launch_poll(title, end_date_given, end_date, message_channel_id, state, candidates, client)
			//console.log("Salut")
			/*let poll_id = (await getConnection()
				.createQueryBuilder()
				.insert()
				.into(Poll)
				//.returning("id")
				.values({
					title: title,
					end_date_given: end_date_given,
					end_date: end_date,
					channel_id: message_channel_id,
					introduction_message_id: messages_ids[0],
					state: state,
					candidates_count: candidates.length
				})
				.execute()).generatedMaps[0].id*/
			let poll: Poll
			try {
				poll = await getRepository(Poll)
					.createQueryBuilder("poll")
					.where("poll.id = :poll_id_p", { poll_id_p: (await getConnection()
						.createQueryBuilder()
						.insert()
						.into(Poll)
						//.returning("id")
						.values({
							title: title,
							end_date_given: end_date_given,
							end_date: end_date,
							channel_id: message_channel_id,
							introduction_message_id: messages_ids[0],
							state: state,
							candidates_count: candidates.length
						})
						.execute()).identifiers[0].id })
					.getOneOrFail()
			} catch (error) {
				throw Insert_Error.poll_insertion_failed
				//console.log("Impossible 1")
			}

			///console.log(poll)
			
			//let poll = new Poll(title, end_date_given, end_date/*, candidates*/, message_channel_id)
			
			for (let i = 0; i < candidates.length; i++) {				
				let candidate: Candidate
				try {
					/*console.log("TEST")
					console.log((await getConnection()
						.createQueryBuilder()
						.insert()
						.into(Candidate)
						.values({
							name: candidates[i] + "RR",
							message_id: messages_ids[i + 1] + "1"
						})
						.execute()).identifiers)
					console.log((await getConnection()
						.createQueryBuilder()
						.insert()
						.into(Candidate)
						.values({
							name: candidates[i] + "RRE",
							message_id: messages_ids[i + 1] + "3"
						})
						.execute()).identifiers)
					console.log((await getConnection()
						.createQueryBuilder()
						.insert()
						.into(Candidate)
						.values({
							name: candidates[i] + "RRER",
							message_id: messages_ids[i + 1] + "4"
						})
						.execute()).identifiers)*/
					candidate = await getRepository(Candidate)
						.createQueryBuilder("candidate")
						.where("candidate.message_id = :message_id_p", { message_id_p: (await getConnection()
							.createQueryBuilder()
							.insert()
							.into(Candidate)
							.values({
								name: candidates[i],
								order: i,
								message_id: messages_ids[i + 1],
								poll: poll
							})
							.execute()).identifiers[0].message_id })
						.getOneOrFail()
				} catch (error) {
					throw Insert_Error.candidate_insertion_failed
					//console.log("Impossible 2")
				}
				//candidate.poll = poll
				await getConnection().manager.save(candidate)
				//console.log(candidate, candidate.poll)
				/*let polli: Poll
				try {
					polli = await getRepository(Poll)
						.createQueryBuilder("poll")
						.leftJoinAndSelect("poll.candidates", "candidate")
						.where("candidate.message_id = :message_id_p", { message_id_p: messages_ids[i + 1] })
						.getOneOrFail()
				} catch (error) {
					console.log("Everything was here")
					return
				}
				console.log("ONE", polli)
				console.log(await Candidate.find())
				console.log("===============================================================")*/

				/*let candidate = await getRepository(Candidate)
					.createQueryBuilder("candidate")
					.where("candidate.poll = :poll_p", { poll_p: poll })
					.andWhere("candidate.message_id = :message_id_p", { message_id_p: messages_ids[i + 1] })
					.getOne()
				console.log(candidate)
				console.log(messages_ids)
				let candidate2 = await getRepository(Candidate)
					.createQueryBuilder("candidate")
					.where("candidate.poll = :poll_p", { poll_p: poll })
					.getOne()
				console.log("Hé", candidate2)
				let candidate3 = await getRepository(Candidate)
					.createQueryBuilder("candidate")
					.where("candidate.message_id = :message_id_p", { message_id_p: messages_ids[i + 1] })
					.getOne()
				console.log("Ho", candidate3, candidate3.poll)
				let candidatesu = await getRepository(Candidate)
					.createQueryBuilder("candidate")
					.getMany()
				console.log(candidatesu, poll, messages_ids[i + 1])
				console.log(candidate.poll)*/
			}
			
			//console.log("Salut")
			//await poll.launch(candidates, client)
			//console.log("Salut")
			//await getConnection().manager.save(poll)
			//console.log("Salut")
			//next_poll_id++
		} catch (error) {
			switch (error) {
				case Command_Error.empty_line: {
					message_author.send("Erreur. La commande est incorrecte : une ligne vide a été fournie (candidat vide)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.empty_line: {
					message_author.send("Erreur. La commande est incorrecte : une ligne vide a été fournie (candidat vide)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.unclosed_quotation_mark: {
					message_author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (guillemet non fermé)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.no_space_or_line_break_after_quotation_mark: {
					message_author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (caractère autre qu'une espace ou un saut de ligne après un guillemet fermant)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.not_enough_elements_in_first_line: {
					//return "Command is uncomplete: first line does not match the syntax."
					message_author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir au moins 2 : l'élément \"n\" et le titre du vote)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.too_many_elements_in_first_line: {
					//return "Command is uncomplete: first line does not match the syntax."
					message_author.send("Erreur. La commande est incorrecte : la première ligne contient trop d'éléments (il ne peut y en avoir au maximum que 3 : l'élément \"n\", le titre du vote et la date prévue de fin)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.first_character_not_n: {
					//return "Command is uncomplete: first line does not match the syntax."
					message_author.send("Erreur. La commande est incorrecte : le premier élément doit être l'élément \"n\"." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.already_poll_in_channel_having_title: {
					//return "Command is uncomplete: first line does not match the syntax."
					message_author.send("Erreur. La commande est incorrecte : un vote possédant ce titre est déjà présent dans ce salon." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.not_enough_lines: {
					//return "Command is uncomplete: lines are missing (no candidates given)."
					message_author.send("Erreur. La commande est incomplète : elle doit faire minimum 2 lignes (aucun candidat n'a été fourni)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} default: {
					console.log("I exist.t")
					throw error
				}
			}
		}

		//let start = new Start()
		//start.construction(string_to_hash(message.author.id), message.channel.id))
		//start.bot = this
		//await getConnection().manager.save(start)
		//await start.save()
		//that.starts.push()

		let triggers = await getRepository(Trigger)
			.createQueryBuilder("trigger")
			.where("channel_id = :channel_id_p", { channel_id_p: message_channel_id })
			.getMany()
		for (let trigger of triggers) {
			if (await bcrypt.compare(message.author.id, trigger.author_hash_id)) {
				await trigger.remove()
			}
		}

		/*try {
			//console.log("Hello")
			await getRepository(Start)
				.createQueryBuilder("start")
				.where("start.author_hash_id = :author_hash_id_p", { author_hash_id_p: string_to_hash(message_author.id) })
				.andWhere("start.channel_id = :channel_id_p", { channel_id_p: message_channel_id })
				.getOneOrFail()
				//console.log("there")
		} catch (error) { // No start*/
			//console.log("Snif")
		/*	await getConnection()
			.createQueryBuilder()
			.insert()
			.into(Start)
			.values({
				author_hash_id: string_to_hash(message_author.id),
				channel_id: message_channel_id
			})
			.execute()

			//return Query_Result.succeeded_create
		}*/
		return Query_Result.succeeded_create
		//return Query_Result.found
	}
}

let get_poll_from_channel_title = async function(message_channel_id: string, title: string): Promise<Poll> {
	let poll: Poll
	try {
		poll = await getRepository(Poll)
		.createQueryBuilder("poll")
		.where("poll.channel_id = :channel_id_p", { channel_id_p: message_channel_id })
		.andWhere("poll.title = :poll_title_p", { poll_title_p: title})
		.getOneOrFail()
	} catch (error) {
		//console.log("Error occured finding poll")
		throw Command_Error.title_not_found
	}
	return poll
}

let syntax_stop_reminder = function(message_content: string): string {
	return "\nExemple d'utilisation  :\n\`\`\`!as \"Vote lambda\"\`\`\`"
	+ "\nVotre commande qui a échoué :\n\`\`\`\n" + message_content + "\`\`\`"
}

let syntax_results_reminder = function(message_content: string): string {
	return "\nExemple d'utilisation  :\n\`\`\`!ar \"Vote lambda\"\`\`\`"
	+ "\nVotre commande qui a échoué :\n\`\`\`\n" + message_content + "\`\`\`"
}

let delete_poll = async function(client: Client, poll: Poll): Promise<Query_Result> {
	if (!poll.close_poll(client)) {
		//return "Poll did not close properly."
		throw Query_Result.poll_not_close_properly
	}

	/*if (result === -1) {
		return "nmon"
	}
	let polls = await Poll.find()
	let poll = polls[result]

	if (!poll.close_poll()) {
		return "Poll did not close properly."
	}*/

	//console.log("EEE", await Vote.find())
	let votes_to_delete_ids = await getRepository(Vote)
		.createQueryBuilder("vote")
		.leftJoinAndSelect("vote.elector", "elector")
		.leftJoinAndSelect("elector.poll", "poll")
		.select("vote.id")
		/*.delete()
		.from(Vote)*/
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.getRawMany()
		/*.execute()*/
	//console.log(votes_to_delete_ids)
	for (let raw_vote of votes_to_delete_ids) {
		await getConnection()
			.createQueryBuilder()
			.delete()
			.from(Vote)
			.where("id = :id_p", { id_p: raw_vote.vote_id })
			.execute()
	}
	/*let candidates_td = await getRepository(Candidate)
		.createQueryBuilder("candidate")
		.leftJoinAndSelect("candidate.poll", "poll")
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id})
		.getMany()
	let raw = Array<string>()
	for (let c of candidates_td) {
		raw.push(c.message_id)
	}
	//console.log(raw)
	await getConnection()
		.createQueryBuilder()
		.delete()
		.from(Vote)
		.where("candidate.message_id IN (:...candidates_messages_ids_p)", { candidates_messages_ids_p: raw })
		.execute()*/
	//console.log(await Vote.find())

	//console.log(await Candidate.find())
	await getConnection()
		.createQueryBuilder()
		.delete()
		.from(Candidate)
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.execute()
	//console.log(await Candidate.find())

	//console.log(await Elector.find())
	await getConnection()
		.createQueryBuilder()
		.delete()
		.from(Elector)
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.execute()
	//console.log(await Elector.find())

	//console.log(await Poll.find())
	await getConnection()
		.createQueryBuilder()
		.delete()
		.from(Poll)
		//.where("channel_id = :channel_id_p", { channel_id_p: message_channel_id })
		.where("id = :id_p", { id_p: poll.id })
		.execute()
	//console.log(await Poll.find())

	return Query_Result.succeeded_create
}

let try_command_vote_action = async function(client: Client, message: Message, start_found: Query_Result): Promise<Query_Result> {
	if (start_found !== Query_Result.found/* && start_found !== Query_Result.succeeded_create*/) {
		return Query_Result.not_a_command
	}

	let message_content = message.content
	let message_channel_id = message.channel.id
	let message_author = message.author

	// From here: if poll launched
	try {
		let command = cut_command(message_content)
		//if (message.content[0] === "!as") { /*arrêter vote*/
		if (command[0] === "!as") { /*arrêter vote*/
			/*if (command.length > 2) {
				return Query_Result.failed_create
			}*/
			if (command.length < 2) throw Command_Error.not_enough_elements_in_first_line
			if (command.length > 2) throw Command_Error.too_many_elements_in_first_line

			//message.delete()

			//let result = await find_poll_from_channel(message.channel.id)
			let poll = await get_poll_from_channel_title(message_channel_id, command[1])
			/*let poll: Poll
			try {
				poll = await getRepository(Poll)
					.createQueryBuilder("poll")
					.where("poll.channel_id = :channel_id_p", { channel_id_p: message_channel_id })
					.andWhere("poll.title = :poll_title_p", { poll_title_p: command[1]})
					.getOneOrFail()
			} catch (error) {
					console.log("Error occured finding poll")
			}*/

			await delete_poll(client, poll)

			/*polls.splice(result)*/

			//that.triggers.splice(triggered[1])
			//that.starts.splice(started[1])

			/*await getConnection()
				.createQueryBuilder()
				.delete()
				.from(Start)
				.where("author_hash_id = :author_hash_id_p", { author_hash_id_p: string_to_hash(message_author.id) })
				.andWhere("channel_id = :channel_id_p", { channel_id_p: message_channel_id })
				.execute()*/

			return Query_Result.succeeded_create
		}
	} catch (error) {
		switch (error) {
			case Command_Error.unclosed_quotation_mark: {
				message_author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (guillemet non fermé)." + syntax_stop_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.no_space_or_line_break_after_quotation_mark: {
				message_author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (caractère autre qu'une espace ou un saut de ligne après un guillemet fermant)." + syntax_stop_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.not_enough_elements_in_first_line: {
				//return "Command is uncomplete: first line does not match the syntax."
				message_author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir 2 : l'élément \"!as\" et le titre du vote)." + syntax_stop_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.too_many_elements_in_first_line: {
				//return "Command is uncomplete: first line does not match the syntax."
				message_author.send("Erreur. La commande est incorrecte : la première ligne contient trop d'éléments (il ne peut y en avoir que 2 : l'élément \"!as\" et le titre du vote." + syntax_stop_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.title_not_found: {
				message_author.send("Erreur. La commande est incorrecte : aucun vote dans ce salon ne possède le titre fourni." + syntax_results_reminder(message_content))
				return Query_Result.failed_create
			} default: {
				throw error
			}
		}
	}

	//console.log("Got there")

	try {
		let command = cut_command(message_content)

		if (command[0] === "!ar") { /*arrêter et afficher les résultats*/
			if (command.length < 2) throw Command_Error.not_enough_elements_in_first_line
			if (command.length > 2) throw Command_Error.too_many_elements_in_first_line

			//let result = await find_poll_from_channel(message.channel.id)
			let poll = await get_poll_from_channel_title(message_channel_id, command[1])
			/*let poll: Poll
			try {
				poll = await getRepository(Poll)
					.createQueryBuilder("poll")
					.where("poll.channel_id = :channel_id_p", { channel_id_p: message_channel_id })
					.andWhere("poll.title = :poll_title_p", { poll_title_p: command[1]})
					.getOneOrFail()
			} catch (error) {
				console.log("Error occured finding poll")
			}*/

			//message.delete()
			/*if (result === -1) {
				return "nmon"
			}
			let polls = await Poll.find()
			let poll = polls[result]*/

			/*poll.electors.push(new Elector("S", [1, 3, 1, 5, 2, 4, 5, 4, 5, 3, 5]))
			poll.electors.push(new Elector("N", [2, 5, 1, 5, 1, 1, 4, 4, 1, 1, 6]))
			poll.electors.push(new Elector("E", [5, 2, 1, 3, 6, 4, 4, 6, 2, 1, 5]))
			poll.electors.push(new Elector("F", [4, 6, 2, 5, 3, 1, 9, 10, 8, 7, 11]))
			poll.electors.push(new Elector("A", [5, 6, 8, 5, 7, 8, 5, 4, 7, 8, 2]))*/
			let results = await poll.display_results(client)
			/*console.log(results[0])
			console.log(results[1])*/

			// Now close the poll
			try {
				await delete_poll(client, poll)
			} catch (error) {
				switch (error) {
					case Query_Result.poll_not_close_properly: {
						return Query_Result.poll_not_close_properly
					} default: {
						throw error
					}
				}
			}

			return Query_Result.succeeded_create
		}
	} catch (error) {
		switch (error) {
			case Command_Error.unclosed_quotation_mark: {
				message_author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (guillemet non fermé)." + syntax_results_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.no_space_or_line_break_after_quotation_mark: {
				message_author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (caractère autre qu'une espace ou un saut de ligne après un guillemet fermant)." + syntax_results_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.not_enough_elements_in_first_line: {
				//return "Command is uncomplete: first line does not match the syntax."
				message_author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir 2 : l'élément \"!ar\" et le titre du vote)." + syntax_results_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.too_many_elements_in_first_line: {
				//return "Command is uncomplete: first line does not match the syntax."
				message_author.send("Erreur. La commande est incorrecte : la première ligne contient trop d'éléments (il ne peut y en avoir que 2 : l'élément \"!ar\" et le titre du vote." + syntax_results_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.title_not_found: {
				message_author.send("Erreur. La commande est incorrecte : aucun vote dans ce salon ne possède le titre fourni." + syntax_results_reminder(message_content))
				return Query_Result.failed_create
			} default: {
				throw error
			}
		}
	}

	return Query_Result.not_a_command
}

/*let find_poll_and_candidate_from_vote = async function(message_id: string): Promise<number[]> {
	let polls = await Poll.find()
	for (let i = 0; i < polls.length; i++) {
		for (let j = 0; j < polls[i].poll_messages_ids.length; j++) {
			if (message_id === polls[i].poll_messages_ids[j].id) {
				return [i, j]
			}
		}
	}
	return [-1]
}*/

export enum Elector_Status {
	uncomplete,
	complete
}

/*let elector_registred = function(uncomplete_electors: Array<Uncomplete_Elector>, user_id: string) {
	for (let i = 0; i < uncomplete_electors.length; i++) {
		if (uncomplete_electors[i].hash_id === string_to_hash(user_id)) {
			return i
		}
	}
	return false
}*/

let emoji_to_vote = new Map<string, number>([
	["1%E2%83%A3", 1], // 1
	["2%E2%83%A3", 2], // 2
	["3%E2%83%A3", 3], // 3
	["4%E2%83%A3", 4], // 4
	["5%E2%83%A3", 5], // 5
	["6%E2%83%A3", 6], // 6
	["7%E2%83%A3", 7], // 7
	["8%E2%83%A3", 8], // 8
	["9%E2%83%A3", 9], // 9
	["%F0%9F%87%A6", 10], // A
	["%F0%9F%87%A7", 11], // B
	["%F0%9F%87%A8", 12], // C
	["%F0%9F%87%A9", 13], // D
	["%F0%9F%87%AA", 14], // E
	["%F0%9F%87%AB", 15], // F
	["%F0%9F%87%AC", 16], // G
	["%F0%9F%87%AD", 17], // H
	["%F0%9F%87%AE", 18], // I
	["%F0%9F%87%AF", 19], // J
	["%F0%9F%87%B0", 20], // K
	["%F0%9F%87%B1", 21], // L
	["%F0%9F%87%B2", 22], // M
	["%F0%9F%87%B3", 23], // N
	["%F0%9F%87%B4", 24], // O
	["%F0%9F%87%B5", 25], // P
	["%F0%9F%87%B6", 26], // Q
	["%F0%9F%87%B7", 27], // R
	["%F0%9F%87%B8", 28], // S
	["%F0%9F%87%B9", 29], // T
	["%F0%9F%87%BA", 30], // U
	["%F0%9F%87%BB", 31], // V
	["%F0%9F%87%BC", 32], // W
	["%F0%9F%87%BD", 33], // X
	["%F0%9F%87%BE", 34], // Y
	["%F0%9F%87%BF", 35], // Z
])

export let emoji_identifiers = Array.from(emoji_to_vote.keys())

/*let vote_complete = function(votes: Array<Vote>, candidates_count: number): boolean {
	if (votes.length === candidates_count) {
		return true
	}
	else {
		return false
	}
	/*for (let i = 0 ; i < votes.length; i++) {
		if (votes[i] === 0) {
			return false
		}
	}
	return true*/
/*}*/

/*let quick_sort = function(array: number[]) {
	if (array.length === 1 || array.length === 0) {
		return array
	}

	let left: number[] = []
	let center = array[0]
	let right: number[] = []

	for (let i = 1; i < array.length; i++) {
		if (array[i] < center) {
			left.push(array[i])
		} else {
			right.push(array[i])
		}
	}

	return quick_sort(left).concat([center], quick_sort(right))
}*/

export let try_set_vote = async function(reaction: MessageReaction, user: User, client: Client): Promise<void> {
	let message = reaction.message
	let message_id = message.id
	let emoji_identifier = reaction.emoji.identifier
	//console.log(emoji_identifier)

	/*let result = await find_poll_and_candidate_from_vote(message_id)
	if (result[0] === -1) {
		return
	}
	let poll_index = result[0]
	let polls = await Poll.find()
	let poll = polls[poll_index]*/

	let candidate: Candidate
	try {
		candidate = await getRepository(Candidate)
			.createQueryBuilder("candidate")
			.leftJoinAndSelect("candidate.poll", "poll")
			.where("candidate.message_id = :message_id_p", { message_id_p: message_id })
			.getOneOrFail()
	} catch (error) {
		return
	}
	/*let message_id_i: Message_Id
	try {
		message_id_i = await getRepository(Message_Id)
			.createQueryBuilder("message_id")
			.where("message_id.message_id = :message_id_p", { message_id_p: message_id })
			.getOneOrFail()
	} catch (error) {
		return
	}*/

	//let poll = candidate.poll
	//console.log(candidate, await Poll.find({ relations: ["candidates"] }))
	/*let poll: Poll
	try {
		poll = await getRepository(Poll)
			.createQueryBuilder("poll")
			.leftJoinAndSelect("poll.candidates", "candidate")
			.where("candidate = :candidate_p", { candidate_p: candidate })
			.getOneOrFail()
	} catch (error) {
		console.log("Everything was here")
		return
	}*/
	let poll = candidate.poll
	//console.log("IT WORKS", candidate, poll)
	//let poll = message_id_i.poll
	
	reaction.users.remove(user)

	//let candidate_index = result[1]

	let elector: Elector
	try {
		/*console.log(await Elector.find({ relations: ["poll"] }))
		console.log(await Poll.find({ relations: ["electors"] }))
		console.log("Repère")
		console.log(string_to_hash(user.id), 1)*/
		/*let electori = await getRepository(Elector)
			.createQueryBuilder("elector")
			//.leftJoinAndSelect("elector.poll", "poll")
			//.where("poll.id: poll_id_p", { poll_id_p: poll.id })
			////.where("elector.hash_id: hash_id_p", { hash_id_p: string_to_hash(user.id) })
			////.where("elector.hash_id: hash_id_p", { hash_id_p: 1 })
			.getOne()
		console.log("electori", electori)
		console.log("Allô ?")
		let electoru = await getRepository(Elector)
			.createQueryBuilder("elector")
			//.leftJoinAndSelect("elector.poll", "poll")
			//.where("poll.id: poll_id_p", { poll_id_p: poll.id })
			////.where("elector.hash_id: hash_id_p", { hash_id_p: string_to_hash(user.id) })
			.where("elector.hash_id: hash_id_p", { hash_id_p: 1 })
			.getOne()
		console.log("electoru", electoru)
		console.log("Mushi ?")*/
		/*elector = await getRepository(Elector)
			.createQueryBuilder("elector")
			.leftJoinAndSelect("elector.poll", "poll")
			//.where("poll.id: poll_id_p", { poll_id_p: poll.id })
			////.where("elector.hash_id: hash_id_p", { hash_id_p: string_to_hash(user.id) })
			.where("elector.hash_id: hash_id_p", { hash_id_p: string_to_hash(user.id) })
			.andWhere("poll.id: poll_id_p", { poll_id_p: poll.id })
			.getOneOrFail()*/
		let electors = await getRepository(Elector)
			.createQueryBuilder("elector")
			.leftJoinAndSelect("elector.poll", "poll")
			// .where("elector.hash_id = :hash_id_p", { hash_id_p: string_to_hash(user.id) })
			.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
			.getMany()
		for (let elector_p of electors) {
			if (await bcrypt.compare(user.id, elector_p.hash_id) === true) {
				elector = elector_p
				throw Query_Result.found
			}
		}
		throw Query_Result.not_found
	}
	catch (error) {
		if (error === Query_Result.not_found) {
			try {
				//console.log("I was there")
				//console.log(await Elector.find({ relations: ["poll"] }))
				//console.log(poll)
				const saltRounds = 10
				let i = (await getConnection()
						.createQueryBuilder()
						.insert()
						.into(Elector)
						.values({
							hash_id: await bcrypt.hash(user.id, saltRounds),
							///hash_id: 1,
							complete: Elector_Status.uncomplete,
							poll: poll
						})
						.execute()).identifiers
				//console.log(i)
				elector = await getRepository(Elector)
					.createQueryBuilder("elector")
					.leftJoinAndSelect("elector.poll", "poll")
					.where("elector.id = :elector_id_p", { elector_id_p: i[0].id })
					.getOneOrFail()
			} catch (error) {
				throw Insert_Error.elector_insertion_failed
				//console.log("Impossible 3")
			}
		}
	}
	// } else {
	// 	elector = result
	// }
	// console.log(elector)
	// } catch (error) {
	// 	///console.log("°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°")
	// 	// try {
	// 	// 	//console.log("I was there")
	// 	// 	//console.log(await Elector.find({ relations: ["poll"] }))
	// 	// 	//console.log(poll)
	// 	// 	let i = (await getConnection()
	// 	// 			.createQueryBuilder()
	// 	// 			.insert()
	// 	// 			.into(Elector)
	// 	// 			.values({
	// 	// 				hash_id: string_to_hash(user.id),
	// 	// 				///hash_id: 1,
	// 	// 				complete: Elector_Status.uncomplete,
	// 	// 				poll: poll
	// 	// 			})
	// 	// 			.execute()).identifiers
	// 	// 	//console.log(i)
	// 	// 	elector = await getRepository(Elector)
	// 	// 		.createQueryBuilder("elector")
	// 	// 		.leftJoinAndSelect("elector.poll", "poll")
	// 	// 		.where("elector.id = :elector_id_p", { elector_id_p: i[0].id })
	// 	// 		.getOneOrFail()
	// 	// } catch (error) {
	// 	// 	throw Insert_Error.elector_insertion_failed
	// 	// 	//console.log("Impossible 3")
	// 	// }
	// 	/*elector.poll = poll
	// 	await getConnection().manager.save(elector)*/
	// 	/*elector = new Elector(string_to_hash(user.id), Elector_Status.uncomplete)
	// 	elector.poll = poll
	// 	await getConnection().manager.save(elector)*/
	// }
	///console.log(elector)

	//let elector_index = elector_registred(poll, user.id)
	////let elector: Uncomplete_Elector | Complete_Elector
	/*let result_uncomplete = elector_registred(poll.uncomplete_electors, user.id)
	let result_complete = elector_registred(poll.complete_electors, user.id)
	if (result_complete !== false) {
		elector = poll.complete_electors[result_complete]
	} else if (result_uncomplete !== false) {
		elector = poll.uncomplete_electors[result_uncomplete]
	} else {
		elector = new Uncomplete_Elector(string_to_hash(user.id), false) //new Array<number>(poll.poll_messages_ids.length).fill(0))
		elector.poll = poll
		await elector.save()
		//poll.uncomplete_electors.push(elector)
	}
	/*let elector = poll.electors[elector_index]
	if (elector_index === poll.electors.length) {
		poll.electors.push(new Elector(user.id, new Array<number>(poll.poll_messages_ids.length).fill(0)))
	}*/

	////let vote_already_given = false
	///let candidate = message_id_i.candidate
	let candidate_rank = emoji_to_vote.get((emoji_identifier))
	//let vote: Vote
	try {
		let votes = await getRepository(Vote)
			.createQueryBuilder("vote")
			// .leftJoinAndSelect("vote.elector", "elector", "elector = :elector_p", { elector_p: elector })
			.leftJoinAndSelect("vote.candidate", "candidate")
			.where("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: candidate.message_id })
			.getMany()
		// console.log(votes)
		if (votes.length === 0) {
			throw Query_Result.not_found
		}
		else {
			let vote_id = votes[0].id
			await getConnection()
				.createQueryBuilder()
				.update(Vote)
				.set({ candidate_rank: candidate_rank })
				.where("vote.id = :vote_id_p", { vote_id_p: vote_id })
				.execute()
		}
			// .update(Vote)
			// .set({ candidate_rank: candidate_rank })
			// .execute()
		//vote.candidate_rank = candidate_rank
		// let vote = await getRepository(Vote)
		// 	.createQueryBuilder("vote")
		// 	.leftJoinAndSelect("vote.elector", "elector")
		// 	.leftJoinAndSelect("vote.candidate", "candidate")
		// 	.where("elector.hash_id = :elector_hash_id_p", { elector_hash_id_p: elector.hash_id })
		// 	.andWhere("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: candidate.message_id })
		// 	.getOneOrFail()
		// // Vote found: update it
		// vote.candidate_rank = candidate_rank
		// await vote.save()

		// let votes = await getRepository(Vote)
		// 	.createQueryBuilder("vote")
		// 	.leftJoinAndSelect("vote.candidate", "candidate")
		// 	.where("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: candidate.message_id })
		// 	.leftJoinAndSelect("vote.elector", "elector")
		// 	.where("elector.id = :elector_id_p", { elector_id_p: elector.id })
		// 	// .where("elector.hash_id = :hash_id_p", { hash_id_p: string_to_hash(user.id) })
		// 	.getMany()
		// console.log(await Vote.find())
		// console.log(votes)
		// throw Query_Result.not_found
	} catch (error) { // No vote found : create it
		// console.log(error)
		await getConnection()
			.createQueryBuilder()
			.insert()
			.into(Vote)
			.values({
				candidate_rank: candidate_rank,
				elector: elector,
				candidate: candidate
			})
			.execute()
		/*let vote: Vote
		try {
			/*let id_o = (await getConnection()
				.createQueryBuilder()
				.insert()
				.into(Vote)
				.values({
					candidate_rank: candidate_rank
				})
				.execute()).generatedMaps[0]
			console.log("ooooo", id_o.id)
			let votesss = await Vote.find()
			console.log("yy", votesss)
			console.log(votesss[0])*/
		/*	vote = await getRepository(Vote)
				.createQueryBuilder("vote")
				.where("vote.id = :vote_id_p", { vote_id_p: (await getConnection()
					.createQueryBuilder()
					.insert()
					.into(Vote)
					.values({
						candidate_rank: candidate_rank
					})
					.execute()).identifiers[0].id })
				.getOneOrFail()
		} catch (error) {
			console.log("Impossible")
		}
		vote.elector = elector
		vote.candidate = candidate
		await getConnection().manager.save(vote)
		///console.log("ICICIICICI :", vote)
		///console.log(vote.candidate)
		///console.log(vote.elector)
		/*vote = new Vote(candidate_rank)
		vote.elector = elector
		vote.candidate = candidate*/
	}
	// console.log(await Vote.find({ relations: ["candidate"]}))
	//await getConnection().manager.save(vote)
	
	/*vote_already_given = true
	let candidate_rank = emoji_to_vote.get((emoji_identifier))
	if (vote_already_given) {
		vote.candidate_rank = candidate_rank
	} else {
		vote = new Vote(candidate_index, candidate_rank)
		vote.elector = elector
	}
	await vote.save()*/

	//votes[candidate_index] = vote

	///console.log(await Vote.find({ relations: ["elector"] }))
	//console.log(elector.poll)
	let elector_votes: Array<Vote>
	try {
		elector_votes = await getRepository(Vote)
			.createQueryBuilder("vote")
			.leftJoinAndSelect("vote.elector", "elector")
			.leftJoinAndSelect("vote.candidate", "candidate")
			.where("elector.id = :elector_id_p", { elector_id_p: elector.id })
			.getMany()
	} catch (error) {
		console.log("Snif 2")
	}
	//console.log(elector.poll)
	// console.log(elector_votes, poll.candidates_count)
	////let votes: Array<Vote>
	///console.log(await Elector.find({ relations: ["poll"] }))
	/*let electors: Array<Elector>
	try {
		electors = await getRepository(Elector)
			.createQueryBuilder("elector")
			.leftJoinAndSelect("elector.poll", "poll")
			.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
			//.andWhere("elector.hash_id = :elector_hash_id_p", { elector_hash_id_p: -1228113569 })
			.getMany()
		/*electors = await createQueryBuilder("elector")
			.leftJoinAndSelect(Poll, "poll", "poll.electorHash_id = :elector_hash_id_p", { elector_hash_id_p: string_to_hash(user.id) })
			.getMany()*/
	/*} catch (error) {
		console.log("Snif")
	}*/
	///console.log(electors, poll.candidates_count)
	//let electorss = Array<Elector>()
	//let vote_complete = (electorss.length === poll.candidates_count)
	let vote_complete = (elector_votes.length === poll.candidates_count)
	if (vote_complete) {
		/*if (!(elector.id in poll.electors_ids_having_voted)) {
			poll.electors_ids_having_voted.push(elector.id)
		}*/
		// console.log("C'est fini")

		if (elector.complete === Elector_Status.uncomplete) {
			//elector.complete = Elector_Status.complete
			try {
				await getConnection()
					.createQueryBuilder()
					.update(Elector)
					.set({ complete: Elector_Status.complete })
					.where("id = :id_p", { id_p: elector.id })
					.execute()
			} catch (error) {
				console.log(error)
			}
			///console.log(elector)
		}

		/*if (result_uncomplete !== false) {
			await getRepository(Elector)
			.createQueryBuilder("elector")
			.delete()
			.where()
			poll.uncomplete_electors.splice(result_uncomplete)
			poll.complete_electors.push(elector)
		}*/

		/*let votes_sorted = quick_sort(votes)
		//console.log(votes_sorted)
		let votes_used = new Array<boolean>(votes.length).fill(true)
		let candidates_sorted: string[] = []
		for (let i = 0; i < votes_sorted.length; i++) {
			for (let j = 0; j < votes_used.length; j++) {
				//console.log(i, j, votes_used, votes, votes_sorted, candidates_sorted, poll.candidates)
				if (votes_sorted[i] === votes[j] && votes_used[j]) {
					candidates_sorted.push(poll.candidates[j])
					votes_used[j] = false
					//console.log("Ok")
					break
				}
			}
		}*/
		let elector_votes_sorted = elector_votes.sort((a, b) => a.candidate_rank - b.candidate_rank)
		//console.log(elector_votes)
		//console.log(elector_votes_sorted)
		/*console.log(candidates_sorted)
		console.log(votes_sorted)*/

		let vote_complete_private_message = "=== **" + poll.title + "** ===\nVotre vote a bien été pris en compte. Voici un récapitulatif :"
		let vote_candidates: Array<Candidate>
		try {
			vote_candidates = await getRepository(Candidate)
				.createQueryBuilder("candidate")
				.leftJoinAndSelect("candidate.poll", "poll")
				.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
				.getMany()
		} catch (error) {
			console.log("Snif 3")
		}
		//console.log(vote_candidates)
		for (let i = 0; i < elector_votes_sorted.length; i++) {
			/*console.log(elector_votes_sorted[i])
			console.log(elector_votes_sorted[i].candidate)
			console.log(elector_votes_sorted[i].candidate.name)*/
			/*let vote_candidate
			try {
				vote_candidate = await getRepository(Candidate)
					.createQueryBuilder("candidate")
					///.leftJoinAndSelect("candidate.poll", "poll")
					.leftJoinAndSelect("candidate.votes", "vote")
					///.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
					./*andW*//*where("vote.id = :vote_id_p", { vote_id_p: elector_votes_sorted[i].id })
					.getOneOrFail()
			} catch (error) {
				console.log("Snif")
			}*/
			///vote_complete_private_message += "\n" + elector_votes_sorted[i].candidate_rank + " : "/* + "`"*/  + elector_votes_sorted[i].candidate.name/* + "`"*/
			////vote_complete_private_message += "\n" + elector_votes_sorted[i].candidate_rank + " : "/* + "`"*/  + vote_candidates[i].name/* + "`"*/
			vote_complete_private_message += "\n" + elector_votes_sorted[i].candidate_rank + " : "/* + "`"*/  + elector_votes_sorted[i].candidate.name/* + "`"*/
		}
		user.send(vote_complete_private_message)
		poll.update_introduction_message(client)
	}
}