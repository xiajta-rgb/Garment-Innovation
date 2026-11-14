import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManagedMaterialLibrary } from '@/features/asset-library/ManagedMaterialLibrary';
import { MaterialImage, MaterialImagePreview } from '@/features/asset-library/MaterialImage';
import { invalidateMaterialHome, loadMaterialHome } from '@/features/asset-library/managed-material-browser';
import type { ManagedMaterial, MaterialPage } from '@/types/managed-material';

const fabric:ManagedMaterial={materialId:'100',materialCode:'TEST-PICTURE',materialName:'测试面料',materialPic:'https://example.com/fabric.jpg',status:0,materialType:'M'};
const home:MaterialPage={items:[{...fabric,materialId:'101',materialCode:'TEST-NO-PICTURE',materialPic:null},fabric],pageNo:1,pageSize:25,total:null,mayHaveNext:false,fetchedAt:'2026-11-12T10:00:00Z',endpoint:'https://example.com/mcp'};
const mockApi=()=>vi.fn(async(path:string)=>new Response(JSON.stringify(path.endsWith('/connection')?{configured:true,endpoint:home.endpoint}:home),{status:200,headers:{'Content-Type':'application/json'}}));
beforeEach(()=>invalidateMaterialHome());
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});

it('auto-loads only one bounded page in StrictMode and reuses it on navigation; local image filters do not query',async()=>{
  const fetcher=mockApi();vi.stubGlobal('fetch',fetcher);
  const {container,unmount}=render(<StrictMode><ManagedMaterialLibrary/></StrictMode>);
  await waitFor(()=>expect(container.querySelectorAll('[data-managed-material-id]')).toHaveLength(2));
  expect(container.querySelector('[data-managed-material-id]')).toHaveAttribute('data-managed-material-id','100');
  const queries=()=>fetcher.mock.calls.filter(([p])=>p==='/api/materials');expect(queries()).toHaveLength(1);
  fireEvent.click(screen.getByLabelText('仅看本页有图'));
  expect(container.querySelectorAll('[data-managed-material-id]')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'列表'}));
  expect(container.querySelector('table img')).toHaveAttribute('src',fabric.materialPic);expect(queries()).toHaveLength(1);
  unmount();render(<ManagedMaterialLibrary/>);await screen.findByText(/本页 2 条 · 1 条提供图片/);expect(queries()).toHaveLength(1);
});

it('an in-flight home read cannot replace a newer explicit query',async()=>{
  let resolveHome!:(v:Response)=>void;const delayed=new Promise<Response>(resolve=>{resolveHome=resolve;});
  let calls=0;
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>{
    if(path.endsWith('/connection'))return new Response(JSON.stringify({configured:true,endpoint:home.endpoint}));
    if(++calls===1)return delayed;
    return new Response(JSON.stringify({...home,items:[{...fabric,materialId:'102',materialCode:'NEW-QUERY'}]}));
  }));
  const {container}=render(<ManagedMaterialLibrary/>);await screen.findByText('正在读取面料管理…');
  fireEvent.change(screen.getByLabelText('面料编码查询'),{target:{value:'NEW-QUERY'}});fireEvent.click(screen.getByRole('button',{name:'查询面料'}));
  await waitFor(()=>expect(container.querySelector('[data-managed-material-id]')).toHaveAttribute('data-managed-material-id','102'));
  await act(async()=>resolveHome(new Response(JSON.stringify(home))));
  expect(container.querySelector('[data-managed-material-id]')).toHaveAttribute('data-managed-material-id','102');
});

it('failed home reads can retry without poisoning the cache',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:'当前账号没有面料查询权限。'}),{status:403})).mockResolvedValueOnce(new Response(JSON.stringify(home)));
  vi.stubGlobal('fetch',fetcher);await expect(loadMaterialHome(home.endpoint)).rejects.toThrow('权限');expect(await loadMaterialHome(home.endpoint)).toEqual(home);expect(fetcher).toHaveBeenCalledTimes(2);
});

it('keeps missing, loading and failed source images distinct and allows a retry',()=>{
  const {unmount}=render(<MaterialImage material={{...fabric,materialPic:null}}/>);expect(screen.getByText('暂无来源图片')).toBeInTheDocument();expect(screen.queryByRole('img')).toBeNull();unmount();
  render(<MaterialImage material={fabric}/>);expect(screen.getByText('图片加载中…')).toBeInTheDocument();fireEvent.error(screen.getByRole('img'));expect(screen.getByText('图片加载失败')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'重试图片'}));fireEvent.load(screen.getByRole('img'));expect(screen.queryByText('图片加载失败')).toBeNull();expect(screen.getByRole('img')).toHaveAttribute('src',fabric.materialPic);
});

it('preview uses source pixels, supports 100 percent zoom and closes on Escape',()=>{
  Object.defineProperties(HTMLDialogElement.prototype,{showModal:{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}},close:{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}}});
  try{
  const close=vi.fn();render(<MaterialImagePreview material={fabric} onClose={close}/>);
  const img=screen.getByRole('img');Object.defineProperties(img,{naturalWidth:{value:7008},naturalHeight:{value:4672}});fireEvent.load(img);
  expect(screen.getByText(/7008 × 4672 像素/)).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'100%'}));expect(img).toHaveStyle({width:'7008px',height:'4672px'});
  expect(screen.getByRole('link',{name:/打开来源原图/})).toHaveAttribute('href',fabric.materialPic);
  fireEvent(screen.getByRole('dialog'),new Event('cancel',{bubbles:true,cancelable:true}));expect(close).toHaveBeenCalledTimes(1);
  }finally{cleanup();Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal');Reflect.deleteProperty(HTMLDialogElement.prototype,'close');}
});
