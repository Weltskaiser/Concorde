import { expect } from 'chai'
import { Bot, try_democratie_amour } from "../src/bot"

import { Guild, Intents, Message, TextChannel, User } from 'discord.js'

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

let try_democratie_amour_ok = async (client: Client, message: string) => {
	client.allow_self_respond()
	let channel = await client.get_channel("899773734213263400") as TextChannel
	let message_sent = await channel.send(message)

	return await try_democratie_amour(message_sent)
}

describe('Module', () => {
	it('démocratie_amour_ok', async () => {
		let client = await Client.create()
		expect(await try_democratie_amour_ok(client, "La démocratie à Grignon c'est quoi ?")).to.equal(true)
	})
	it('démocratie_amour_no', async () => {
		let client = await Client.create()
		expect(await try_democratie_amour_ok(client, "La démocratei à Grignon c'est quoi ?")).to.equal(false)
	})
})