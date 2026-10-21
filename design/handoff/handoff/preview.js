// 示意用：以 2026-10-20 資料填入模板，正式程式請自行取代。
(function(){
var I='assets/icons/', AZ=254;
var ST={sea:'看得到落日到海平面',blocked:'落日會提早落到山稜或建築後',afterglow:'只看得到晚霞'};
var TT={poor:'Poor',fair:'Fair',good:'Good',great:'Great',nodata:'暫無分數'};
var FLAT='晴空無雲，天空顏色會比較單調';
var W={tamsui:{wx:'晴',temp:'29°C',pop:'10%',window:'17:11–17:53'},taipei:{wx:'晴',temp:'31°C',pop:'0%',window:'17:11–17:52'},taoyuan:{wx:'晴',temp:'29°C',pop:'0%',window:'17:12–17:54'}};
var regions=[{name:'淡水河口',tier:'fair',q:'37%',r:'tamsui'},{name:'台北盆地',tier:'fair',q:'36%',r:'taipei'},{name:'桃園海岸',tier:'fair',q:'36%',r:'taoyuan'}];
var spots=[
 {id:'fisherman',name:'漁人碼頭',lat:25.1830,lng:121.4110,status:'sea',q:'38%',r:'tamsui',spread:34,cams:1},
 {id:'xucuo',name:'許厝港觀景台',lat:25.0880,lng:121.1850,status:'sea',q:'37%',r:'taoyuan',spread:40,cams:1},
 {id:'datun',name:'大屯山觀景台',lat:25.1760,lng:121.5220,status:'sea',q:'34%',r:'tamsui',spread:44,cams:1,fav:1,extra:'山頂視野可能受雲層干擾'},
 {id:'golden',name:'淡水金色水岸',lat:25.1690,lng:121.4420,status:'blocked',q:'35%',r:'tamsui',spread:24,cams:2,fav:1},
 {id:'dadaocheng',name:'大稻埕碼頭',lat:25.0565,lng:121.5085,status:'blocked',q:'33%',r:'taipei',spread:22,cams:2,fav:1,camLabel:1},
 {id:'bishan',name:'內湖碧山巖',lat:25.0950,lng:121.5860,status:'blocked',q:'31%',r:'taipei',spread:28,cams:0},
 {id:'warship',name:'軍艦岩',lat:25.1245,lng:121.5185,status:'blocked',q:'32%',r:'taipei',spread:30,cams:1},
 {id:'jiantan',name:'劍潭山微風平台',lat:25.0880,lng:121.5300,status:'blocked',q:'30%',r:'taipei',spread:24,cams:0},
 {id:'elephant',name:'象山',lat:25.0275,lng:121.5765,status:'blocked',q:'29%',r:'taipei',spread:26,cams:1}];
var byId={};
spots.forEach(function(s){Object.assign(s,W[s.r]);s.tier='fair';s.flags=[FLAT].concat(s.extra?[s.extra]:[]);byId[s.id]=s;});
regions.forEach(function(g){Object.assign(g,W[g.r]);g.flags=[FLAT];});

var mode=location.hash.slice(1);
if(mode==='states'){
  Object.assign(byId.fisherman,{tier:'great',q:'66%',flags:['西方有高雲，晚霞機率高','雲底可能被染成橘紅']});
  Object.assign(regions[0],{tier:'great',q:'64%',flags:['西方有高雲，晚霞機率高']});
  Object.assign(byId.xucuo,{vetoed:1,wx:'陣雨',temp:'26°C',pop:'60%',flags:['降雨機率高，不建議出門']});
  Object.assign(regions[2],{vetoed:1,q:'12%',wx:'陣雨',temp:'26°C',pop:'60%',flags:['降雨機率高，不建議出門']});
  Object.assign(byId.bishan,{tier:'nodata',q:'—',flags:['無法取得資料']});
  document.getElementById('banner').hidden=false;
}
[regions,spots].forEach(function(a){a.forEach(function(d){d.tierText=d.vetoed?'不建議':TT[d.tier];});});

function cls(d){return ['tier-'+d.tier,d.vetoed?'is-vetoed':'',d.status?'status-'+d.status:''].filter(Boolean);}
function clone(id){return document.getElementById(id).content.firstElementChild.cloneNode(true);}
function fill(root,d){
  root.classList.add.apply(root.classList,cls(d));
  var v={name:d.name,'tier-text':d.tierText,quality:d.q,'status-text':ST[d.status],wx:d.wx,temp:d.temp,pop:d.pop,window:d.window};
  root.querySelectorAll('[data-field]').forEach(function(el){
    var f=el.getAttribute('data-field');
    if(f==='flags'){el.innerHTML='';d.flags.forEach(function(t){var li=document.createElement('li');li.textContent=t;el.appendChild(li);});}
    else if(v[f]!=null) el.textContent=v[f];
  });
  return root;
}
function dest(lat,lng,az,km){var a=az*Math.PI/180;return [lat+km*Math.cos(a)/111.32,lng+km*Math.sin(a)/(111.32*Math.cos(lat*Math.PI/180))];}

var map=L.map('map',{zoomControl:false}).setView([25.11,121.40],11);
L.control.zoom({position:'bottomright'}).addTo(map);
// 預覽環境無法使用 CARTO（需 API key），改用 OSM 去色模擬淡色底圖；正式環境請用 CARTO light_all。
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap（預覽替代底圖）'}).addTo(map);
map.getPane('tilePane').style.filter='grayscale(1) brightness(1.08) contrast(.82) sepia(.08)';
var BOUNDS=spots.map(function(s){return [s.lat,s.lng];});
function fit(){map.invalidateSize();map.fitBounds(BOUNDS,{paddingTopLeft:[90,70],paddingBottomRight:[70,150]});}
fit();
if(document.readyState!=='complete') window.addEventListener('load',fit);
setTimeout(fit,600);

spots.forEach(function(s){
  var muted=(s.vetoed||s.tier==='nodata')?' is-muted':'';
  var pts=[[s.lat,s.lng]];
  for(var a=AZ-s.spread;a<=AZ+s.spread;a+=4) pts.push(dest(s.lat,s.lng,a,2.4));
  s.fan=L.polygon(pts,{className:'sun-fan'+muted,stroke:false,interactive:false}).addTo(map);
  s.ray=L.polyline([[s.lat,s.lng],dest(s.lat,s.lng,AZ,1.5)],{className:'sun-ray'+muted,interactive:false}).addTo(map);
  var html='<div class="pin '+cls(s).join(' ')+(s.fav?' is-favorite':'')+'"><img class="pin-glyph" src="'+I+'status-'+s.status+'.svg" alt=""></div>';
  s.marker=L.marker([s.lat,s.lng],{icon:L.divIcon({className:'pin-icon',html:html,iconSize:[44,44],iconAnchor:[22,22]}),riseOnHover:true}).addTo(map);
  s.marker.bindTooltip(fill(clone('tpl-tooltip'),s),{direction:'top',offset:[0,-20],className:'tip-wrap',opacity:1});
  s.marker.on('click',function(){openDetail(s);});
});

function select(t){spots.forEach(function(s){
  var el=s.marker.getElement(); if(el) el.querySelector('.pin').classList.toggle('is-selected',s===t);
  s.fan.getElement().classList.toggle('is-selected',s===t);
});}
function closeDetail(){var b=document.getElementById('detail');b.innerHTML='';b.hidden=true;select(null);}
function openDetail(s){
  var b=document.getElementById('detail'),c=fill(clone('tpl-detail'),s);
  var cam=c.querySelector('[data-field="cam"]');
  cam.innerHTML=s.cams?'<div style="width:100%;height:100%;display:grid;place-items:center;background:repeating-linear-gradient(135deg,#2a2521 0 10px,#26211d 10px 20px);font:12px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;color:#a89e94">YouTube 直播嵌入 · 16:9</div>':'<p class="cam-empty">尚無直播</p>';
  c.querySelector('[data-field="cam-label"]').hidden=!s.camLabel;
  c.querySelector('[data-field="cam-switch"]').hidden=!(s.cams>1);
  c.querySelector('[data-field="cam-open"]').hidden=!s.cams;
  c.querySelector('[data-field="nav"]').href='https://www.google.com/maps/dir/?api=1&destination='+s.lat+','+s.lng;
  c.querySelector('[data-field="close"]').addEventListener('click',closeDetail);
  b.innerHTML='';b.appendChild(c);b.hidden=false;select(s);
}

var rg=document.getElementById('regions');
regions.forEach(function(g){rg.appendChild(fill(clone('tpl-region-card'),g));});
var fv=document.getElementById('favorites');
['dadaocheng','golden','datun'].forEach(function(id){
  var s=byId[id],c=fill(clone('tpl-favorite-card'),s);
  c.addEventListener('click',function(){openDetail(s);});
  fv.appendChild(c);
});
document.querySelector('#updated .updated-time').textContent='資料更新於 17:02';

if(mode==='detail') openDetail(byId.dadaocheng);
if(mode==='states') setTimeout(function(){byId.fisherman.marker.openTooltip();},300);
})();
