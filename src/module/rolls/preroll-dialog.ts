import { IMoveTrigger } from 'dataforged'
import type { RollMethod } from 'dataforged'
import { capitalize, cloneDeep, maxBy, minBy, sortBy } from 'lodash'
import { IronswornActor } from '../actor/actor'
import { getFoundryMoveByDfId } from '../dataforged'
import { IronswornSettings } from '../helpers/settings'
import { IronswornItem } from '../item/item'
import { SFMoveDataProperties } from '../item/itemtypes'
import {
  IronswornRoll,
  PreRollOptions,
  RollOutcome,
  SourcedValue,
} from './ironsworn-roll'
import { renderRollGraphic } from './roll-graphic'
import { CharacterDataProperties } from '../actor/actortypes'
import { IronswornRollMessage } from '.'
import { formatRollPlusStat } from './ironsworn-roll-message.js'
import { ChallengeResolutionDialog } from './challenge-resolution-dialog'

export function localeCapitalize(str: string) {
  const locale = game.i18n.lang
  return str[0].toLocaleUpperCase(locale) + str.slice(1)
}

function rollableOptions(trigger: IMoveTrigger) {
  if (!trigger.Options) return []

  const actionOptions = trigger.Options.filter(
    (x) => x['Roll type'] === 'Action roll'
  )
  if (!actionOptions.length) return []

  const allowedUsings = [
    'edge',
    'iron',
    'heart',
    'shadow',
    'wits',
    'health',
    'spirit',
    'supply',
  ]
  return actionOptions.filter((x) =>
    (x.Using as string[]).every((u) => allowedUsings.includes(u.toLowerCase()))
  )
}

export function moveHasRollableOptions(move: IronswornItem) {
  if (move.type !== 'sfmove') return false
  const data = move.data as SFMoveDataProperties
  const options = rollableOptions(data.data.Trigger)
  return options.length > 0
}

function chooseStatToRoll(
  mode: RollMethod,
  stats: string[],
  actor: IronswornActor
): SourcedValue {
  const normalizedStats = stats.map((x) => x.toLowerCase())
  let stat = normalizedStats[0]

  if (mode === 'Highest' || mode === 'Lowest') {
    const statMap = {}
    for (const x of normalizedStats) {
      statMap[x] = actor.data.data[x]
    }
    const fn = mode === 'Highest' ? maxBy : minBy
    stat = fn(Object.keys(statMap), (x) => statMap[x]) ?? stats[0]
  } else if (mode !== 'Any') {
    // TODO: 'all of'
    throw new Error(`Cannot handle rolling with '${mode}' mode`)
  }

  const source = game.i18n.localize(`IRONSWORN.${capitalize(stat)}`)
  return { source, value: actor.data.data[stat] }
}

/**
 * Parses a checkbox form element value into a boolean.
 * @param value the checkbox value to be parsed
 */
function parseCheckbox(value?: string) {
  switch (value) {
    case 'on':
      return true
    case 'off':
    default:
      return false
  }
}

function prerollOptionsWithFormData(
  form: JQuery<HTMLFormElement>,
  base: PreRollOptions
): PreRollOptions {
  const opts = cloneDeep(base)
  type ValueMap = Record<string, boolean | number> & {
    adds?: number
    automaticOutcomeValue?: number
    extraChallengeDiceValue?: number
    presetActionDieValue?: number
    automaticOutcome?: boolean
    extraChallengeDice?: boolean
    presetActionDie?: boolean
  }

  const valMap: ValueMap = form
    .serializeArray()
    .reduce((coll, { name, value }) => {
      if (name == 'adds' || name.endsWith('Value')) {
        return { ...coll, [name]: parseInt(value, 10) }
      }
      return { ...coll, [name]: parseCheckbox(value) }
    }, {})

  opts.adds = valMap.adds

  if (valMap.automaticOutcome) {
    opts.automaticOutcome = {
      source: 'set manually',
      value: valMap.automaticOutcomeValue as RollOutcome,
    }
  }
  if (valMap.presetActionDie) {
    opts.presetActionDie = {
      source: 'set manually',
      value: valMap.presetActionDieValue as number,
    }
  }
  if (valMap.extraChallengeDice) {
    opts.extraChallengeDice = {
      source: 'set manually',
      value: valMap.extraChallengeDiceValue as number,
    }
  }
  return opts
}

export class IronswornPrerollDialog extends Dialog<
  PreRollOptions & DialogOptions
