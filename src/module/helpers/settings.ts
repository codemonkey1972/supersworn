/* eslint-disable @typescript-eslint/no-extraneous-class */
import { kebabCase, mapValues } from 'lodash-es'
import type { IronswornActor } from '../actor/actor.js'
import { FirstStartDialog } from '../applications/firstStartDialog'
import { SFSettingTruthsDialogVue } from '../applications/vueSfSettingTruthsDialog.js'
import { WorldTruthsDialog } from '../applications/worldTruthsDialog.js'
import * as IronColor from '../features/ironcolor'
import * as IronTheme from '../features/irontheme'

async function closeAllMoveSheets() {
	for (const actor of game.actors?.contents ?? []) {
		await actor.moveSheet?.close()
		actor.moveSheet = undefined
	}
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace ClientSettings {
		/** Settings added here will be automatically typed throughout the game system. */
		interface Values {
			'foundry-supersworn.toolbox':
				| 'ironsworn'
				| 'starforged'
				| 'sunderedisles'
				| 'sheet'

			'foundry-supersworn.theme': keyof typeof IronTheme.THEMES
			'foundry-supersworn.color-scheme': 'zinc' | 'phosphor' | 'oceanic'
			'foundry-supersworn.progress-mark-animation': boolean

			'foundry-supersworn.log-changes': boolean
			'foundry-supersworn.prompt-world-truths': boolean

			'foundry-supersworn.shared-supply': boolean

			'foundry-supersworn.advanced-rolling-default-open': boolean

			'foundry-supersworn.sundered-isles-beta': boolean
			'foundry-supersworn.character-hold': boolean
			'foundry-supersworn.dsn-cinder-wraith': boolean

			// Internal only
			'foundry-supersworn.first-run-tips-shown': boolean
			'foundry-supersworn.data-version': number
		}
	}
}

export class IronswornSettings {
	/**
	 * Returns CSS classes for the current theme and color scheme.
	 */
	static get classes() {
		return [
			`${IronTheme.PREFIX}${kebabCase(IronswornSettings.get('theme'))}`,
			`${IronColor.PREFIX}${kebabCase(IronswornSettings.get('color-scheme'))}`
		]
	}

	/**
	 * Returns an object that represents the current theme.
	 */
	static get theme() {
		return IronTheme.THEMES[IronswornSettings.get('theme')]
	}

	/**
	 * Shorthand getter for the current theme's decorations.
	 */
	static get deco() {
		return IronswornSettings.theme.decoration
	}

