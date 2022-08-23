import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany, getRepository } from "typeorm"
import { Elector } from "./Elector"
import { Candidate } from "./Candidate"
import { Elector_Status, emoji_identifiers } from "./Bot"
import { Client, TextChannel, MessageEmbed } from "discord.js"
const QuickChart = require("quickchart-js")

export enum Poll_State {
	open,
	closed
}

let get_introduction_message_content = async function(title: string, candidates_count: number, end_date_given: boolean, end_date: string, state: Poll_State, launching: boolean, poll_id: number): Promise<string> {
	let declinative_form: string
	let complete_electors_count: number
	if (launching === true) {
		complete_electors_count = 0
	} else {
		let complete_electors: Array<Elector>
		try {
			complete_electors = await getRepository(Elector)
				.createQueryBuilder("elector")
				.leftJoinAndSelect("elector.poll", "poll")
				.where("poll.id = :poll_id_p", { poll_id_p: poll_id })
				.andWhere("elector.complete = :complete_p", { complete_p: Elector_Status.complete })
				.getMany()
		} catch (error) {
			console.log("Snif 5")
		}
		complete_electors_count = complete_electors.length
	}
	if (complete_electors_count === 0) {
		let encore_or_not = state === Poll_State.open ? "encore " : ""
		declinative_form = "personne n'a " + encore_or_not + "voté"
	} else if (complete_electors_count === 1) {
		declinative_form = "1 personne a voté"
	} else {
		declinative_form = complete_electors_count + " personnes ont voté"
	}
	let end_date_content = end_date_given === true ? "\n—> Fin prévue : `" + end_date + "` <—" : ""

	let state_content = state === Poll_State.open ? "Ouvert" : "Fermé"
	
	let introduction_message_content =/* "=== **" + title + "** ==="
	//+ "\n—> `" + this.state + "` – _" + declinative_form + "_ <—"
	+ "\n" +*/" —> `" + state_content + "` – _" + declinative_form + "_ <—"
	+ end_date_content
	+ "\nClassez chaque candidat (1 = préféré ; " + candidates_count + " = le moins apprécié ; vous pouvez attribuer une même note à plusieurs candidats) :"
	return introduction_message_content		//this.candidates.length
}

let get_introduction_message_embed = async function(title: string, end_date_given: boolean, end_date: string, state: Poll_State, candidates_length: number, launching: boolean, poll_id: number): Promise<MessageEmbed> {
	let introduction_message_content = await get_introduction_message_content(title, candidates_length, end_date_given, end_date, state, launching, poll_id)
	let introduction_message_embed = new MessageEmbed()
		//.setColor("#E7B71F")
		.setColor("#0099ff")
		.setTitle("=== **" + title + "** ===")
		.setDescription(introduction_message_content)
	return introduction_message_embed
}

export let launch_poll = async function(title: string, end_date_given: boolean, end_date: string, channel_id: string, state: Poll_State, candidates: Array<string>, client: Client): Promise<Array<string>> {
	let channel = await client.channels.fetch(channel_id) as TextChannel

	let launching = true
	let introduction_message = await channel.send({ embeds: [await get_introduction_message_embed(title, end_date_given, end_date, state, candidates.length, launching, 0)] })
	let introduction_message_id = introduction_message.id

	let messages_ids = [introduction_message_id]
	
	let candidates_count = candidates.length
	for (let i = 0; i < candidates_count; i++) {
		let candidate_message_content = candidates[i]
		let candidate_message = await channel.send(candidate_message_content)
		messages_ids.push(candidate_message.id)
		
		for (let j = 0; j < candidates_count; j++) {
			await candidate_message.react(emoji_identifiers[j])
		}
	}

	return messages_ids
}

@Entity()
export class Poll extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number

	@Column()
	title: string

	@Column()
	end_date_given: boolean
	
	@Column()
	end_date: string

	@Column()
	channel_id: string

	@Column()
	introduction_message_id: string

	@Column()
	state: Poll_State

	@Column()
	candidates_count: number

	@OneToMany(() => Candidate, candidate => candidate.poll)
	candidates: Array<Candidate>

	@OneToMany(() => Elector, elector => elector.poll)
	electors: Array<Elector>

	update_introduction_message = async function(client: Client): Promise<void> {
		let introduction_message = await (await client.channels.fetch(this.channel_id) as TextChannel).messages.fetch(this.introduction_message_id)
		let launching = false
		introduction_message.edit({ embeds: [await get_introduction_message_embed(this.title, this.end_date_given, this.end_date, this.state, this.candidates_count, launching, this.id)] })
	}

	close_poll = async function(client: Client): Promise<boolean> {
		this.state = Poll_State.closed

		await this.update_introduction_message(client)
		
		return true
	}

	display_results = async function(client: Client): Promise<(any[] | MessageEmbed)[]> {
		let channel = await client.channels.fetch(this.channel_id) as TextChannel

		let results_complete = new Array<Array<number>>(this.candidates_count)
		for (let i = 0; i < results_complete.length; i++) {
			let line = new Array<number>(this.candidates_count).fill(0)
			results_complete[i] = line
		}
		let complete_electors: Array<Elector>
		try {
			complete_electors = await getRepository(Elector)
				.createQueryBuilder("elector")
				.leftJoinAndSelect("elector.poll", "poll")
				.where("poll.id = :poll_id_p", { poll_id_p: this.id })
				.andWhere("elector.complete = :elector_complete_p", { elector_complete_p: Elector_Status.complete })
				.getMany()
		} catch (error) {
			console.log("Snif 6")
		}
		for (let e = 0; e < complete_electors.length; e++) {
			let elector_result = await complete_electors[e].get_result()

			let lines = "\`\`\`\n" + complete_electors[e].hash_id.toString()
			for (let i = 0; i < elector_result.length; i++) {
				let line = ""
				for (let j = 0; j < elector_result.length; j++) {
					line += elector_result[i][j] + " "
				}
				lines += "\n" + line
			}
			lines += "\`\`\`"
			channel.send(lines)

			for (let i = 0; i < results_complete.length; i++) {
				for (let j = 0; j < results_complete.length; j++) {
					results_complete[i][j] += elector_result[i][j]
				}
			}
		}

		let lines = "\`\`\`\n"
		for (let i = 0; i < results_complete.length; i++) {
			let line = ""
			for (let j = 0; j < results_complete.length; j++) {
				line += results_complete[i][j] + " "
			}
			lines += "\n" + line
		}
		lines += "\`\`\`"
		channel.send(lines)

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

		let candidates_names: Array<Candidate>
		try {
			candidates_names = await getRepository(Candidate)
				.createQueryBuilder("candidate")
				.leftJoinAndSelect("candidate.poll", "poll")
				.select("name")
				.where("poll.id = :poll_id_p", { poll_id_p: this.id })
				.getRawMany()
		} catch (error) {
			console.log("Snif 7")
		}
		let raw_candidates_names_p: Array<string> = Array<string>()
		for (let c of candidates_names) {
			raw_candidates_names_p.push(c.name)
		}
		let chart = new QuickChart();
		chart.setConfig({
			type: 'bar',
			data: { labels: raw_candidates_names_p, datasets: [{ label: 'Nombre de duels gagnés par candidat', data: results_wins_counts }] },
		});

		const chartEmbed = new MessageEmbed()
			.setTitle("Résultats du vote : " + this.title)
			.setImage(
				chart.getUrl()
			)
		channel.send({ embeds: [chartEmbed] });

		return [results_complete, results_wins_counts, chartEmbed]
	}
}