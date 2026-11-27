// Plain JS search: no external services, no dependencies. Keep original recipe text unchanged.
function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function buildIndex(recipes) {
  return recipes.map(r => ({recipe:r, title:normalize(r.title), aliases:normalize(r.aliases.join(' ')), ingredients:normalize(r.ingredients.map(i=>i.display_text).join(' ')), other:normalize([r.description,r.attribution.join(' '),r.category,r.secondary_categories.join(' '),r.instructions].join(' '))}));
}
function search(index, query='', category='') {
  const terms=normalize(query).split(' ').filter(Boolean);
  return index.filter(x=>!category||[x.recipe.category,...x.recipe.secondary_categories].includes(category)).map(x=>{
    let score=0;
    for (const term of terms) {
      const s=x.title.includes(term)?8:x.aliases.includes(term)?6:x.ingredients.includes(term)?4:x.other.includes(term)?1:0;
      if (!s) return null;
      score+=s;
    }
    if(terms.length && x.title===normalize(query)) score+=30;
    return {recipe:x.recipe,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.recipe.title.localeCompare(b.recipe.title)).map(x=>x.recipe);
}

(async () => {
'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(label,cls,fn)=>{const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;};
const home=$('home'), view=$('recipe-view'), error=$('error-view');
let data=window.COOKBOOK_DATA, recipes, index;
try {
  if (!data) {
    $('count').textContent='Loading recipes…';
    const response=await fetch('data/recipes.json', {credentials:'omit'});
    if (!response.ok) throw new Error('Recipe data is unavailable');
    data=await response.json();
  }
  if (data?.schema_version !== 1 || !Array.isArray(data.recipes) || !Array.isArray(data.categories)) {
    throw new Error('Invalid recipe data');
  }
  recipes=data.recipes;
  index=buildIndex(recipes);
} catch {
  home.hidden=true;
  error.className='error-page';
  error.append(el('h1','','Recipes are temporarily unavailable'), el('p','','Please reload the cookbook to try again.'));
  error.hidden=false;
  return;
}
let byId=new Map(recipes.map(r=>[r.id,r]));
const state={query:'',searchSort:'relevance',browseSort:'az',searchLimit:40,browseLimit:40,category:'',mode:'search'};
let oldScroll=0, activeId='', toastTimer, lastHomeHash='#';
const q=$('search'), catButtons=new Map();
const header = document.querySelector('.top');
const compactNav = $('compact-nav');
const categoryHref=c=>'#category/'+encodeURIComponent(c);
function renderCategories(){
 $('category-grid').replaceChildren();catButtons.clear();
 for(const c of data.categories){
 const count=recipes.filter(r=>r.category===c||r.secondary_categories.includes(c)).length;
 if(!count)continue;
 const a=el('a','category-card');a.href=categoryHref(c);
 const details=el('span','category-details');details.append(el('span','cat-name',c),el('span','cat-count',`${count} ${count===1?'recipe':'recipes'}`));
 a.append(details,el('span','arrow','›'));$('category-grid').append(a);catButtons.set(c,a);
}
}
renderCategories();
function recipeHref(r){return '#recipe/'+encodeURIComponent(r.id);}
function setQuery(s){state.query=s;q.value=s;state.searchLimit=40;renderResults();}
function renderHome(){
 const browsing=state.mode==='browse';
 $('home-link').setAttribute('aria-current',browsing?'false':'page');$('category-link').setAttribute('aria-current',browsing?'page':'false');
 $('compact-browse').setAttribute('aria-current',state.mode==='browse'&&!state.category?'page':'false');
 $('search-panel').hidden=browsing;$('categories').hidden=!browsing||!!state.category;
 $('results').hidden=browsing&&!state.category;$('back-categories').hidden=!browsing;
 if(!$('results').hidden)renderResults();
}
function renderResults(){
 const browsing=state.mode==='browse',query=browsing?'':state.query,category=browsing?state.category:'',sort=browsing?state.browseSort:state.searchSort,limit=browsing?state.browseLimit:state.searchLimit;
 $('clear-search').hidden=!state.query;
 let list=search(index,query,category);
 if(sort!=='relevance')list.sort((a,b)=>(sort==='za'?-1:1)*a.title.localeCompare(b.title));
 $('sort').options[0].hidden=browsing||!query.trim();$('sort').value=sort==='relevance'&&!query.trim()?'az':sort;
 $('results-title').textContent=browsing?category:query.trim()?'Search results':'All recipes';
 $('count').textContent=`${list.length} ${list.length===1?'recipe':'recipes'}`+(query.trim()?` matching “${query.trim()}”`:'');
 const grid=$('recipe-grid');grid.replaceChildren();
 for(const r of list.slice(0,limit)){
   const a=el('a','recipe-card');a.href=recipeHref(r);a.addEventListener('click',()=>{oldScroll=window.scrollY;});
   const title=el('h3','',r.title), meta=el('span','recipe-kicker',r.non_food?'Non-food':r.category);
   a.append(title,meta,el('span','arrow','›'));grid.append(a);
 }
 if(!list.length){const empty=el('div','empty');empty.append(el('p','','No recipes match your search.'),button('Clear search','button secondary',()=>{setQuery('');q.focus();}));grid.append(empty);}
 $('more').hidden=list.length<=limit;$('more').textContent=`Show more recipes (${Math.max(0,list.length-limit)} remaining)`;
}
q.addEventListener('input',()=>setQuery(q.value));$('search-form').addEventListener('submit',e=>{e.preventDefault();});$('clear-search').addEventListener('click',()=>{setQuery('');q.focus();});
$('sort').addEventListener('change',e=>{if(state.mode==='browse'){state.browseSort=e.target.value;state.browseLimit=40;}else{state.searchSort=e.target.value;state.searchLimit=40;}renderResults();});
$('more').addEventListener('click',()=>{if(state.mode==='browse')state.browseLimit+=40;else state.searchLimit+=40;renderResults();});
for(const a of document.querySelectorAll('.brand,#home-link,#category-link,#compact-browse'))a.addEventListener('click',()=>{oldScroll=0;if(a.classList.contains('brand')){state.query='';q.value='';state.searchLimit=40;state.searchSort='relevance';}if(location.hash===a.hash||(!location.hash&&a.getAttribute('href')==='#')){if(!view.hidden)return;renderHome();window.scrollTo(0,0);}});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function share(){const url=location.href;if(location.protocol==='file:'){toast('This is a local preview. Share links will work after deployment.');return;}if(navigator.share){navigator.share({title:document.title,url}).catch(e=>{if(e.name!=='AbortError')copyUrl(url);});}else copyUrl(url);}
async function copyUrl(url){try{await navigator.clipboard.writeText(url);toast('Recipe link copied.');}catch{window.prompt('Copy recipe link:',url);}}
function renderRecipe(r){
 view.replaceChildren();document.title=r.title+' | Clark Family Cookbook';
 const head=el('div','recipe-view-head');const back=el('a','back','← Back to recipes');back.href=lastHomeHash;head.append(back,el('p','eyebrow',r.non_food?'FAMILY EXTRAS · NON-FOOD':r.category),el('h1','',r.title));
 if(r.attribution.length)head.append(el('p','byline','From '+r.attribution.join(', ')));if(r.description)head.append(el('p','description',r.description));
 const toolbar=el('div','recipe-toolbar'), metadata=el('div','metadata');for(const text of [r.yield_text,r.time_text].filter(Boolean))metadata.append(el('span','meta',text));
 const actions=el('div','recipe-actions');actions.append(button('Print recipe','button secondary',()=>window.print()),button('Share recipe','button',share));toolbar.append(metadata,actions);head.append(toolbar);
 if(r.source_warning||r.non_food)head.append(el('p','warning',r.source_warning||'Non-food recipe. Not for consumption.'));view.append(head);
 const body=el('div','recipe-body'), panel=el('section','ingredients-panel'), h=el('div','ingredients-head'), progress=el('p','progress-text');const checks=[];
 h.append(el('h2','','Ingredients'),button('Reset','text-button',()=>{checks.forEach(c=>c.checked=false);update();}));panel.append(h,progress);function update(){progress.textContent=`${checks.filter(c=>c.checked).length} of ${checks.length} checked`;}
 for(const i of r.ingredients){if(i.heading){panel.append(el('h3','ingredient-heading',i.display_text));continue;}const label=el('label','ingredient-row'), check=el('input');check.type='checkbox';check.addEventListener('change',update);checks.push(check);label.append(check,el('span','',i.display_text));panel.append(label);}
 if(!checks.length)panel.append(el('p','byline','No ingredients recorded.'));update();
 const directions=el('section');directions.append(el('h2','','Directions'),el('div','directions',r.instructions||'No directions recorded.'));body.append(panel,directions);view.append(body);
}
function route(){
 const hash=location.hash;if(hash==='#admin' && $('admin-view')){home.hidden=true;view.hidden=true;error.hidden=true;return;}let id='';if(hash.startsWith('#recipe/')){try{id=decodeURIComponent(hash.slice(8));}catch{id='invalid';}}
 if(id){home.hidden=true;const r=byId.get(id);view.hidden=!r;error.hidden=!!r;activeId=id;if(r){renderRecipe(r);}else{error.replaceChildren();error.className='error-page';error.append(el('h1','','Recipe not found'),el('p','','This recipe may have been removed or the address may be incorrect.'));const link=el('a','button','Browse recipes');link.href='#';error.append(link);document.title='Recipe not found | Clark Family Cookbook';}window.scrollTo({top:0,behavior:'instant'});return;}
 const previous=lastHomeHash;const returning=!!activeId;let category='';if(hash.startsWith('#category/')){try{category=decodeURIComponent(hash.slice(10));}catch{}if(!catButtons.has(category))category='';}
 state.mode=hash==='#categories'||hash.startsWith('#category/')?'browse':'search';
 if(state.category!==category&&category)state.browseLimit=40;state.category=category;
 lastHomeHash=state.mode==='browse'?(category?categoryHref(category):'#categories'):'#';
 view.hidden=true;error.hidden=true;home.hidden=false;document.title='Clark Family Cookbook';renderHome();
 requestAnimationFrame(()=>window.scrollTo({top:returning&&previous===lastHomeHash?oldScroll:0,behavior:'instant'}));activeId='';
}
// The full navigation yields to the compact bar once it has scrolled away.
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    compactNav.hidden = entry.isIntersecting;
  });
  observer.observe(header);
}

$('compact-search').addEventListener('click', () => {
  if (state.mode === 'browse') {
    history.pushState(null, '', '#');
    route();
  }
  window.scrollTo({top: 0, behavior: 'instant'});
  q.focus({preventScroll: true});
});

$('compact-browse').addEventListener('click', () => {
  $('category-link').focus({preventScroll: true});
});

$('compact-top').addEventListener('click', () => {
  header.querySelector('.brand').focus({preventScroll: true});
  window.scrollTo({top: 0});
});

window.addEventListener('cookbook-preview-update',()=>{recipes=data.recipes;index=buildIndex(recipes);byId=new Map(recipes.map(r=>[r.id,r]));renderCategories();if(location.hash!=='#admin')route();});
window.addEventListener('hashchange',route);route();
})();
