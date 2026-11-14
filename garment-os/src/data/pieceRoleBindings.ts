import type { PieceSourceRoleBinding } from '@/types/piece-taxonomy';
import { requirePieceRole } from './pieceTaxonomy';
/** Exact source identity. No guessed role from name substrings or point proximity. */
export const SOURCE_PIECE_ROLES:Record<string,PieceSourceRoleBinding> = {
  'paco.front':{role:'trouser.front',material:'fabric'},'paco.back':{role:'trouser.back',material:'fabric'},'paco.waistband':{role:'waistband.casing',material:'fabric'},
  'sandy.skirt':{role:'skirt.gore',material:'fabric'},'sandy.waistband':{role:'waistband.outer',material:'fabric'},
  'aaron.front':{role:'body.front',material:'fabric'},'aaron.back':{role:'body.back',material:'fabric'},
  'aaron.neckBinding':{role:'binding.neck',material:'fabric',cutMode:'source-net-as-cut'},'aaron.armBinding':{role:'binding.armhole',material:'fabric',cutMode:'source-net-as-cut'},
  'huey.front':{role:'body.front',material:'fabric'},'huey.back':{role:'body.back',material:'fabric'},'huey.sleeve':{role:'sleeve.main',material:'fabric'},
  'huey.hood':{role:'hood.side',material:'fabric'},'huey.pocket':{role:'pocket.patch',material:'fabric'},
  'huey.cuff':{role:'cuff.rib',material:'ribbing'},'huey.waistband':{role:'hem-band.rib',material:'ribbing'},
  'brian.front':{role:'body.front',material:'fabric'},'brian.back':{role:'body.back',material:'fabric'},'library.sleeve':{role:'sleeve.main',material:'fabric'},
  'teagan.front':{role:'body.front',material:'fabric'},'teagan.back':{role:'body.back',material:'fabric'},'teagan.sleeve':{role:'sleeve.main',material:'fabric'},
  'sven.front':{role:'body.front',material:'fabric'},'sven.back':{role:'body.back',material:'fabric'},'sven.sleeve':{role:'sleeve.main',material:'fabric'},
  'simon.frontLeft':{role:'body.front',material:'fabric'},'simon.frontRight':{role:'body.front',material:'fabric'},'simon.back':{role:'body.back',material:'fabric'},
  'simon.yoke':{role:'yoke.back',material:'fabric'},'simon.sleeve':{role:'sleeve.main',material:'fabric'},
  'simon.collar':{role:'collar.unsplit-pair',material:'fabric'},'simon.collarStand':{role:'collar.stand',material:'fabric'},'simon.cuff':{role:'cuff.barrel',material:'fabric'},
  'simon.sleevePlacketOverlap':{role:'placket.sleeve-overlap',material:'fabric'},'simon.sleevePlacketUnderlap':{role:'placket.sleeve-underlap',material:'fabric'},
};
export function requireSourcePieceRole(sourceId:string){
  const binding=SOURCE_PIECE_ROLES[sourceId];if(typeof binding?.role!=='string')throw new Error(`源裁片缺少明确分类：${sourceId}`);
  return {...binding,definition:requirePieceRole(binding.role)};
}
