/** Print connection status only; credentials and access tokens remain in memory. */
import {createServer,loadEnv} from 'vite';
import {spawn} from 'node:child_process';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {readCredentials}=await server.ssrLoadModule('/server/ais-style-provider.ts'),credentials=readCredentials(process.env,loadEnv('development',process.cwd(),'GARMENTOS_AIS_').GARMENTOS_AIS_ENV_FILE);
 if(!credentials)throw Error('Missing configured account');
 const quote=s=>'"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r')+'"';
 const child=spawn('curl.exe',['--silent','--show-error','--max-time','25','--config','-'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stdin.end('url = '+quote('https://lasen.cc/admin-api/system/auth/login')+'\nrequest = "POST"\nheader = "Content-Type: application/json"\ndata-binary = '+quote(JSON.stringify(credentials))+'\n');
 let output='',error='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);const code=await new Promise(r=>child.on('close',r));
 if(code!==0){console.log(JSON.stringify({connected:false,transport:'curl',code,error:error.slice(0,200)}));process.exitCode=1;}
 else{const value=JSON.parse(output);console.log(JSON.stringify({connected:value.code===0&&!!value.data?.accessToken,transport:'curl',businessCode:value.code}));}
}finally{await server.close();}
