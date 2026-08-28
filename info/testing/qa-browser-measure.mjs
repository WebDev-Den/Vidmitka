// Browser layout evidence. Arguments: Playwright CLI JavaScript path, session, artifact label.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [binary, session, label] = process.argv.slice(2);
if (!binary || !session || !/^[a-z0-9-]+$/.test(label)) throw new Error('Expected binary, session and safe artifact label');
const run = (...args) => execFileSync(process.execPath, [binary,`-s=${session}`,...args], {encoding:'utf8',windowsHide:true});
const dir='info/qa/artifacts/QA-20260828-01'; mkdirSync(dir,{recursive:true});
const measure = `JSON.stringify((()=>{const d=document.documentElement;const selectors=['.public-header-inner','.day-timeline','.hero-content','.schedule-preview','.upcoming-lesson','.private-content','.private-sidebar','.role-navigation','.auth-card','.auth-form','.lesson-editor','.makeup-days-manager','.subject-create-form','.lesson-type-toggle','.period-create-form','.period-fields','.period-row','.schedule-table-wrap','.journal-table'];return {url:location.pathname,viewport:innerWidth,scrollWidth:d.scrollWidth,clientWidth:d.clientWidth,overflow:d.scrollWidth>d.clientWidth,bodyBackground:getComputedStyle(document.body).backgroundColor,areas:selectors.flatMap(s=>Array.from(document.querySelectorAll(s)).slice(0,3).map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {selector:s,x:r.x,y:r.y,width:r.width,height:r.height,padding:c.padding,gap:c.gap,margin:c.margin,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}})),controls:Array.from(document.querySelectorAll('button,input:not([type=hidden]),select,summary')).filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,name:e.getAttribute('aria-label')||e.name||e.innerText?.slice(0,70),width:r.width,height:r.height,disabled:e.disabled}})}})())`;
const script = `async (page) => { const results=[]; for(const width of [1440,820,390]) {await page.setViewportSize({width,height:1000}); await page.waitForTimeout(250); results.push(JSON.parse(await page.evaluate(()=>${measure}))); await page.screenshot({path:'D:/GItLab/Vidmitka/${dir}/${label}-'+width+'.png',fullPage:true});} await page.setViewportSize({width:1440,height:1000}); return results; }`;
const output=run('run-code',script);
writeFileSync(`${dir}/${label}-measurements.txt`,output);
writeFileSync(`${dir}/${label}-console.txt`,run('console'));
const result=JSON.parse(output.split('### Result\n')[1].split('\n###')[0].trim());
console.log(JSON.stringify(result.map(r=>({page:r.url,viewport:r.viewport,overflow:r.overflow,scrollWidth:r.scrollWidth})),null,2));
