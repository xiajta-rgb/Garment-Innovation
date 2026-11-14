export type RedesignMethodId='detail-transfer'|'category-transfer'|'replacement'|'silhouette-lock'|'style-combination'|'detail-extension'|'reverse'|'change-form'|'add-part'|'remove-part'|'reduce-decoration'|'reduce-pattern';
export interface RedesignMethod {
 id:RedesignMethodId;name:string;group:'迁移'|'重组'|'生长'|'加减';summary:string;
 sourceBlockId:string;sourceFileId:string;scope:string;implemented:boolean;
}
