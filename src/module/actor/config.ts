import type { ConfiguredData } from '@league-of-foundry-developers/foundry-vtt-types/src/types/helperTypes'
import { IronswornActor } from './actor'
import type {
	CharacterDataProperties,
	CharacterDataSource
} from './subtypes/character'
import { CharacterModel } from './subtypes/character'
import type { FoeDataProperties, FoeDataSource } from './subtypes/foe'
import { FoeModel } from './subtypes/foe'
import type {
	LocationDataProperties,
	LocationDataSource
} from './subtypes/location'
import { LocationModel } from './subtypes/location'
import type { SharedDataProperties, SharedDataSource } from './subtypes/shared'
import { SharedModel } from './subtypes/shared'
import type { SiteDataProperties, SiteDataSource } from './subtypes/site'
import { SiteModel } from './subtypes/site'
import type {
	StarshipDataProperties,
	StarshipDataSource
} from './subtypes/starship'
import { StarshipModel } from './subtypes/starship'

const dataModels: Record<
	ConfiguredData<'Actor'>['type'],
	typeof foundry.abstract.TypeDataModel<any, any>
> = {
	character: CharacterModel,
	foe: FoeModel,
	location: LocationModel,
	shared: SharedModel,
	site: SiteModel,
	starship: StarshipModel
}

type ActorType = ConfiguredData<'Actor'>['type']
// v11+ uses 'dataModels' instead
type _actorConfig = Omit<(typeof CONFIG)['Actor'], 'systemDataModels'> & {
	dataModels: (typeof CONFIG)['Actor']['systemDataModels']
}

export interface ActorConfig extends _actorConfig {
	dataModels: Record<ActorType, typeof foundry.abstract.TypeDataModel<any, any>>
	typeLabels: Record<ActorType, string>
	typeIcons: Record<ActorType, string>
	trackableAttributes: Record<ActorType, { bar: string[]; value: string[] }>
}

const config: Partial<ActorConfig> = {
	documentClass: IronswornActor,
	dataModels,
	typeLabels: {
		character: 'IRONSWORN.ACTOR.TypeCharacter',
		foe: 'IRONSWORN.ACTOR.TypeFoe',
		location: 'IRONSWORN.ACTOR.TypeLocation',
		shared: 'IRONSWORN.ACTOR.TypeShared',
		site: 'IRONSWORN.ACTOR.TypeDelveSite',
		starship: 'IRONSWORN.ACTOR.TypeStarship'
	},
	typeIcons: {
		character: 'fa-solid fa-user-pen',
		foe: 'fa-solid fa-masks-theater',
		location: 'fa-solid fa-location-dot',
		shared: 'fa-solid fa-people-group',
		site: 'fa-solid fa-dungeon',
		starship: 'fa-solid fa-starship-freighter'
	},
	trackableAttributes: {
		character: {
			bar: ['momentum', 'health', 'spirit', 'supply'],
			value: ['edge', 'heart', 'iron', 'shadow', 'wits']
		},
		foe: { bar: [], value: [] },
		location: { bar: [], value: [] },
		shared: { bar: ['supply'], value: [] },
		site: { bar: [], value: [] },
		starship: { bar: [], value: [] }
	}
}

export default config

export {
	CharacterModel,
	FoeModel,
	LocationModel,
	SharedModel,
	SiteModel,
	StarshipModel
}

export type ActorDataSource =
	| CharacterDataSource
	| SharedDataSource
	| FoeDataSource
	| SiteDataSource
	| StarshipDataSource
	| LocationDataSource
export type ActorDataProperties =
	| CharacterDataProperties
	| SharedDataProperties
	| FoeDataProperties
	| SiteDataProperties
	| StarshipDataProperties
	| LocationDataProperties

declare global {
	interface SourceConfig {
		Actor: ActorDataSource
	}

	interface DataConfig {
		Actor: ActorDataProperties
	}

	interface FlagConfig {
		Actor: {
			core: { sheetClass: string }
			'foundry-supersworn'?: { muteBroadcast?: boolean; 'edit-mode'?: boolean }
		}
	}
}
