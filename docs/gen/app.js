(function(){
  var root=document.documentElement, KEY='slideshot-docs-lang';
  function setLang(l){
    root.setAttribute('data-lang',l); root.lang=l;
    document.title=l==='id'?'Dokumentasi Slideshot':'Slideshot documentation';
    document.querySelectorAll('.lang button').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-l')===l));});
    try{localStorage.setItem(KEY,l);}catch(e){}
  }
  var l='';try{l=localStorage.getItem(KEY)||'';}catch(e){}
  if(l!=='en'&&l!=='id'){l=((navigator.language||'').toLowerCase().indexOf('id')===0)?'id':'en';}
  setLang(l);
  document.querySelectorAll('.lang button').forEach(function(b){b.addEventListener('click',function(){setLang(b.getAttribute('data-l'));});});

  var links=[].slice.call(document.querySelectorAll('.toc a')), nav=document.querySelector('.toc');
  var secs=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1));});
  function mark(id){
    links.forEach(function(a){
      var on=a.getAttribute('href')==='#'+id;
      if(on){a.setAttribute('aria-current','true');
        if(nav.scrollWidth>nav.clientWidth&&nav.scrollHeight<=nav.clientHeight+2){nav.scrollTo({left:a.offsetLeft-nav.clientWidth/2+a.clientWidth/2});}}
      else a.removeAttribute('aria-current');
    });
  }
  if('IntersectionObserver' in window){
    var vis={};
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){vis[e.target.id]=e.isIntersecting;});
      for(var i=secs.length-1;i>=0;i--){if(secs[i]&&vis[secs[i].id]){mark(secs[i].id);break;}}
    },{rootMargin:'-96px 0px -60% 0px'});
    secs.forEach(function(s){if(s)io.observe(s);});
  }
})();
