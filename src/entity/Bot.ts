import { Client, Message, TextChannel, User, MessageReaction, ReactionUserManager } from 'discord.js'
import { Poll_State,launch_poll, Poll } from "./Poll"
import { Trigger } from "./Trigger"
import { Elector } from './Elector'
import { Vote } from './Vote'
import { Candidate } from "./Candidate"
import * as bcrypt from "bcrypt"
import { AppDataSource } from '../app'

const saltRounds = 10

export class Bot {
	// private client: Client
	public client: Client
	private self_respond_counter: number

	private Nicolas: User
	private discord_crash_message: string

	constructor () {
		this.client = new Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGES"], partials: ["REACTION", "USER", "MESSAGE", "CHANNEL"] })
		this.self_respond_counter = 0

		this.client.on('ready', async () => {
			console.log(`Hé !! Logged in as ${this.client.user.tag}!`)
			this.Nicolas = await this.client.users.fetch('355077745744543744')
			this.discord_crash_message = `Concorde a crashé ! ${this.Nicolas}\n`
		})
		
		this.client.on('messageCreate', async (message: Message) => {
			try {
				if (message.author.id === this.client.user.id) {
					if (this.self_respond_counter === 0) {
						return
					} else {
						this.self_respond_counter--
					}
				}

				// Check fan service messages
				if (await try_democratie_amour(message) === true) {
					return
				}

				// Check Concorde is used on servers only
				if (await try_send_dm_unallowed(message) === true) {
					return
				}

				// Check if the message author is triggering Concorde for creating a poll
				let command_trigger_r = await try_command_trigger(message.content, message.channelId, message.author.id)
				if (command_trigger_r === Concorde_Result.succeeded_create) { // The command has already done everything it is supposed to do
					message.delete()
					return
				}
				// From here, command_trigger_r = Concorde_Result.found || Concorde_Result.not_trigger_command

				// Check if the message author is trying to create a poll, only if an existing trigger has been found
				if (command_trigger_r === Concorde_Result.found) {
					await start_poll(this.client, message.content, message.author.id, message.channelId)
					// The command has already done everything it is supposed to do.
					message.delete()
					return
				}
				// From here, command_trigger_r = Concorde_Result.not_trigger_command

				// Check if the message author is trying to close a poll
				let command_poll_action_r = await try_command_poll_action(this.client, message.content, message.channelId, message.author.id)
				// } catch (error) {
				// 	switch (error) {
				// 		case Concorde_Result.poll_not_close_properly: {
				// 			console.log("Proper poll close failed")
				// 			throw error
				// 		} case Concorde_Result.poll_not_display_properly: {
				// 			console.log("Proper poll display failed")
				// 			throw error
				// 		} case DB_Result.failed_delete: {
				// 			console.log("Failed deleting votes, candidates, electors or poll")
				// 			throw error
				// 		} default: {
				// 			throw error
				// 		}
				// 	}
				// }
				if (command_poll_action_r === Concorde_Result.succeeded_create || command_poll_action_r === Concorde_Result.command_error) {
					// The command has already done everything it is supposed to do
					message.delete()
					return
				}
				// From here, command_poll_action_r = Concorde_Result.not_a_command
			} catch (error) {
				await message.channel.send(this.discord_crash_message)
				throw error
			}
		})

		this.client.on('messageReactionAdd', async (reaction: MessageReaction, user: User) => {
			if (this.client.user.id === user.id) {
				return
			}

			// try {
			await try_set_vote(reaction, user, this.client)
			// } catch (error) {
			// 	switch (error) {
			// 		case DB_Result.failed_update: {
			// 			console.log("Failed updating elector.")
			// 			throw error
			// 		} case DB_Result.failed_insert: {
			// 			console.log("Failed inserting elector.")
			// 			throw error
			// 		} case Concorde_Result.failed_vote: {
			// 			console.log("Failed voting")
			// 			throw error
			// 		} default: {
			// 			throw error
			// 		}
			// 	}
			// }
		})
	}

