import { expect,it } from 'vitest';
import { accessoryScale,transformAccessory } from '@/features/piece-design/accessory-transform';

it('resizes a rotated accessory about its centre while preserving its aspect ratio',()=>{
 const frame={x:315,y:285,width:80,height:40,rotation:90};
 const next=transformAccessory(frame,{x:295,y:325},{x:275,y:365},'resize');
 expect(next).toEqual({...frame,width:160,height:80});
});
it('rotation wraps across the angle boundary and can snap without moving the attachment',()=>{
 const frame={x:250,y:270,width:80,height:30,rotation:170};
 const next=transformAccessory(frame,{x:250,y:170},{x:350,y:270},'rotate');
 expect(next).toEqual({...frame,rotation:-100});
 const snap=transformAccessory({...frame,rotation:0},{x:250,y:170},{x:280,y:170},'rotate',true);
 expect(snap.rotation).toBe(15);expect(snap.x).toBe(frame.x);expect(snap.y).toBe(frame.y);
});
it('scaling stops at data limits without stretching a wide logo or a tall pocket',()=>{
 expect(accessoryScale(200,20,2,10,5,300,300)).toEqual({width:300,height:30});
 expect(accessoryScale(20,200,.001,10,5,300,300)).toEqual({width:10,height:100});
 expect(accessoryScale(100,400,20,1,1,3000,3000)).toEqual({width:750,height:3000});
});
