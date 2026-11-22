import {computed,inject,onBeforeUnmount,provide,ref,watch,type ComputedRef,type InjectionKey} from 'vue'
import type {GuideContext} from './types'
type GuideBus={set:(owner:symbol,context:GuideContext|null)=>void;remove:(owner:symbol)=>void}
const guideKey:InjectionKey<GuideBus>=Symbol('operation-guide')
export function providePageGuide(base:()=>GuideContext):{context:ComputedRef<GuideContext>;bus:GuideBus}{
 const entries=ref(new Map<symbol,GuideContext>())
 const bus:GuideBus={set(owner,context){if(context)entries.value.set(owner,context);else entries.value.delete(owner)},remove(owner){entries.value.delete(owner)}}
 provide(guideKey,bus)
 return {context:computed(()=>[base(),...entries.value.values()].sort((a,b)=>(b.priority??0)-(a.priority??0))[0]),bus}
}
export function usePageGuide(context:()=>GuideContext|null,providedBus?:GuideBus){
 const bus=providedBus??inject(guideKey),owner=Symbol('guide-owner')
 watch(context,value=>bus?.set(owner,value),{immediate:true,deep:true})
 onBeforeUnmount(()=>bus?.remove(owner))
}