	async login () {
		await this.client.login(process.env.DISCORD_BOT_TOKEN)
	}

	get_channel = async (channel_id: string) => {
		return await this.client.channels.fetch(channel_id) as TextChannel
	} ////// /!\

	allow_self_respond = (count: number = 1) => {
		this.self_respond_counter = count
	}
}

enum Bcrypt_Result {
	failed_hash = 0,
	failed_compare = 1
}

export enum Concorde_Result {
	failed = 2,
	found = 3,
	not_found = 4,
	failed_create = 5,
	succeeded_create = 6,
	failed_launch_poll = 7,
	failed_vote = 8,
	poll_not_close_properly = 9,
	poll_not_display_properly = 10,
	// not_a_command,
	not_trigger_command = 11,
	not_vote_action_command = 12,
	not_vote = 99,
	command_error = 13
}

enum Discord_Result {
	failed_send = 14
}

enum DB_Result {
	found = 15,
	not_found = 16,
	failed_insert = 17,
	// succeeded_insert,
	failed_update = 18,
	// succeeded_update,
	failed_delete = 19,
	// succeeded_delete,
	failed_select = 20,
	// succeeded_select
}

// enum Insert_Error {
// 	poll_insertion_failed = 10,
// 	candidate_insertion_failed = 11,
// 	elector_insertion_failed = 12
// }

