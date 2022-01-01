import { Bot } from './bot'
import { User } from './entity/User'
import { createConnection, Connection } from "typeorm"
import "reflect-metadata"

(async () => {
	//let bot = new Bot()

	//await bot.login()

	const connection = await createConnection({
		type: "sqlite",
		database: "test"
	})
	await connection.connect()

	let user = new User()
	user.age = 9001
	await user.save()

	let users = User.find()
	console.log(users)
})()