/** One frame per burst of changes, zero frames at rest. */
export function createFrameScheduler(draw:()=>void,request:(callback:FrameRequestCallback)=>number=requestAnimationFrame,cancel:(id:number)=>void=cancelAnimationFrame){
  let pending:number|undefined,disposed=false;
  return {
    invalidate(){if(disposed||pending!==undefined)return;pending=request(()=>{pending=undefined;if(!disposed)draw();});},
    dispose(){disposed=true;if(pending!==undefined)cancel(pending);pending=undefined;},
  };
}