export enum Command_Error {
	empty_line = 21,
	unclosed_quotation_mark = 22,
	no_space_or_line_break_after_quotation_mark = 23,
	not_enough_elements_in_first_line = 24,
	too_many_elements_in_first_line = 25,
	first_character_not_n = 26,
	already_poll_in_channel_having_title = 27,
	not_enough_lines = 28,
	title_not_found = 29,
	channel_not_found = 30
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

export let try_democratie_amour = async function(message: Message): Promise<boolean> {
	if (message.content === `La démocratie à Grignon c'est quoi ?`) {
		await message.channel.send(`La démocratie à Grignon c'est le BDE et c'est que de l'amour, n'est-ce pas ?`)
		return true
	}
	return false
}

let try_send_dm_unallowed = async function(message: Message): Promise<boolean> {
	let type = message.channel.type
	if (type === "DM") {
		await message.author.send("Concorde ne fonctionne que sur les serveurs ! C'est compliqué de faire un vote dans une discussion de message privé...")
		return true
	}
	return false
}

let look_for_trigger = async function(message_channel_id: string, message_author_id: string): Promise<Concorde_Result> {
	let triggers = await AppDataSource.getRepository(Trigger)
		.createQueryBuilder("trigger")
		// .where("trigger.author_hash_id = :author_hash_id_p", { author_hash_id_p: string_to_hash(message.author.id) })
		.where("trigger.channel_id = :channel_id_p", { channel_id_p: message_channel_id })
		.getMany()
	
	for (let trigger of triggers) {
		if (await bcrypt.compare(message_author_id, trigger.author_hash_id)) {
			return Concorde_Result.found
		}
	}

	return Concorde_Result.not_found
}

let try_command_trigger = async function(content: string, channel_id: string, author_id: string): Promise<Concorde_Result> {
	let trigger_found = await look_for_trigger(channel_id, author_id)
	if (trigger_found === Concorde_Result.found) {
		if (content === "!ac") { /*!arrêter Concorde*/
			let triggers = await AppDataSource.getRepository(Trigger)
				.createQueryBuilder("trigger")
				.where("channel_id = :channel_id_p", { channel_id_p: channel_id })
				.getMany()
			for (let trigger of triggers) {
				if (await bcrypt.compare(author_id, trigger.author_hash_id)) {
					await trigger.remove()
				}
			}
			return Concorde_Result.succeeded_create
		} else {
			return Concorde_Result.found
		}
	} else { // No trigger found
		if (content !== "!cc") { /*!commencer Concorde*/
			return Concorde_Result.not_trigger_command
		}

		// Delete every potential trigger for every other channel
		let triggers = await AppDataSource.getRepository(Trigger)
			.createQueryBuilder("trigger")
			.getMany()
		for (let trigger of triggers) {
			if (await bcrypt.compare(author_id, trigger.author_hash_id)) {
				await trigger.remove()
			}
		}

		// Now put the trigger is on the current channel
		await AppDataSource.createQueryBuilder()
			.insert()
			.into(Trigger)
			.values({
				author_hash_id: await bcrypt.hash(author_id, saltRounds),
				channel_id: channel_id
			})
			.execute()

		return Concorde_Result.succeeded_create
	}
}

let syntax_start_reminder = function(message_content: string): string {
	return "\nExemple d'utilisation (la date est optionnelle) :\n\`\`\`n \"Vote lambda\" \"Vendredi 24 décembre 2021, 12 h 34 m 56 s\"\nCandidat A\nCandidat B\nCandidat C\`\`\`"
	+ "\nVotre commande qui a échoué :\n\`\`\`\n" + message_content + "\`\`\`"
	+ "\nPour arrêter de tenter de lancer un vote :\n\`\`\`\n!ac\`\`\`"
}

export let start_poll_back = async function(client: Client, content: string, author_id: string, channel_id: string): Promise<Concorde_Result | Command_Error> {
	// if (trigger_found === Concorde_Result.found) {
	// 	try {
	// 		await getRepository(Poll)
	// 			.createQueryBuilder("poll")
	// 			.where("poll.channel_id = :poll_channel_id_p", { poll_channel_id_p: message.channelId })
	// 			.getOneOrFail()
	// 	} catch (error) {
	// 		return Concorde_Result.not_a_command
	// 	}
	// 	return Concorde_Result.found
	// } else {
	// let message_content = message.content
	// let message_author = message.author
	// let message_channel_id = message.channelId

	try {
		let lines = cut_into_lines(content)

		let first_line = lines[0]

		let first_line_w = cut_command(first_line)
		//console.log(first_line_w)
		if (first_line_w.length < 2) throw Command_Error.not_enough_elements_in_first_line
		if (first_line_w.length > 3) throw Command_Error.too_many_elements_in_first_line
		if (first_line_w[0] !== "n") throw Command_Error.first_character_not_n

		let title = first_line_w[1]
		let polls_in_channel_having_title = await AppDataSource.getRepository(Poll)
			.createQueryBuilder("poll")
			.where("poll.title = :title_p", { title_p: title })
			.andWhere("poll.channel_id = :channel_id_p", { channel_id_p: channel_id })
			.getMany()
		if (polls_in_channel_having_title.length !== 0) throw Command_Error.already_poll_in_channel_having_title

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
		let messages_ids = await launch_poll(title, end_date_given, end_date, channel_id, state, candidates, client)
		let poll = await AppDataSource.getRepository(Poll)
			.createQueryBuilder("poll")
			.where("poll.id = :poll_id_p", { poll_id_p: (await AppDataSource
				.createQueryBuilder()
				.insert()
				.into(Poll)
				.values({
					author_hash_id: await bcrypt.hash(author_id, saltRounds),
					title: title,
					end_date_given: end_date_given,
					end_date: end_date,
					channel_id: channel_id,
					introduction_message_id: messages_ids[0],
					state: state,
					candidates_count: candidates.length
				})
				.execute()).identifiers[0].id })
			.getOneOrFail()

		for (let i = 0; i < candidates.length; i++) {				
			let candidate = await AppDataSource.getRepository(Candidate)
				.createQueryBuilder("candidate")
				.where("candidate.message_id = :message_id_p", { message_id_p: (await AppDataSource
					.createQueryBuilder()
					.insert()
					.into(Candidate)
					.values({
						name: candidates[i],
						message_id: messages_ids[i + 1],
						order: i,
						poll: poll
					})
					.execute()).identifiers[0].message_id })
				.getOneOrFail()
			await AppDataSource.manager.save(candidate)
		}
	} catch (error) {
		switch (error) {
			case Command_Error.empty_line: {
				return error
			} case Command_Error.unclosed_quotation_mark: {
				return error
			} case Command_Error.no_space_or_line_break_after_quotation_mark: {
				return error
			} case Command_Error.not_enough_elements_in_first_line: {
				return error
			} case Command_Error.too_many_elements_in_first_line: {
				return error
			} case Command_Error.first_character_not_n: {
				return error
			} case Command_Error.already_poll_in_channel_having_title: {
				return error
			} case Command_Error.not_enough_lines: {
				return error
			} default: {
				throw error
			}
		}
	}

	let triggers = await AppDataSource.getRepository(Trigger)
		.createQueryBuilder("trigger")
		.where("channel_id = :channel_id_p", { channel_id_p: channel_id })
		.getMany()
	for (let trigger of triggers) {
		if (await bcrypt.compare(author_id, trigger.author_hash_id)) {
			await trigger.remove()
		}
	}
	return Concorde_Result.succeeded_create
}

let start_poll = async function(client: Client, content: string, author_id: string, channel_id: string): Promise<Concorde_Result> {
	let back_result = await start_poll_back(client, content, author_id, channel_id)
	if (back_result !== Concorde_Result.succeeded_create) {
		let author = await client.users.fetch(author_id)
		switch (back_result) {
			case Command_Error.empty_line: {
				author.send("Erreur. La commande est incorrecte : une ligne vide a été fournie (candidat vide)." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.empty_line: {
				author.send("Erreur. La commande est incorrecte : une ligne vide a été fournie (candidat vide)." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.unclosed_quotation_mark: {
				author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (guillemet non fermé)." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.no_space_or_line_break_after_quotation_mark: {
				author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (caractère autre qu'une espace ou un saut de ligne après un guillemet fermant)." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.not_enough_elements_in_first_line: {
				author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir au moins 2 : l'élément \"n\" et le titre du vote)." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.too_many_elements_in_first_line: {
				author.send("Erreur. La commande est incorrecte : la première ligne contient trop d'éléments (il ne peut y en avoir au maximum que 3 : l'élément \"n\", le titre du vote et la date prévue de fin)." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.first_character_not_n: {
				author.send("Erreur. La commande est incorrecte : le premier élément doit être l'élément \"n\"." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.already_poll_in_channel_having_title: {
				author.send("Erreur. La commande est incorrecte : un vote possédant ce titre est déjà présent dans ce salon." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.not_enough_lines: {
				author.send("Erreur. La commande est incomplète : elle doit faire minimum 2 lignes (aucun candidat n'a été fourni)." + syntax_start_reminder(content))
				return Concorde_Result.command_error
			} default: {
				throw -1
			}
		}
	}
}

let get_poll_from_channel_title = async function(channel_id: string, title: string): Promise<Poll> {
	let poll: Poll
	try {
		poll = await AppDataSource.getRepository(Poll)
			.createQueryBuilder("poll")
			.where("poll.channel_id = :channel_id_p", { channel_id_p: channel_id })
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

let delete_poll = async function(client: Client, poll: Poll): Promise<Concorde_Result> {
	poll.close_poll(client)

	let votes_to_delete_ids = await AppDataSource.getRepository(Vote)
		.createQueryBuilder("vote")
		.leftJoinAndSelect("vote.elector", "elector")
		.leftJoinAndSelect("elector.poll", "poll")
		.select("vote.id")
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.getRawMany()
	for (let raw_vote of votes_to_delete_ids) {
		await AppDataSource
			.createQueryBuilder()
			.delete()
			.from(Vote)
			.where("id = :id_p", { id_p: raw_vote.vote_id })
			.execute()
	}

	await AppDataSource.createQueryBuilder()
		.delete()
		.from(Candidate)
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.execute()

	await AppDataSource.createQueryBuilder()
		.delete()
		.from(Elector)
		.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		.execute()

	await AppDataSource.createQueryBuilder()
		.delete()
		.from(Poll)
		.where("id = :id_p", { id_p: poll.id })
		.execute()

	return Concorde_Result.succeeded_create
}

let try_command_poll_action_back = async function(client: Client, content: string, channel_id: string, author_id: string): Promise<Concorde_Result | Command_Error> {
	// if (start_found !== Concorde_Result.found) {
	// 	return Concorde_Result.not_a_command
	// }

	// let message_content = message.content
	// let message_channel_id = message.channelId
	// let message_author = message.author

	try {
		let command = cut_command(content)
		if (command[0] === "!as") { /*arrêter scrutin*/
			if (command.length < 2) throw Command_Error.not_enough_elements_in_first_line
			if (command.length > 2) throw Command_Error.too_many_elements_in_first_line

			let poll = await get_poll_from_channel_title(channel_id, command[1])

			if (!await bcrypt.compare(author_id, poll.author_hash_id)) {
				return
			}

			await delete_poll(client, poll)

			return Concorde_Result.succeeded_create
		}
	} catch (error) {
		switch (error) {
			case Command_Error.unclosed_quotation_mark: {
				return error
			} case Command_Error.no_space_or_line_break_after_quotation_mark: {
				return error
			} case Command_Error.not_enough_elements_in_first_line: {
				return error
			} case Command_Error.too_many_elements_in_first_line: {
				return error
			} case Command_Error.title_not_found: {
				return error
			} default: {
				throw error
			}
		}
		// if (error === Concorde_Result.poll_not_close_properly || error === DB_Result.failed_delete) {
		// 	throw error
		// }
		// // Until there, existence of author id was not checked for the tests.
		// let author = await client.users.fetch(author_id)
		// if (author !== undefined) {
			
		// } else { // False author_id : we won't check every case, unitary tests don't go so far
		// 	console.log("Caution, is it a test?")
		// 	return Concorde_Result.command_error
		// }
	}

	try {
		let command = cut_command(content)

		if (command[0] === "!ar") { /*arrêter et afficher les résultats*/
			if (command.length < 2) throw Command_Error.not_enough_elements_in_first_line
			if (command.length > 2) throw Command_Error.too_many_elements_in_first_line

			let poll = await get_poll_from_channel_title(channel_id, command[1])

			if (!await bcrypt.compare(author_id, poll.author_hash_id)) {
				return
			}

			await poll.display_results(client)

			// Now close the poll
			await delete_poll(client, poll)

			return Concorde_Result.succeeded_create
		}
	} catch (error) {
		switch (error) {
			case Command_Error.unclosed_quotation_mark: {
				return error
			} case Command_Error.no_space_or_line_break_after_quotation_mark: {
				return error
			} case Command_Error.not_enough_elements_in_first_line: {
				return error
			} case Command_Error.too_many_elements_in_first_line: {
				return error
			} case Command_Error.title_not_found: {
				return error
			} default: {
				throw error
			}
		}
		// if (error === Concorde_Result.poll_not_close_properly || error === DB_Result.failed_delete || error === Concorde_Result.poll_not_display_properly) {
		// 	throw error
		// }
		// // Until there, existence of author id was not checked for the tests.
		// let author = await client.users.fetch(author_id)
		// if (author !== undefined) {
		// } else { // False author_id : we won't check every case, unitary tests don't go so far
		// 	console.log("Caution, is it a test?")
		// 	return Concorde_Result.command_error
		// }
	}

	return Concorde_Result.not_vote_action_command
}

let try_command_poll_action = async function(client: Client, content: string, channel_id: string, author_id: string): Promise<Concorde_Result> {
	let back_result = await try_command_poll_action_back(client, content, channel_id, author_id)
	if (back_result !== Concorde_Result.succeeded_create && back_result !== Concorde_Result.not_vote_action_command) {
		let author = await client.users.fetch(author_id)
		switch (back_result) {
			case Command_Error.unclosed_quotation_mark: {
				author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (guillemet non fermé)." + syntax_stop_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.no_space_or_line_break_after_quotation_mark: {
				author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (caractère autre qu'une espace ou un saut de ligne après un guillemet fermant)." + syntax_stop_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.not_enough_elements_in_first_line: {
				author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir 2 : l'élément \"!as\" et le titre du vote)." + syntax_stop_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.too_many_elements_in_first_line: {
				author.send("Erreur. La commande est incorrecte : la première ligne contient trop d'éléments (il ne peut y en avoir que 2 : l'élément \"!as\" et le titre du vote." + syntax_stop_reminder(content))
				return Concorde_Result.command_error
			} case Command_Error.title_not_found: {
				author.send("Erreur. La commande est incorrecte : aucun vote dans ce salon ne possède le titre fourni." + syntax_results_reminder(content))
				return Concorde_Result.command_error
			} default: {
				throw -1
			}
		}
	}

	return back_result
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

let look_for_vote = async function(candidate: Candidate, user_id: string): Promise<Concorde_Result> {
	let votes = await AppDataSource.getRepository(Vote)
		.createQueryBuilder("vote")
		.leftJoinAndSelect("vote.elector", "elector")
		.leftJoinAndSelect("vote.candidate", "candidate")
		.where("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: candidate.message_id })
		.getMany()

	for (let vote of votes) {
		if (await bcrypt.compare(user_id, vote.elector.hash_id)) {
			return Concorde_Result.found
		}
	}

	return Concorde_Result.not_found
}

export let set_vote = async function(client: Client, poll: Poll, candidate: Candidate, user_id: string, emoji_identifier: string, ): Promise<string> {
	// Try to find corresponding elector or create it
	let elector: Elector
	try {
		let electors = await AppDataSource.getRepository(Elector)
			.createQueryBuilder("elector")
			.leftJoinAndSelect("elector.poll", "poll")
			// .where("elector.hash_id = :hash_id_p", { hash_id_p: string_to_hash(user.id) })
			.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
			.getMany()
		for (let elector_p of electors) {
			if (await bcrypt.compare(user_id, elector_p.hash_id) === true) {
				elector = elector_p
				throw Concorde_Result.found
			}
		}
		throw Concorde_Result.not_found
	}
	catch (result) {
		switch (result) {
			case Concorde_Result.not_found: {
				let i = (await AppDataSource.createQueryBuilder()
					.insert()
					.into(Elector)
					.values({
						hash_id: await bcrypt.hash(user_id, saltRounds),
						///hash_id: 1,
						complete: Elector_Status.uncomplete,
						poll: poll
					})
					.execute()).identifiers
				elector = await AppDataSource.getRepository(Elector)
					.createQueryBuilder("elector")
					.leftJoinAndSelect("elector.poll", "poll")
					.where("elector.id = :elector_id_p", { elector_id_p: i[0].id })
					.getOneOrFail()
				break
			} case Concorde_Result.found: {
				break
			} default: {
				throw result
			}
		}
	}

	let candidate_rank = emoji_to_vote.get(emoji_identifier)

	// Try to update elector's vote or create it
	let vote_id: number
	try {
		let votes = await AppDataSource.getRepository(Vote)
			.createQueryBuilder("vote")
			.leftJoinAndSelect("vote.elector", "elector")
			.leftJoinAndSelect("vote.candidate", "candidate")
			.where("candidate.message_id = :candidate_message_id_p", { candidate_message_id_p: candidate.message_id })
			.getMany()

		for (let vote of votes) {
			if (await bcrypt.compare(user_id, vote.elector.hash_id)) {
				vote_id = vote.id
				throw Concorde_Result.found
			}
		}

		throw Concorde_Result.not_found
	} catch (result) {
		switch (result) {
			case Concorde_Result.found: {
				await AppDataSource.createQueryBuilder()
					.update(Vote)
					.set({ candidate_rank: candidate_rank })
					.where("vote.id = :vote_id_p", { vote_id_p: vote_id })
					.execute()
				break
			} case Concorde_Result.not_found: {
				await AppDataSource.createQueryBuilder()
					.insert()
					.into(Vote)
					.values({
						candidate_rank: candidate_rank,
						elector: elector,
						candidate: candidate
					})
					.execute()
				break
			} default: {
				throw result
			}
		}
	}

	// Update elector's completeness
	let elector_votes = await AppDataSource.getRepository(Vote)
		.createQueryBuilder("vote")
		.leftJoinAndSelect("vote.elector", "elector")
		.leftJoinAndSelect("vote.candidate", "candidate")
		.where("elector.id = :elector_id_p", { elector_id_p: elector.id })
		.getMany()

	let vote_complete = (elector_votes.length === poll.candidates_count)
	let vote_complete_private_message = ""
	if (vote_complete) {
		// Set vote to complete
		if (elector.complete === Elector_Status.uncomplete) {
			await AppDataSource.createQueryBuilder()
				.update(Elector)
				.set({ complete: Elector_Status.complete })
				.where("id = :id_p", { id_p: elector.id })
				.execute()
		}

		// Sort votes by ranking
		let elector_votes_sorted = elector_votes.sort((a, b) => a.candidate_rank - b.candidate_rank)

		// Set confirmation private message content
		vote_complete_private_message = "=== **" + poll.title + "** ===\nVotre vote a bien été pris en compte. Voici un récapitulatif :"
		// let vote_candidates: Array<Candidate>
		// vote_candidates = await AppDataSource.getRepository(Candidate)
		// 	.createQueryBuilder("candidate")
		// 	.leftJoinAndSelect("candidate.poll", "poll")
		// 	.where("poll.id = :poll_id_p", { poll_id_p: poll.id })
		// 	.getMany()
		for (let i = 0; i < elector_votes_sorted.length; i++) {
			vote_complete_private_message += "\n" + elector_votes_sorted[i].candidate_rank + " : "/* + "`"*/  + elector_votes_sorted[i].candidate.name/* + "`"*/
		}

		await poll.update_introduction_message(client)
	}
	return vote_complete_private_message
}

let string_in_array = function(string: string, array: string[]): boolean {
	for (let element of array) {
		if (element === string) {
			return true
		}
	}
	return false
}

export let try_set_vote = async function(reaction: MessageReaction, user: User, client: Client): Promise<Concorde_Result> {	
	let candidate: Candidate
	try {
		candidate = await AppDataSource.getRepository(Candidate)
		.createQueryBuilder("candidate")
		.leftJoinAndSelect("candidate.poll", "poll")
		.where("candidate.message_id = :message_id_p", { message_id_p: reaction.message.id })
		.getOneOrFail()
	} catch (error) {
		return Concorde_Result.not_vote
	}

	let message = reaction.message
	let message_id = message.id
	let emoji_identifier = reaction.emoji.identifier
	let reaction_users = reaction.users
	
	let poll = candidate.poll
	
	await reaction_users.remove(user)

	if (!string_in_array(emoji_identifier, emoji_identifiers.slice(0, poll.candidates_count))) {
		return Concorde_Result.not_vote
	}
	
	let result = await set_vote(client, poll, candidate, user.id, emoji_identifier)
	if (result !== "") {
		let vote_complete_private_message = result
		await user.send(vote_complete_private_message)
	}
}