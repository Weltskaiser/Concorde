import { expect } from 'chai'
import { Bot, try_command_start, try_democratie_amour } from "../src/entity/Bot"

import { Guild, Intents, Message, TextChannel, User } from 'discord.js'
import { start } from '../src/app'

class Client extends Bot {

	static async create() {
		let res = new Client()
		await res.init()
		return res
	}

	private constructor () {
		super()
	}

	private init = async () => {
		await this.login()
	}
}

let try_democratie_amour_ok = async (message: string) => {
	let client = await Client.create()
	client.allow_self_respond()
	let channel = await client.get_channel("919198908352167947") as TextChannel
	let message_sent = await channel.send(message)

	return await try_democratie_amour(message_sent)
}

let try_create_poll = async function (command: string) { // Here we consider there is a trigger on the user and he's trying to create a poll
	let client = await start()
	// await try_command_start(client, command, Query_Result.found)s

	return true
}

describe('Module', () => {
	it('démocratie_amour_ok', async () => {
		expect(await try_democratie_amour_ok("La démocratie à Grignon c'est quoi ?")).to.equal(true)
	})
	it('démocratie_amour_no', async () => {
		expect(await try_democratie_amour_ok("La démocratei à Grignon c'est quoi ?")).to.equal(false)
	})
	it('create_poll', async () => {
		expect(await try_create_poll(`n Salut "C'est cool"\nA\nB\nC`)).to.equal(true)
	})
})