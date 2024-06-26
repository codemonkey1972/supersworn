import type { Plugin } from 'vue'
import { formatRollPlusStat } from '../rolls/ironsworn-roll-message.js'

declare module '@vue/runtime-core' {
	interface ComponentCustomProperties {
		/**
		 * Without a `data` parameter: shortcut for {@link game.i18n.localize}.
		 * With a `data` parameter: shortcut for {@link game.i18n.format}.
		 */
		$t: (stringId: string, data?: Record<string, unknown>) => string
		$concat: (...args: any[]) => string
	}
}

export async function enrichHtml(text) {
	const rendered = await TextEditor.enrichHTML(text, { async: true } as any)
	return rendered.replace(
		/\(\(rollplus (.*?)\)\)/g,
		(_, stat) => `
  <a class="inline-roll" data-param="${stat}">
    <i class="fas fa-dice-d6"></i>
    ${formatRollPlusStat(stat)}
  </a>
`
	)
}

export async function enrichMarkdown(md?: string): Promise<string> {
	if (md == null) return ''

	const html = CONFIG.IRONSWORN.showdown.makeHtml(md)

	return await enrichHtml(html)
}

export const IronswornVuePlugin: Plugin = {
	install(app, ..._options) {
		app.config.globalProperties.$t = (
			stringId: string,
			data?: Record<string, unknown>
		) =>
			data != null
				? game.i18n.format(stringId, data)
				: game.i18n.localize(stringId)
		app.config.globalProperties.$concat = (...args) => args.join('')

		Object.defineProperty(app.config.globalProperties, '$item', {
			get: function () {
				const actorId = this.item?.parent?._id ?? this.actor?._id
				if (actorId) {
					const actor = game.actors?.get(actorId)
					const item = actor?.items.get(this.item._id)
					if (item != null) return item
				}
				return game.items?.get(this.item._id)
			}
		})

		Object.defineProperty(app.config.globalProperties, '$actor', {
			get: function () {
				return game.actors?.get(this.actor?._id)
			}
		})
	}
}
