import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, PrimaryColumn, OneToMany, ManyToMany, ManyToOne, TableInheritance, ChildEntity, OneToOne } from "typeorm"
import { Bot } from "./Bot"

@Entity()
export abstract class Bot_State extends BaseEntity {
	@PrimaryColumn()
	author_hash_id: number

	@PrimaryColumn()
	channel_id: string
}

@Entity()
export class Trigger extends Bot_State {}

/*@Entity()
export class Start extends Bot_State {}*/