	static registerSettings() {
		game.settings.registerMenu('foundry-supersworn', 'first-start-dialog', {
			name: 'IRONSWORN.Settings.ConfigurationDialog.Name',
			label: 'IRONSWORN.Settings.ConfigurationDialog.Label',
			icon: 'fas fa-cog',
			hint: 'IRONSWORN.Settings.ConfigurationDialog.Hint',
			type: FirstStartDialog,
			restricted: true
		})
		game.settings.registerMenu('foundry-supersworn', 'is-truths-dialog', {
			name: 'IRONSWORN.Settings.ISTruthsDialog.Name',
			label: 'IRONSWORN.Settings.ISTruthsDialog.Label',
			icon: 'fas fa-feather',
			hint: 'IRONSWORN.Settings.ISTruthsDialog.Hint',
			type: WorldTruthsDialog,
			restricted: true
		})
		game.settings.registerMenu('foundry-supersworn', 'sf-truths-dialog', {
			name: 'IRONSWORN.Settings.SFTruthsDialog.Name',
			label: 'IRONSWORN.Settings.SFTruthsDialog.Label',
			icon: 'fas fa-feather',
			hint: 'IRONSWORN.Settings.SFTruthsDialog.Hint',
			type: SFSettingTruthsDialogVue,
			restricted: true
		})

		// Toolbox/ruleset. this goes at the top because it's a "showstopper" if folks need it but can't find it.
		game.settings.register('foundry-supersworn', 'toolbox', {
			name: 'IRONSWORN.Settings.Tools.Name',
			hint: 'IRONSWORN.Settings.Tools.Hint',
			scope: 'world',
			config: true,
			type: String,
			choices: {
				sheet: 'IRONSWORN.Settings.Tools.Sheet',
				ironsworn: 'IRONSWORN.Ironsworn',
				starforged: 'IRONSWORN.Starforged',
				sunderedisles: 'IRONSWORN.SunderedIsles'
			},
			default: 'sheet',
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			onChange: closeAllMoveSheets
		})

		// Appearance settings. They're impactful and not especially esoteric/technical, so they come next.
		game.settings.register('foundry-supersworn', 'theme', {
			name: 'IRONSWORN.Settings.Theme.Name',
			hint: 'IRONSWORN.Settings.Theme.Hint',
			scope: 'world',
			config: true,
			type: String,
			choices: mapValues(IronTheme.THEMES, (v) => v.labelKey),
			default: 'ironsworn',
			requiresReload: true
		})
		game.settings.register('foundry-supersworn', 'color-scheme', {
			name: 'IRONSWORN.Settings.ColorScheme.Name',
			hint: 'IRONSWORN.Settings.ColorScheme.Hint',
			scope: 'client',
			config: true,
			type: String,
			choices: {
				zinc: 'IRONSWORN.Settings.ColorScheme.Zinc',
				phosphor: 'IRONSWORN.Settings.ColorScheme.Phosphor',
				oceanic: 'IRONSWORN.Settings.ColorScheme.Oceanic'
			},
			default: 'zinc',
			onChange: IronColor.updateColorScheme
			// TODO: special behaviour for e.g. PopOut module?
		})
		game.settings.register('foundry-supersworn', 'progress-mark-animation', {
			name: 'IRONSWORN.Settings.ProgressMarkAnimation.Name',
			hint: 'IRONSWORN.Settings.ProgressMarkAnimation.Hint',
			scope: 'client',
			type: Boolean,
			default: true,
			config: true,
			requiresReload: true
		})

		// Log verbosity and missed prompts come next.
		game.settings.register('foundry-supersworn', 'log-changes', {
			name: 'IRONSWORN.Settings.LogChanges.Name',
			hint: 'IRONSWORN.Settings.LogChanges.Hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: true
		})
		game.settings.register('foundry-supersworn', 'prompt-world-truths', {
			name: 'IRONSWORN.Settings.PromptTruths.Name',
			hint: 'IRONSWORN.Settings.PromptTruths.Hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: true
		})

		// Changing the supply rule represents a divergence from the ruleset; as 'advanced' behavior it can tolerate living at the end of the list.
		game.settings.register('foundry-supersworn', 'shared-supply', {
			name: 'IRONSWORN.Settings.SharedSupply.Name',
			hint: 'IRONSWORN.Settings.SharedSupply.Hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: true,
			requiresReload: true
		})

		// Default the "advanced" part of the pre-roll dialog to open.
		game.settings.register(
			'foundry-supersworn',
			'advanced-rolling-default-open',
			{
				name: 'IRONSWORN.Settings.AdvancedRollingOpen.Name',
				hint: 'IRONSWORN.Settings.AdvancedRollingOpen.Hint',
				scope: 'world',
				config: true,
				type: Boolean,
				default: false
			}
		)

		game.settings.register('foundry-supersworn', 'sundered-isles-beta', {
			name: 'IRONSWORN.Settings.SunderedIslesBeta.Name',
			hint: 'IRONSWORN.Settings.SunderedIslesBeta.Hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: false,
			requiresReload: true
		})

		game.settings.register('foundry-supersworn', 'character-hold', {
			name: 'IRONSWORN.Settings.CharacterHold.Name',
			hint: 'IRONSWORN.Settings.CharacterHold.Hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: false
		})

		game.settings.register('foundry-supersworn', 'dsn-cinder-wraith', {
			name: 'IRONSWORN.Settings.RollCinderAndWraith.Name',
			hint: 'IRONSWORN.Settings.RollCinderAndWraith.Hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: false
		})

		game.settings.register('foundry-supersworn', 'data-version', {
			scope: 'world',
			config: false,
			type: Number,
			default: 1
		})

		game.settings.register('foundry-supersworn', 'first-run-tips-shown', {
			scope: 'world',
			config: false,
			type: Boolean,
			default: false
		})
	}

	/**
	 * Wraps {@link game.settings.get} (within the `foundry-supersworn` scope) to ensure that Vue always gets the updated value.
	 * @param key The key of the setting within the `foundry-supersworn` scope.
	 */
	static get<K extends string>(
		key: K
	): ClientSettings.Values[`foundry-supersworn.${K}`] {
		return game.settings.get('foundry-supersworn', key)
	}

	static get defaultToolbox(): 'ironsworn' | 'starforged' | 'sunderedisles' {
		const setting = this.get('toolbox')
		if (setting === 'sheet') {
			const sheetClasses = game.settings.get('core', 'sheetClasses')
			const defaultCharacterSheet = sheetClasses.Actor?.character
			// TODO: sundered isles
			if (defaultCharacterSheet === 'ironsworn.SunderedIslesCharacterSheet') {
				return 'sunderedisles'
			}
			if (defaultCharacterSheet === 'ironsworn.IronswornCharacterSheetV2') {
				return 'ironsworn'
			}
			return 'starforged'
		}
		return setting
	}

	/**
	 * Upddate all actors of the provided types with a single data object.
	 * @param data The data to pass to each actor's `update()` method.
	 * @param actorTypes The subtypes of actor to apply the change to.
	 */
	static async updateGlobalAttribute(
		data: Record<string, unknown>,
		actorTypes: Array<IronswornActor['type']> = ['character', 'shared']
	) {
		const actorsToUpdate =
			game.actors?.contents.filter((x) => actorTypes.includes(x.type)) ?? []

		for (const actor of actorsToUpdate) {
			await actor.update(data, {
				suppressLog: true
			} as any)
		}
	}
}
