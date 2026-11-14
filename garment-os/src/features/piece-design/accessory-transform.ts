export type AccessoryGestureMode = 'move'|'resize'|'rotate';
export interface AccessoryFrame {x:number;y:number;width:number;height:number;rotation:number}
export interface AccessoryPoint {x:number;y:number}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** Pointer positions use the view's coordinates; dimensions scale about the centre. */
export function transformAccessory(frame:AccessoryFrame,start:AccessoryPoint,point:AccessoryPoint,mode:AccessoryGestureMode,snap=false):AccessoryFrame {
 if(mode==='move')return {...frame,x:frame.x+point.x-start.x,y:frame.y+point.y-start.y};
 const ax=start.x-frame.x,ay=start.y-frame.y,bx=point.x-frame.x,by=point.y-frame.y;
 if(mode==='rotate'){
  let degrees=frame.rotation+(Math.atan2(by,bx)-Math.atan2(ay,ax))*180/Math.PI;
  if(snap)degrees=Math.round(degrees/15)*15;
  return {...frame,rotation:((degrees+180)%360+360)%360-180};
 }
 const ratio=clamp((ax*bx+ay*by)/(ax*ax+ay*ay||1),.02,100);
 return {...frame,width:frame.width*ratio,height:frame.height*ratio};
}

/** Keep aspect ratio when either dimension reaches a valid data limit. */
export function accessoryScale(width:number,height:number,ratio:number,minWidth:number,minHeight:number,maxWidth:number,maxHeight:number){
 const scale=clamp(ratio,Math.max(minWidth/width,minHeight/height),Math.min(maxWidth/width,maxHeight/height));
 return {width:width*scale,height:height*scale};
}