> {
  prerollOptions: PreRollOptions = {}

  constructor(
    pro: PreRollOptions,
    data: Dialog.Data,
    options?: Partial<DialogOptions>
  ) {
    super(data, options)
    this.prerollOptions = pro
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['ironsworn', 'dialog', `theme-${IronswornSettings.theme}`],
      width: 500,
    })
  }

  static async showForStat(
    name: string,
    value: number,
    actor?: IronswornActor
  ) {
    let statText = game.i18n.localize(`IRONSWORN.${capitalize(name)}`)
    if (statText.startsWith('IRONSWORN.')) statText = name
    const title = formatRollPlusStat(name)

    const prerollOptions: PreRollOptions = {
      stat: {
        source: name,
        value,
      },

      actorId: actor?.id || undefined,
    }

    const content = await this.renderContent({
      prerollOptions,
      action: true,
    })
    const buttons = {
      [name]: {
        label: `<span class=button-text>${statText}</span>`,
        icon: '<i class="isicon-d10-tilt juicy"></i>',
        callback: (el: HTMLElement | JQuery<HTMLElement>) => {
          IronswornPrerollDialog.submitRoll(el, prerollOptions)
        },
      },
    }
    return new IronswornPrerollDialog(prerollOptions, {
      title,
      content,
      buttons,
      default: name,
    }).render(true)
  }

  static async showForProgress(
    name: string,
    value: number,
    actor?: IronswornActor
  ) {
    const rollText = game.i18n.localize('IRONSWORN.ProgressRoll')
    const title = `${rollText}: ${name}`

    const prerollOptions: PreRollOptions = {
      progress: {
        source: name,
        value,
      },

      actorId: actor?.id || undefined,
    }

    const content = await this.renderContent({ prerollOptions })
    const buttons = {
      [name]: {
        label: `<span class=button-text>${game.i18n.localize(
          'IRONSWORN.Roll'
        )}</span>`,
        icon: '<i class="isicon-d10-tilt juicy"></i>',
        callback: (el: HTMLElement | JQuery<HTMLElement>) => {
          IronswornPrerollDialog.submitRoll(el, prerollOptions)
        },
      },
    }
    return new IronswornPrerollDialog(prerollOptions, {
      title,
      content,
      buttons,
      default: name,
    }).render(true)
  }

  static async showForOfficialMove(moveDfId: string, actor?: IronswornActor) {
    const moveItem = await getFoundryMoveByDfId(moveDfId)
    if (!moveItem) {
      throw new Error(`Couldn't find item for move '${moveDfId}'`)
    }

    return this.showForMoveItem(moveItem, { moveDfId }, actor)
  }

  static async showForMove(move: IronswornItem, actor?: IronswornActor) {
    if (move.type !== 'sfmove') {
      throw new Error('this only works with SF moves')
    }

    return this.showForMoveItem(move, { moveId: move.id || undefined }, actor)
  }

  private static async showForMoveItem(
    move: IronswornItem,
    prerollOptions: PreRollOptions,
    actor?: IronswornActor
  ) {
    prerollOptions.actorId = actor?.id || undefined

    const data = move.data as SFMoveDataProperties
    const options = rollableOptions(data.data.Trigger)
    if (!options.length) {
      throw new Error(
        `Move '${move.name}' (${JSON.stringify(
          prerollOptions
        )}) is not rollable`
      )
    }

    const title = move.name || 'MOVE'
    const allActors = [] as IronswornActor[]
    if (actor?.type === 'character') {
      allActors.push(actor)
    } else {
      allActors.push(
        ...sortBy(
          game.actors?.filter((x) => x.type === 'character'),
          'name'
        )
      )
    }
    const showActorSelect = allActors.length > 1

    const content = await this.renderContent({
      prerollOptions,
      move,
      actor,
      allActors,
      showActorSelect,
      action: true,
    })
    const buttons = {}
    const addButton = (i: number, mode: RollMethod, stats: string[]) => {
      // TODO: i18n
      const label = mode === 'Any' ? stats[0] : `${mode} of ${stats.join(', ')}`

      buttons[i.toString()] = {
        // use the below instead as a silly method for sneaking classes in
        // buttons[
        //   kebabCase(label) + ' clickable isicon-d10-tilt juicy icon-button'
        // ] = {
        label: `<span class=button-text>${label}</span>`,
        icon: '<i class="isicon-d10-tilt juicy"></i>',
        callback: (el: JQuery<HTMLElement>) => {
          let rollingActor: IronswornActor
          if (allActors.length === 1) {
            rollingActor = allActors[0]
          } else {
            // Get the selected actor from the dialog
            const actorId = el.find('#char').val() as string
            rollingActor = game.actors?.get(actorId)!
          }

          // Set up for the roll
          const actorData = rollingActor.data as CharacterDataProperties
          prerollOptions.momentum = actorData.data.momentum
          prerollOptions.stat = chooseStatToRoll(mode, stats, rollingActor)

          IronswornPrerollDialog.submitRoll(el, prerollOptions)
        },
      }
    }

    for (let i = 0; i < options.length; i++) {
      const option = options[i]
      addButton(i, option.Method, option.Using)
    }

    return new IronswornPrerollDialog(prerollOptions, {
      title,
      content,
      buttons,
      default: '0',
    }).render(true)
  }

  private static async submitRoll(
    el: HTMLElement | JQuery<HTMLElement>,
    opts: PreRollOptions
  ) {
    const realOpts = prerollOptionsWithFormData($(el).find('form'), opts)

    const r = new IronswornRoll(realOpts)
    const msg = new IronswornRollMessage(r)
    await msg.createOrUpdate()

    // Show resolution dialog if needed
    if (r.preRollOptions.extraChallengeDice) {
      ChallengeResolutionDialog.showForMessage(msg.roll.chatMessageId ?? '')
    }
  }

  private static async renderContent(data: {
    prerollOptions: PreRollOptions
    move?: IronswornItem
    actor?: IronswornActor
    allActors?: IronswornActor[]
    showActorSelect?: boolean
    action?: boolean
  }): Promise<string> {
    const graphic = await renderRollGraphic({
      preRollOptions: data.prerollOptions,
    })
    const template =
      'systems/foundry-ironsworn/templates/rolls/preroll-dialog.hbs'
    return renderTemplate(template, { ...data, graphic })
  }

  activateListeners(html: JQuery<HTMLElement>): void {
    super.activateListeners(html)

    // Resize when expanding the "advanced" section
    html.find('details').on('toggle', (ev) => {
      const delta = (ev.currentTarget.open ? 1 : -1) * 90
      const app = html.parents('.app')
      app.height((app.height() ?? 0) + delta)
    })

    // Re-render the graphic when controls change
    const rerender = async () => {
      const pro = prerollOptionsWithFormData(
        this.element.find('form'),
        this.prerollOptions
      )
      const graphic = await renderRollGraphic({ preRollOptions: pro })
      this.element.find('.roll-graphic').replaceWith(graphic)
    }
    html.find('input').on('change', rerender)
    html.find('select').on('change', rerender)
  }
}