import { Client, Message, TextChannel, User, MessageReaction } from 'discord.js'
import { getConnection, getRepository } from "typeorm"
import { Poll_State,launch_poll, Poll } from "./Poll"
import { Trigger } from "./Trigger"
import { Elector } from './Elector'
import { Vote } from './Vote'
import { Candidate } from "./Candidate"
import * as bcrypt from "bcrypt"

export class Bot {
	// private client: Client
	public client: Client
	private self_respond_counter: number

	constructor () {
		this.client = new Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGES"], partials: ["REACTION", "USER", "MESSAGE", "CHANNEL"] })
		this.self_respond_counter = 0

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

			let trigger_found = await try_command_trigger(message)
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
			// console.log("Fin", await Trigger.find())
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

export let try_democratie_amour = async function(message: Message): Promise<boolean> {
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

let syntax_start_reminder = function(message_content: string): string {
	return "\nExemple d'utilisation (la date est optionnelle) :\n\`\`\`n \"Vote lambda\" \"Vendredi 24 décembre 2021, 12 h 34 m 56 s\"\nCandidat A\nCandidat B\nCandidat C\`\`\`"
	+ "\nVotre commande qui a échoué :\n\`\`\`\n" + message_content + "\`\`\`"
	+ "\nPour arrêter de tenter de lancer un vote :\n\`\`\`\n!ac\`\`\`"
}

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

let try_command_trigger = async function(message: Message): Promise<Query_Result> {
	if (await look_for_trigger(message.channel.id, message.author.id) === Query_Result.found) {
		return Query_Result.found
	} else { // No trigger found
		if (message.content !== "!cc") { /*!commencer Concorde*/
			return Query_Result.not_a_command
		}

		// Delete every potential trigger for every other channel
		let triggers = await getRepository(Trigger)
			.createQueryBuilder("trigger")
			.getMany()
		for (let trigger of triggers) {
			if (await bcrypt.compare(message.author.id, trigger.author_hash_id)) {
				await trigger.remove()
			}
		}

		// Now the trigger is on the current channel
		try {
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
		} catch (error) {
			return Query_Result.failed_create
		}

		return Query_Result.succeeded_create
	}
}

export let try_command_start = async function(client: Client, message: Message, trigger_found: Query_Result) : Promise<Query_Result> {
	if (trigger_found !== Query_Result.found) {
		try {
			await getRepository(Poll)
				.createQueryBuilder("poll")
				.where("poll.channel_id = :poll_channel_id_p", { poll_channel_id_p: message.channelId })
				.getOneOrFail()
		} catch (error) {
			return Query_Result.not_a_command
		}
		return Query_Result.found
	} else {
		let message_content = message.content
		let message_author = message.author
		let message_channel_id = message.channel.id

		if (message_content === "!ac") { /*!arrêter Concorde*/
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
			}

			for (let i = 0; i < candidates.length; i++) {				
				let candidate: Candidate
				try {
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
				}
				await getConnection().manager.save(candidate)
			}
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
					message_author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir au moins 2 : l'élément \"n\" et le titre du vote)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.too_many_elements_in_first_line: {
					message_author.send("Erreur. La commande est incorrecte : la première ligne contient trop d'éléments (il ne peut y en avoir au maximum que 3 : l'élément \"n\", le titre du vote et la date prévue de fin)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.first_character_not_n: {
					message_author.send("Erreur. La commande est incorrecte : le premier élément doit être l'élément \"n\"." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.already_poll_in_channel_having_title: {
					message_author.send("Erreur. La commande est incorrecte : un vote possédant ce titre est déjà présent dans ce salon." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} case Command_Error.not_enough_lines: {
					message_author.send("Erreur. La commande est incomplète : elle doit faire minimum 2 lignes (aucun candidat n'a été fourni)." + syntax_start_reminder(message_content))
					return Query_Result.failed_create
				} default: {
					console.log("I exist.t")
					throw error
				}
			}
		}

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
		throw Query_Result.poll_not_close_properly
	}

	let votes_to_delete_ids = await getRepository(Vote)
		.createQueryBuilder("vote")
		.leftJoinAndSelect("vote.elector", "elector")
		.leftJoinAndSelect("elector.poll", "poll")
		.select("vote.id")
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.getRawMany()
	for (let raw_vote of votes_to_delete_ids) {
		await getConnection()
			.createQueryBuilder()
			.delete()
			.from(Vote)
			.where("id = :id_p", { id_p: raw_vote.vote_id })
			.execute()
	}
	await getConnection()
		.createQueryBuilder()
		.delete()
		.from(Candidate)
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.execute()

	await getConnection()
		.createQueryBuilder()
		.delete()
		.from(Elector)
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.execute()

	await getConnection()
		.createQueryBuilder()
		.delete()
		.from(Poll)
		.where("id = :id_p", { id_p: poll.id })
		.execute()

	return Query_Result.succeeded_create
}

let try_command_vote_action = async function(client: Client, message: Message, start_found: Query_Result): Promise<Query_Result> {
	if (start_found !== Query_Result.found) {
		return Query_Result.not_a_command
	}

	let message_content = message.content
	let message_channel_id = message.channel.id
	let message_author = message.author

	// From here: if poll launched
	try {
		let command = cut_command(message_content)
		if (command[0] === "!as") { /*arrêter scrutin*/
			if (command.length < 2) throw Command_Error.not_enough_elements_in_first_line
			if (command.length > 2) throw Command_Error.too_many_elements_in_first_line

			let poll = await get_poll_from_channel_title(message_channel_id, command[1])

			await delete_poll(client, poll)

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
				message_author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir 2 : l'élément \"!as\" et le titre du vote)." + syntax_stop_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.too_many_elements_in_first_line: {
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

	try {
		let command = cut_command(message_content)

		if (command[0] === "!ar") { /*arrêter et afficher les résultats*/
			if (command.length < 2) throw Command_Error.not_enough_elements_in_first_line
			if (command.length > 2) throw Command_Error.too_many_elements_in_first_line

			let poll = await get_poll_from_channel_title(message_channel_id, command[1])

			let results = await poll.display_results(client)

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
				message_author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir 2 : l'élément \"!ar\" et le titre du vote)." + syntax_results_reminder(message_content))
				return Query_Result.failed_create
			} case Command_Error.too_many_elements_in_first_line: {
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

export enum Elector_Status {
	uncomplete,
	complete
}

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

export let try_set_vote = async function(reaction: MessageReaction, user: User, client: Client): Promise<void> {
	let message = reaction.message
	let message_id = message.id
	let emoji_identifier = reaction.emoji.identifier

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

	let poll = candidate.poll
	
	reaction.users.remove(user)

	let elector: Elector
	try {
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
				elector = await getRepository(Elector)
					.createQueryBuilder("elector")
					.leftJoinAndSelect("elector.poll", "poll")
					.where("elector.id = :elector_id_p", { elector_id_p: i[0].id })
					.getOneOrFail()
			} catch (error) {
				throw Insert_Error.elector_insertion_failed
			}
		}
	}

	let candidate_rank = emoji_to_vote.get((emoji_identifier))

	try {
		let votes = await getRepository(Vote)
			.createQueryBuilder("vote")
			// .leftJoinAndSelect("vote.elector", "elector", "elector = :elector_p", { elector_p: elector })
			.leftJoinAndSelect("vote.candidate", "candidate")
			.where("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: candidate.message_id })
			.getMany()
		if (votes.length === 0) {
			throw Query_Result.not_found
		}
		else {
			let vote_id = votes[0].id
			try {
				await getConnection()
					.createQueryBuilder()
					.update(Vote)
					.set({ candidate_rank: candidate_rank })
					.where("vote.id = :vote_id_p", { vote_id_p: vote_id })
					.execute()
			} catch (error) {
				throw Query_Result.failed_create
			}
		}
	} catch (error) { // No vote found : create it
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
	}

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

	let vote_complete = (elector_votes.length === poll.candidates_count)
	if (vote_complete) {
		if (elector.complete === Elector_Status.uncomplete) {
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
		}

		let elector_votes_sorted = elector_votes.sort((a, b) => a.candidate_rank - b.candidate_rank)

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

		for (let i = 0; i < elector_votes_sorted.length; i++) {
			vote_complete_private_message += "\n" + elector_votes_sorted[i].candidate_rank + " : "/* + "`"*/  + elector_votes_sorted[i].candidate.name/* + "`"*/
		}
		user.send(vote_complete_private_message)
		poll.update_introduction_message(client)
	}
}