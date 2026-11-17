import {spawnSync} from 'node:child_process';
const npm=process.platform==='win32'?'npm.cmd':'npm';
for(const [script,workspace,extra] of [
 ['db:generate','backend',{}],
 ['build','frontend',{VITE_API_URL:''}],
 ['build','gift-zone-admin',{VITE_API_URL:'',VITE_STORE_URL:'',VITE_ADMIN_BASE_PATH:'/admin/'}]
]) {
 const result=spawnSync(npm,['run',script,'-w',workspace],{stdio:'inherit',env:{...process.env,...extra},shell:process.platform==='win32'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
