export function canRemoveCoordinator(actor:any,target:any):boolean {
 return !!actor?.id&&!!target?.id&&actor.id!==target.id&&actor.status==='Active'&&['Administrator','Admin'].includes(actor.role)&&target.role==='Coordinator';
}
