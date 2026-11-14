import { create } from 'zustand';

export const useCompositionUiStore=create<{
 active:boolean;templateId:string|null;setActive:(active:boolean)=>void;selectTemplate:(id:string)=>void;
}>()(set=>({active:false,templateId:null,setActive:active=>set({active}),selectTemplate:templateId=>set({templateId})}));
