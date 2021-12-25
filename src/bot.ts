import { Client, Guild, Channel, Intents, Message, TextChannel, User, TextBasedChannels, MessageReaction, MessageEmbed } from 'discord.js'

const QuickChart = require('quickchart-js');

let polls = Array<Poll>()
let next_poll_id = 0

let string_to_hash = function(string: string) {
	let hash = 0

	if (string.length === 0) return hash

	for (let i = 0; i < string.length; i++) {
		let char = string.charCodeAt(i)
		hash = ((hash << 5) - hash) + char
		hash |= 0
	}

	return hash
}

class State {
	author_hash_id: number
	channel_id: string

	constructor (author_id:string, channel_id: string) {
		this.author_hash_id = string_to_hash(author_id),
		this.channel_id = channel_id
	}
}

export class Bot {
	private client: Client
	private self_respond_counter: number

	triggers: Array<State>
	starts: Array<State>
	/*guild: Guild
	channel: TextBasedChannels*/

	constructor () {
		this.client = new Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGES"], partials: ["REACTION", "USER", "MESSAGE", "CHANNEL"] })

		this.self_respond_counter = 0

		this.triggers = new Array<State>()
		this.starts = new Array<State>()

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

			await try_democratie_amour(message)

			//if (!this.c_o(await try_command(this, message))) return
			await try_command(this, message)
		})

		this.client.on('messageReactionAdd', async (reaction: MessageReaction, user: User) => {
			if (this.client.user.id === user.id) {
				return
			}

			try_set_vote(reaction, user)
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

class Elector {
	hash_id: number
	votes: Array<number>

	constructor (elector_id: string, votes: Array<number>) {
		this.hash_id = string_to_hash(elector_id)
		this.votes = votes
	}

	get_result = function() {
		let result = new Array<number[]>(this.votes.length)
		for (let i = 0; i < result.length; i++) {
			let line = new Array<number>(this.votes.length).fill(0)
			result[i] = line
		}
		//console.log(this.votes)
		for (let i = 0; i < this.votes.length; i++) {
			for (let j = 0; j < i; j++) {
				let values:number[] = []
				if (this.votes[i] < this.votes[j]) {
					values = [1, 0]
				} else if (this.votes[i] > this.votes[j]) {
					values = [0, 1]
				} else {
					values = [0, 0]
				}
				result[i][j] = values[0]
				result[j][i] = values[1]
				//console.log(values, result)
			}
		}
		return result
	}
}

class Poll {
	private id: number
	title: string
	end_date_given: boolean
	end_date: string
	candidates: string[]
	channel: TextBasedChannels
	poll_messages_ids: Array<string>
	introduction_message_id: string
	uncomplete_electors: Array<Elector>
	complete_electors: Array<Elector>
	//electors_ids_having_voted: Array<string>
	state: string

	//private reaction_numbers = ["\u0031\u20E3","\u0032\u20E3","\u0033\u20E3","\u0034\u20E3","\u0035\u20E3", "\u0036\u20E3","\u0037\u20E3","\u0038\u20E3","\u0039\u20E3"]

	private get_introduction_message_content = function(): string {
		let declinative_form: string
		if (this.complete_electors.length === 0) {
			let encore_or_not: string
			if (this.state === "Ouvert") {
				encore_or_not = "encore "
			} else {
				encore_or_not = ""
			}
			declinative_form = "personne n'a " + encore_or_not + "voté"
		} else if (this.complete_electors.length === 1) {
			declinative_form = "1 personne a voté"
		} else {
			declinative_form = this.complete_electors.length + " personnes ont voté"
		}
		let end_date: string
		if (this.end_date_given === true) {
			end_date = "\n—> Fin prévue : `" + this.end_date + "` <—" 
		} else {
			end_date = ""
		}

		let introduction_message_content = "=== **" + this.title + "** ==="
		+ "\n—> `" + this.state + "` – _" + declinative_form + "_ <—"
		+ end_date
		+ "\nClassez chaque candidat (1 = préféré ; " + this.candidates.length + " = le moins apprécié ; vous pouvez attribuer une même note à plusieurs candidats) :"
		return introduction_message_content
	}

	private launch_poll = async function(): Promise<void> {		
		let introduction_message_content = this.get_introduction_message_content()
		/*let introduction_message_embed = new MessageEmbed()
			//.setColor("#E7B71F")
			.setColor("#0099ff")
			.setTitle("=== **" + this.title + "** ===")
			.setDescription(introduction_message_content)*/
		//let introduction_message = await this.channel.send({ embeds: [introduction_message_embed] })
		let introduction_message = await this.channel.send(introduction_message_content)
		this.introduction_message_id = introduction_message.id

		let candidates_count = this.candidates.length
		for (let i = 0; i < candidates_count; i++) {
			let candidate_message_content = /*"`" + */this.candidates[i]/* + "`"*/
			let candidate_message = await this.channel.send(candidate_message_content)
			this.poll_messages_ids.push(candidate_message.id)

			for (let j = 0; j < candidates_count; j++) {
				//candidate_message.react(this.reaction_numbers[j])
				candidate_message.react(emoji_identifiers[j])
			}
		}
	}

	constructor (next_poll_id: number, title: string, end_date_given: boolean, end_date: string, candidates: string[], channel: TextBasedChannels) {
		this.id = next_poll_id
		this.title = title
		this.end_date_given = end_date_given
		this.end_date = end_date
		this.candidates = candidates
		this.channel = channel
		this.poll_messages_ids = new Array<string>()
		this.uncomplete_electors = new Array<Elector>()
		this.complete_electors = new Array<Elector>()
		//this.electors_ids_having_voted = new Array<string>()
		this.state = "Ouvert"

		this.launch_poll()
	}

	update_introduction_message = async function() {
		let introduction_message = await this.channel.messages.fetch(this.introduction_message_id)
		let new_introduction_message = this.get_introduction_message_content()
		introduction_message.edit(new_introduction_message)
	}

	close_poll = async function() {
		this.state = "Fermé"

		await this.update_introduction_message()
		
		return true
	}

	display_results = function() {
		let results_complete = new Array<number[]>(this.candidates.length)
		for (let i = 0; i < results_complete.length; i++) {
			let line = new Array<number>(this.candidates.length).fill(0)
			results_complete[i] = line
		}
		for (let e = 0; e < this.complete_electors.length; e++) {
			let elector_result = this.complete_electors[e].get_result()
			//console.log(elector_result)

			/*this.channel.send("====")
			this.channel.send(this.electors[e].id)
			for (let i = 0; i < elector_result.length; i++) {
				let line = ""
				for (let j = 0; j < elector_result.length; j++) {
					line += elector_result[i][j] + " "
				}
				this.channel.send(line)
			}*/

			for (let i = 0; i < results_complete.length; i++) {
				for (let j = 0; j < results_complete.length; j++) {
					results_complete[i][j] += elector_result[i][j]
					//console.log(i, j, results_complete)
				}
			}
		}

		/*this.channel.send("====")
		for (let i = 0; i < results_complete.length; i++) {
			let line = ""
			for (let j = 0; j < results_complete.length; j++) {
				line += results_complete[i][j] + " "
			}
			this.channel.send(line)
		}*/

		let results_wins_counts = []
		for (let i = 0; i < results_complete.length; i++) {
			let wins_count = 0
			for (let j = 0; j < results_complete.length; j++) {
				if (results_complete[i][j] > results_complete[j][i]) {
					wins_count++
				}
			}
			results_wins_counts[i] = wins_count
		}

		const chart = new QuickChart();
		chart.setConfig({
			type: 'bar',
			data: { labels: this.candidates, datasets: [{ label: 'Nombre de duels gagnés par candidat', data: results_wins_counts }] },
		});

		const chartEmbed = new MessageEmbed()
			.setTitle('Résultats du vote')
			//.setDescription('Here\'s a chart that I generated')
			.setImage(
				chart.getUrl()
			)
		this.channel.send({ embeds: [chartEmbed] });

		return [results_complete, results_wins_counts, chartEmbed]
	}
}

let bot_already_stated_here = function(state: Array<State>, author_id: string, channel_id: string): any[] {
	for (let i = 0; i < state.length; i++) {
		let trigger = state[i]
		if (trigger.author_hash_id === string_to_hash(author_id) && trigger.channel_id === channel_id) {
			return [true, i]
		}
	}
	return [false]
}

/*interface error_E {
	empty_line: boolean
	unclosed_quotation_mark: boolean
	no_space_after_quotation_mark: boolean
}
type error = keyof error_E*/

enum Error {
	empty_line,
	unclosed_quotation_mark,
	no_space_or_line_break_after_quotation_mark,
	not_enough_elements_in_first_line,
	too_many_elements_in_first_line,
	first_character_not_n,
	not_enough_lines
}

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
			if (text[i] === "\n") throw Error.empty_line
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
			if (i === length) throw Error.unclosed_quotation_mark

			while (string[i] !== `"`) {
				word += string[i]

				i++
				if (i === length) throw Error.unclosed_quotation_mark
			}

			if (i !== length - 1) {
				if (string[i + 1] !== " ") throw Error.no_space_or_line_break_after_quotation_mark
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
	let message_sent: Message | undefined

	if (message.content === `La démocratie à Grignon c'est quoi ?`) {
		message_sent = await message.channel.send(`La démocratie à Grignon c'est le BDE et c'est que de l'amour, n'est-ce pas ?`)
	}

	return message_sent !== undefined
}

let find_poll_from_channel = function(channel_id: string): number {
	for (let i = 0; i < polls.length; i++) {
		if (channel_id === polls[i].channel.id) {
			return i
		}
	}
	return -1
}

//let syntax_reminder = `\nExemple d'utilisation :\n> n "Vote lambda"\n> Candidat A\n> Candidat B\n> Candidat C\nPour arrêter de tenter de lancer un vote :\n> !ac`

let syntax_reminder = function(message_content: string) {
	return "\nExemple d'utilisation (la date est optionnelle) :\n\`\`\`n \"Vote lambda\" \"Vendredi 24 décembre 2021, 12 h 34 m 56 s\"\nCandidat A\nCandidat B\nCandidat C\`\`\`"
	+ "\nVotre commande qui a échoué :\n\`\`\`\n" + message_content + "\`\`\`"
	+ "\nPour arrêter de tenter de lancer un vote :\n\`\`\`\n!ac\`\`\`"
}

let try_command = async function(that: Bot, message: Message): Promise<string | boolean> {
	let triggered = bot_already_stated_here(that.triggers, message.author.id, message.channel.id)
	let started = bot_already_stated_here(that.starts, message.author.id, message.channel.id)
	if (!triggered[0]) {
		if (message.content !== "!cc") { /*!commencer Concorde*/
			return
		}

		/*that.guild = message.guild
		that.channel = message.channel*/
	
		that.triggers.push(new State(message.author.id, message.channel.id))

		message.delete()

		return
	} else if (!started[0]) {
		let message_content = message.content
		let message_author = message.author
		let message_channel = message.channel
		
		message.delete()

		if (message_content === "!ac") { /*!arrêter Concorde*/
			that.triggers.splice(triggered[1])
			
			return
		}

		try {
			let lines = cut_into_lines(message_content)

			let first_line = lines[0]

			let first_line_w = cut_command(first_line)
			console.log(first_line_w)
			if (first_line_w.length < 2) throw Error.not_enough_elements_in_first_line
			if (first_line_w.length > 3) throw Error.too_many_elements_in_first_line
			if (first_line_w[0] !== "n") throw Error.first_character_not_n

			let title = first_line_w[1]

			let end_date_given: boolean
			let end_date: string
			if (first_line_w.length === 3) {
				end_date_given = true
				end_date = first_line_w[2]
			} else {
				end_date_given = false
			}

			if (lines.length < 2) throw Error.not_enough_lines
			let candidates = new Array<string>()
			for (let i = 1; i < lines.length; i++) {
				candidates.push(lines[i])
			}

			polls.push(new Poll(next_poll_id, title, end_date_given, end_date, candidates, message_channel))
			next_poll_id++
		} catch (error) {
			if (error === Error.empty_line) {
				message_author.send("Erreur. La commande est incorrecte : une ligne vide a été fournie (candidat vide)." + syntax_reminder(message_content))
				return
			}
			if (error === Error.unclosed_quotation_mark) {
				message_author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (guillemet non fermé)." + syntax_reminder(message_content))
				return
			}
			if (error === Error.no_space_or_line_break_after_quotation_mark) {
				message_author.send("Erreur. La commande est incomplète : la première ligne ne respecte pas la syntaxe (caractère autre qu'une espace ou un saut de ligne après un guillemet fermant)." + syntax_reminder(message_content))
				return
			}
			if (error === Error.not_enough_elements_in_first_line) {
				//return "Command is uncomplete: first line does not match the syntax."
				message_author.send("Erreur. La commande est incorrecte : la première ligne ne contient pas assez d'éléments (il doit y en avoir au moins 2 : l'élément \"n\" et le titre du vote)." + syntax_reminder(message_content))
				return
			}
			if (error === Error.too_many_elements_in_first_line) {
				//return "Command is uncomplete: first line does not match the syntax."
				message_author.send("Erreur. La commande est incorrecte : la première ligne contient trop d'éléments (il ne peut y en avoir au maximum que 3 : l'élément \"n\", le titre du vote et la date prévue de fin)." + syntax_reminder(message_content))
				return
			}
			if (error === Error.first_character_not_n) {
				//return "Command is uncomplete: first line does not match the syntax."
				message_author.send("Erreur. La commande est incorrecte : le premier élément doit être l'élément \"n\"." + syntax_reminder(message_content))
				return
			}
			if (error === Error.not_enough_lines) {
				//return "Command is uncomplete: lines are missing (no candidates given)."
				message_author.send("Erreur. La commande est incomplète : elle doit faire minimum 2 lignes (aucun candidat n'a été fourni)." + syntax_reminder(message_content))
				return
			}
			throw error
		}
		
		that.starts.push(new State(message_author.id, message_channel.id))

		return true
	} else {
		if (message.content === "!av") { /*arrêter vote*/
			let result = find_poll_from_channel(message.channel.id)
			message.delete()
			if (result === -1) {
				return "nmon"
			}
			let poll = polls[result]
			
			if (!poll.close_poll()) {
				return "Poll did not close properly."
			}
			
			polls.splice(result)

			that.triggers.splice(triggered[1])
			that.starts.splice(started[1])
		}

		if (message.content === "!r") { /*résultats*/
			let result = find_poll_from_channel(message.channel.id)
			message.delete()
			if (result === -1) {
				return "nmon"
			}
			let poll = polls[result]

			/*poll.electors.push(new Elector("S", [1, 3, 1, 5, 2, 4, 5, 4, 5, 3, 5]))
			poll.electors.push(new Elector("N", [2, 5, 1, 5, 1, 1, 4, 4, 1, 1, 6]))
			poll.electors.push(new Elector("E", [5, 2, 1, 3, 6, 4, 4, 6, 2, 1, 5]))
			poll.electors.push(new Elector("F", [4, 6, 2, 5, 3, 1, 9, 10, 8, 7, 11]))
			poll.electors.push(new Elector("A", [5, 6, 8, 5, 7, 8, 5, 4, 7, 8, 2]))*/
			let results = poll.display_results()
			console.log(results[0])
			console.log(results[1])
		}
	}

	return true
}

let find_poll_and_candidate_from_vote = function(message_id: string): number[] {
	for (let i = 0; i < polls.length; i++) {
		for (let j = 0; j < polls[i].poll_messages_ids.length; j++) {
			if (message_id === polls[i].poll_messages_ids[j]) {
				return [i, j]
			}
		}
	}
	return [-1]
}

let elector_registred = function(electors: Array<Elector>, user_id: string) {
	for (let i = 0; i < electors.length; i++) {
		if (electors[i].hash_id === string_to_hash(user_id)) {
			return i
		}
	}
	return false
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

let emoji_identifiers = Array.from(emoji_to_vote.keys())

let vote_complete = function(votes: number[]): boolean {
	for (let i = 0 ; i < votes.length; i++) {
		if (votes[i] === 0) {
			return false
		}
	}
	return true
}

let quick_sort = function(array: number[]) {
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
}

let try_set_vote = async function(reaction: MessageReaction, user: User) {
	let message_id = reaction.message.id
	let emoji_identifier = reaction.emoji.identifier
	//console.log(emoji_identifier)
	
	let result = find_poll_and_candidate_from_vote(message_id)
	if (result[0] === -1) {
		return
	}
	let poll_index = result[0]
	let poll = polls[poll_index]

	reaction.users.remove(user)

	let candidate_index = result[1]

	//let elector_index = elector_registred(poll, user.id)
	let elector: Elector
	let result_uncomplete = elector_registred(poll.uncomplete_electors, user.id)
	let result_complete = elector_registred(poll.complete_electors, user.id)
	if (result_complete !== false) {
		elector = poll.complete_electors[result_complete]
	} else if (result_uncomplete !== false) {
		elector = poll.uncomplete_electors[result_uncomplete]
	} else {
		elector = new Elector(user.id, new Array<number>(poll.poll_messages_ids.length).fill(0))
		poll.uncomplete_electors.push(elector)
	}
	/*let elector = poll.electors[elector_index]
	if (elector_index === poll.electors.length) {
		poll.electors.push(new Elector(user.id, new Array<number>(poll.poll_messages_ids.length).fill(0)))
	}*/

	let vote = emoji_to_vote.get((emoji_identifier))

	let votes = elector.votes
	votes[candidate_index] = vote

	if (vote_complete(votes)) {
		/*if (!(elector.id in poll.electors_ids_having_voted)) {
			poll.electors_ids_having_voted.push(elector.id)
		}*/

		if (result_uncomplete !== false) {
			poll.uncomplete_electors.splice(result_uncomplete)
			poll.complete_electors.push(elector)
		}

		let votes_sorted = quick_sort(votes)
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
		}
		/*console.log(candidates_sorted)
		console.log(votes_sorted)*/

		let vote_complete_private_message = "=== **" + poll.title + "** ===\nVotre vote a bien été pris en compte. Voici un récapitulatif :"
		for (let i = 0; i < votes.length; i++) {
			vote_complete_private_message += "\n" + votes_sorted[i] + " : "/* + "`"*/  + candidates_sorted[i]/* + "`"*/
		}
		user.send(vote_complete_private_message)
		poll.update_introduction_message()
	}
}