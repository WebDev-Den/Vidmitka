// Focused final QA for the shell; runs only against an existing isolated browser session.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const [cli,session,widthText,heightText]=process.argv.slice(2);
const width=Number(widthText),height=Number(heightText);
if(!cli||!session||![390,820].includes(width)||![740,844,1000].includes(height))throw new Error('Invalid QA arguments');
const label=`shell-final-${width}-${height}`;
const script=`async(page)=>{
 const results={viewport:{width:${width},height:${height}}};
 const verify=(ok,message)=>{if(!ok)throw new Error(message)};
 const state=()=>page.evaluate(()=>{const s=document.querySelector('.private-sidebar'),r=s.getBoundingClientRect(),n=document.querySelector('.role-navigation'),w=document.querySelector('.private-workspace');return {expanded:document.querySelector('.mobile-menu-button')?.getAttribute('aria-expanded'),inert:w.inert,bodyOverflow:document.body.style.overflow,focusLabel:document.activeElement?.getAttribute('aria-label'),focusInSidebar:s.contains(document.activeElement),scrollTop:s.scrollTop,clientHeight:s.clientHeight,scrollHeight:s.scrollHeight,width:r.width,overflowY:getComputedStyle(s).overflowY,documentOverflow:document.documentElement.scrollWidth>innerWidth,navGap:getComputedStyle(n).gap,linkHeights:Array.from(n.querySelectorAll('a')).map(e=>e.getBoundingClientRect().height),sidebarPadding:getComputedStyle(s).padding}});
 const open=async()=>{await page.getByRole('button',{name:'Відкрити меню',exact:true}).press('Enter');await page.waitForTimeout(250)};
 const closed=async()=>{await page.waitForTimeout(250);const s=await state();verify(s.expanded==='false'&&!s.inert&&s.bodyOverflow!=='hidden'&&s.focusLabel==='Відкрити меню','close did not restore state/focus');return s};
 await page.setViewportSize({width:${width},height:${height}});await page.waitForTimeout(250);await open();
 results.open=await state();verify(results.open.expanded==='true'&&results.open.inert&&results.open.bodyOverflow==='hidden'&&results.open.focusLabel==='Закрити меню','open focus/lock failed');
 const dialog=page.getByRole('dialog',{name:'Навігація кабінету'});verify(await dialog.getAttribute('aria-modal')==='true','dialog semantics');
 await page.screenshot({path:'D:/GItLab/Vidmitka/info/qa/artifacts/QA-20260828-01/${label}-top.png'});
 const first=dialog.getByRole('link').first(),last=dialog.getByRole('link',{name:'Налаштування',exact:true});
 await first.focus();await page.keyboard.press('Shift+Tab');verify(await last.evaluate(e=>e===document.activeElement),'reverse trap failed');
 await page.keyboard.press('Tab');verify(await first.evaluate(e=>e===document.activeElement),'forward trap failed');
 results.trap={forward:true,reverse:true};
 const scrollBefore=await page.evaluate(()=>scrollY);await page.mouse.move(${width-10},${height-50});await page.mouse.wheel(0,400);await page.waitForTimeout(150);verify(await page.evaluate(()=>scrollY)===scrollBefore,'background moved');results.backgroundWheelLocked=true;
 await page.mouse.move(180,${height-80});await page.mouse.wheel(0,1100);await page.waitForTimeout(250);results.scrolled=await state();
 verify(results.scrolled.linkHeights.every(h=>h>=44),'navigation controls compressed');verify(!results.scrolled.documentOverflow,'document overflow');
 verify(results.scrolled.scrollHeight<=results.scrolled.clientHeight||results.scrolled.scrollTop>0,'sidebar does not scroll');
 results.settingsRect=await last.boundingBox();verify(results.settingsRect.y>=0&&results.settingsRect.y+results.settingsRect.height<=${height},'settings outside viewport after wheel');
 await page.screenshot({path:'D:/GItLab/Vidmitka/info/qa/artifacts/QA-20260828-01/${label}-scrolled.png'});
 await page.keyboard.press('Escape');results.escape=await closed();
 await open();await page.getByRole('dialog').getByRole('button',{name:'Закрити меню',exact:true}).click();results.closeButton=await closed();
 await open();await page.mouse.click(${width-10},${Math.floor(height/2)});results.backdrop=await closed();
 await open();await page.getByRole('dialog').getByRole('link',{name:'Налаштування',exact:true}).click();await page.waitForURL('**/dashboard/settings');results.settingsNavigation=await closed();
 await open();await page.getByRole('dialog').getByRole('link',{name:'Пари та час',exact:true}).click();await page.waitForURL('**/dashboard/periods');results.periodsNavigation=await closed();
 await open();await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(300);results.desktopResize=await state();verify(results.desktopResize.expanded==='false'&&!results.desktopResize.inert&&results.desktopResize.bodyOverflow!=='hidden','desktop resize leaked lock');verify(await page.getByRole('dialog').count()===0,'dialog role leaked');
 await page.setViewportSize({width:${width},height:${height}});await page.waitForTimeout(250);results.mobileReturn=await state();verify(results.mobileReturn.expanded==='false'&&!results.mobileReturn.inert,'mobile return leaked state');
 return results;
}`;
let output;
try {output=execFileSync(process.execPath,[cli,`-s=${session}`,'run-code',script],{encoding:'utf8',windowsHide:true});}
catch(error){output=String(error.stdout||error.message);writeFileSync(`info/qa/artifacts/QA-20260828-01/${label}.txt`,output);throw error;}
writeFileSync(`info/qa/artifacts/QA-20260828-01/${label}.txt`,output);
const result=JSON.parse(output.split('### Result\n')[1].split('\n###')[0].trim());
console.log(JSON.stringify({label,pass:true,open:result.open,scrolled:result.scrolled,settingsRect:result.settingsRect,trap:result.trap,desktopResize:result.desktopResize},null,2));
