import { Client, Guild, Channel, Intents, Message, TextChannel, User, TextBasedChannels, MessageReaction } from 'discord.js'

let polls = Array<Poll>()
let next_id = 0

export class Bot {
	private client: Client
	private self_respond_counter: number

	bot_triggered = false
	bot_started = false
	guild: Guild
	channel: TextBasedChannels

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
				}
				else {
					this.self_respond_counter--
				}
			}

			await try_democratie_amour(message)

			if (!this.c_o(await try_command(this, message))) return
		})

		this.client.on('messageReactionAdd', async (reaction: MessageReaction, user: User) => {
			if (this.client.user.id === user.id) {
				return
			}

			try_set_vote(reaction, user)
		})
	}

	private c_o = (result: boolean | string) => {
		if (result !== true) {
			if (result !== "nmon") { // no message output needed
				console.log(result)			
			}
			return false
		}
		return true
	}

	async login () {
		await this.client.login(process.env.DISCORD_BOT_TOKEN)
	}

	get_channel = async (id: string) => {
		return await this.client.channels.fetch(id) as TextChannel
	}

	allow_self_respond = (nombre: number = 1) => {
		this.self_respond_counter = nombre
	}
}

class Elector {
	id: string
	votes: Array<number>

	constructor (id: string, votes: Array<number>) {
		this.id = id
		this.votes = votes
	}
}

class Poll {
	private id: number
	title: string
	candidates: string[]
	private channel: TextBasedChannels
	poll_messages_ids: Array<string>
	electors: Array<Elector>
	electors_ids_having_voted: Array<string>

	private reaction_numbers = ["\u0031\u20E3","\u0032\u20E3","\u0033\u20E3","\u0034\u20E3","\u0035\u20E3", "\u0036\u20E3","\u0037\u20E3","\u0038\u20E3","\u0039\u20E3"]

	private launch_poll = async function(): Promise<void> {		
		let introduction_message_content = "=== **" + this.title + "** ===\nClassez chaque candidat (1 = préféré ; " + this.candidates.length
		introduction_message_content += " = le moins apprécié ; vous pouvez attribuer une même note à plusieurs candidats) :"
		/*let introduction_message = */await this.channel.send(introduction_message_content)
		/*poll_messages_ids.push(introduction_message.id)*/

		let candidates_count = this.candidates.length
		for (let i = 0; i < candidates_count; i++) {
			let candidate_message_content = /*"`" + */this.candidates[i]/* + "`"*/
			let candidate_message = await this.channel.send(candidate_message_content)
			this.poll_messages_ids.push(candidate_message.id)

			for (let j = 0; j < candidates_count; j++) {
				candidate_message.react(this.reaction_numbers[j])
			}
		}
	}

	constructor (next_id: number, title: string, candidates: string[], channel: TextBasedChannels) {
		this.id = next_id
		this.title = title
		this.candidates = candidates
		this.channel = channel
		this.electors = new Array<Elector>()
		this.poll_messages_ids = new Array<string>()
		this.electors = Array<Elector>()
		this.electors_ids_having_voted = Array<string>()

		this.launch_poll()
	}
}

let cut_into_lines = function(text: string): string[] {
	let lines = []
	let line = ""
	let i = 0
	while (i < text.length) {
		if (text[i] == "\n") {
			lines.push(line)
			line = ""
			i++
			if (i == text.length) {
				break
			}
		}
		line += text[i]
		i++
	}
	lines.push(line)

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
			word += string[i]
			i++

			while (string[i] !== `"`) {
				word += string[i]

				i++
				if (i === length) {
					return ["ERROR"]
				}
			}

			cut_string.push(word)
			word = ""
		}
		else if (string[i] !== " ") {
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

let try_command = async function(that: Bot, message: Message): Promise<string | boolean> {
	if (!that.bot_triggered) {
		if (message.content !== "!cc") { /*!commencer Concorde*/
			return "nmon"
		}

		that.guild = message.guild
		that.channel = message.channel
	
		that.bot_triggered = true

		message.delete()

		return true
	}
	else if (!that.bot_started) {
		let lines = cut_into_lines(message.content)
		//console.log(lines)
		
		if (lines.length < 2) {
			return "Command is uncomplete: lines are missing."
		}

		let first_line = lines[0]
		let first_line_w = cut_command(first_line)
		if (first_line.length < 2) {
			return "Command is uncomplete: first line does not match the syntax."
		}
		if (first_line_w[0] !== "n") {
			return "Command is uncomplete: first line does not match the syntax."
		}
		let title = first_line_w[1]

		let candidates = new Array<string>()
		for (let i = 1; i < lines.length; i++) {
			candidates.push(lines[i])
		}

		polls.push(new Poll(next_id, title, candidates, message.channel))
		next_id++

		that.bot_started = true

		return true
	}
	else {
		if (message.content === "résultats") {
			
		}
	}
}

let find_poll = function(message_id: string): Poll {
	return polls[0]
}

let find_poll_and_candidate = function(message_id: string): number[] {
	for (let i = 0; i < polls.length; i++) {
		for (let j = 0; j < polls[i].poll_messages_ids.length; j++) {
			if (message_id === polls[i].poll_messages_ids[j]) {
				return [i, j]
			}
		}
	}
	return [-1]
}

let elector_registred = function(poll: Poll, user_id: string): number {
	for (let i = 0; i < poll.electors.length; i++) {
		if (poll.electors[i].id === user_id) {
			return i
		}
	}
	return poll.electors.length
}

let emoji_to_vote = new Map<string, number>([
	["1%E2%83%A3", 1],
	["2%E2%83%A3", 2],
	["3%E2%83%A3", 3],
	["4%E2%83%A3", 4],
	["5%E2%83%A3", 5],
	["6%E2%83%A3", 6],
	["7%E2%83%A3", 7],
	["8%E2%83%A3", 8],
	["9%E2%83%A3", 9],
])

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
		}
		else {
			right.push(array[i])
		}
	}

	return quick_sort(left).concat([center], quick_sort(right))
}

let try_set_vote = async function(reaction: MessageReaction, user: User) {
	let message_id = reaction.message.id
	let emoji_identifier = reaction.emoji.identifier
	reaction.users.remove(user)

	let result = find_poll_and_candidate(message_id)
	if (result[0] === -1) {
		return
	}
	let poll_index = result[0]
	let poll = polls[poll_index]
	let candidate_index = result[1]

	let elector_index = elector_registred(poll, user.id)
	if (elector_index === poll.electors.length) {
		poll.electors.push(new Elector(user.id, new Array<number>(poll.poll_messages_ids.length).fill(0)))
	}

	let vote = emoji_to_vote.get((emoji_identifier))

	let votes = poll.electors[elector_index].votes
	votes[candidate_index] = vote

	if (vote_complete(votes)) {
		if (!(poll.electors[elector_index].id in poll.electors_ids_having_voted)) {
			poll.electors_ids_having_voted.push(poll.electors[elector_index].id)
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
	}
}