import { Bot } from './bot'

(async () => {
	let bot = new Bot()

	await bot.login()

	/*let channel = await bot.get_channel("900113061954854972")
	console.log(channel)*/
})()