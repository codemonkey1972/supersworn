import type { ChatSpeakerData } from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/chatSpeakerData'
import { hashLookup } from '../dataforged'
import {
	findPathToNodeByTableUuid,
	getOracleTreeWithCustomOracles
} from '../features/customoracles'
import { cachedDocumentsForPack } from '../features/pack-cache'

import { OracleTableResult } from './oracle-table-result'

declare global {
	interface ChatMessage {
		/** shim for v10; technically, ChatMessage#roll is deprecated, and it just gets ChatMessage#roll[0]. */
		rolls?: Roll[] | null | undefined
	}
}

interface OracleTableDraw extends RollTableDraw {
	roll: Roll
	results: OracleTableResult[]
}
/** Extends FVTT's default RollTable with functionality specific to this system. */
export class OracleTable extends RollTable {
	// missing from the LoFD types package
	declare description: string
	declare draw: (
		options?: RollTable.DrawOptions | undefined
	) => Promise<OracleTableDraw>

	static resultTemplate =
		'systems/foundry-ironsworn/templates/rolls/oracle-roll-message.hbs'

	// TODO: remove the old getFoundryTableByDfId function in favour of this static method
	static async getByDfId(
		dfid: string
	): Promise<StoredDocument<OracleTable> | undefined> {
		const isd = await cachedDocumentsForPack(
			'foundry-ironsworn.ironswornoracles'
		)
		const sfd = await cachedDocumentsForPack(
			'foundry-ironsworn.starforgedoracles'
		)
		const matcher = (x: { id: string }) => x.id === hashLookup(dfid)
		return (isd?.find(matcher) ?? sfd?.find(matcher)) as
			| StoredDocument<OracleTable>
			| undefined
	}

	/** A string representing the path this table in the Ironsworn oracle tree (not including this table) */
	async getDfPath() {
		const starforgedRoot = await getOracleTreeWithCustomOracles('starforged')
		const ironswornRoot = await getOracleTreeWithCustomOracles('ironsworn')
		console.log(starforgedRoot, ironswornRoot)

		const pathElements =
			findPathToNodeByTableUuid(starforgedRoot, this.uuid) ??
			findPathToNodeByTableUuid(ironswornRoot, this.uuid)

		const pathNames = pathElements.map((x) => x.displayName)
		// root node (0) has no display name
		pathNames.shift()
		// last node  is *this* node
		pathNames.pop()

		return pathNames.join(' / ')
	}

	async _prepareTemplateData(results: OracleTableResult[], roll: null | Roll) {
		return {
			// NB: with these options, this is async in v10
			// eslint-disable-next-line @typescript-eslint/await-thenable
			description: await TextEditor.enrichHTML(this.description, {
				documents: true,
				// @ts-expect-error exists in v10
				async: true
			}),
			results: results.map((result) => {
				const r = result.toObject(false)
				r.text = result.getChatText()
				// @ts-expect-error exists in v10
				r.icon = result.icon
				// @ts-expect-error
				r.displayRows = result.displayRows
				return r
			}),
			subtitle: await this.getDfPath(),
			roll: roll?.toJSON(),
			table: this
		}
	}

	override async toMessage(
		results: OracleTableResult[],
		{
			roll = null,
			messageData = {},
			messageOptions = {}
		}: DeepPartial<RollTable.ToMessageOptions> = {}
	) {
		// options for this aren't exposed prior to running the method, so we have to rebuild them from scratch
		// these are loosely based on FVTT v10 RollTable#toMessage

		// TODO This is a fallback to handle tables that can produce multiple results from a single roll, which foundry-ironsworn doesn't presently use. There might be some utility to them doing so, however...
		if (
			results.length > 1 ||
			results.some((result) => !(result instanceof OracleTableResult))
		)
			return await super.toMessage(results, {
				roll,
				messageData,
				// @ts-expect-error
				messageOptions
			})

		const cls = getDocumentClass('ChatMessage')

		const speaker = cls.getSpeaker()

		// Construct chat data
		messageData = foundry.utils.mergeObject(
			{
				user: game.user?.id,
				speaker,
				type:
					roll != null
						? CONST.CHAT_MESSAGE_TYPES.ROLL
						: CONST.CHAT_MESSAGE_TYPES.OTHER,
				roll,
				sound: roll != null ? CONFIG.sounds.dice : null,
				flags: {
					'core.RollTable': this.id,
					'foundry-ironsworn.RollTable': this.uuid
				}
			},
			messageData
		)

		const templateData = await this._prepareTemplateData(results, roll)

		// Render the chat card which combines the dice roll with the drawn results
		messageData.content = await renderTemplate(
			OracleTable.resultTemplate,
			templateData
		)

		// Create the chat message
		return await cls.create(messageData, messageOptions)
	}

	/**
	 * Rerolls an oracle result message, replacing it with the new result
	 */
	static async reroll(messageId: string) {
		const msg = game.messages?.get(messageId)
		if (msg == null) return
		const rollTableUuid = msg.getFlag('foundry-ironsworn', 'RollTable') as
			| string
			| undefined
		const rerolls = (msg.getFlag('foundry-ironsworn', 'rerolls') ??
			[]) as number[]
		if (rollTableUuid == null) return
		const rollTable = (await fromUuid(rollTableUuid)) as OracleTable | undefined

		if (rollTable == null) return
		// defer render to chat so we can manually set the chat message id
		const { results, roll } = await rollTable.draw({ displayChat: false })

		const templateData = await rollTable._prepareTemplateData(results, roll)

		// module: Dice So Nice
		await game.dice3d?.showForRoll(roll, game.user, true)

		await msg.update({
			content: await renderTemplate(OracleTable.resultTemplate, templateData),
			flags: {
				'foundry-ironsworn.rerolls': [...rerolls, roll.total]
			}
		})
	}
}

declare global {
	interface Game {
		// module: Dice So Nice

		dice3d?: {
			/**
			 * Show the 3D Dice animation for the Roll made by the User.
			 *
			 * @param roll - an instance of Roll class to show 3D dice animation.
			 * @param user - the user who made the roll (game.user by default).
			 * @param synchronize - if the animation needs to be shown to other players. Default: false
			 * @param whisper - list of users or userId who can see the roll, set it to null if everyone can see. Default: null
			 * @param blind - if the roll is blind for the current user. Default: false
			 * @param chatMessageID  -A chatMessage ID to reveal when the roll ends. Default: null
			 * @param speaker - An object using the same data schema than ChatSpeakerData. Needed to hide NPCs roll when the GM enables this setting.
			 * @returns {Promise<boolean>} when resolved true if the animation was displayed, false if not.
			 */
			showForRoll: (
				roll: Roll,
				user?: User | null,
				synchronize?: boolean,
				whisper?: Array<string | User>,
				blind?: boolean,
				chatMessageID?: string | null,
				speaker?: ChatSpeakerData
			) => Promise<boolean>
		}
	}
}
