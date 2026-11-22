import data from './prototype-spec.json'
export type PrototypeSpec=typeof data
export type SpecSection=PrototypeSpec['sections'][number]
export type SpecRequirement=SpecSection['requirements'][number]
export type SpecCase=SpecSection['cases'][number]
export type GuideTopic=keyof PrototypeSpec['topics']
export type GuideTopicConfig={title:string;sectionIds:string[];actionEntries?:Record<string,string[]>;readonly?:boolean}
export type GuideContext={topic:GuideTopic;label?:string;detail?:string;priority?:number}
export const spec=data
