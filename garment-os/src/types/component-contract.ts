/** A replacement changes the host interface; an attachment also needs host placement and sewing edges. */
export interface ComponentContract{
  id:string;revision:number;label:string;slot:'sleeve'|'neckline'|'pocket'|'leg-opening';
  mode:'replacement'|'attachment';templateIds:readonly string[];
  stage:'parameterized'|'defined'|'source-conflict';
  hostRoles:readonly string[];componentRoles:readonly string[];
  requiredDimensions:readonly string[];interfaces:readonly string[];
  sourceIds:readonly string[];optionKeys:readonly string[];blockingReasons:readonly string[];
}
