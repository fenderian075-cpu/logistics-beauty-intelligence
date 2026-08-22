/* Shared minimal navigation for non-report pages. Japanese-only UI. */
(function(){
  "use strict";
  var root=document.body.getAttribute("data-root")||"";
  fetch(root+"data/reports.json",{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(function(data){
    var reports=(data&&data.reports)||[];
    ["daily","weekly","monthly"].forEach(function(type){
      var latest=reports.filter(function(r){return r.type===type&&r.path}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0})[0];
      var link=document.getElementById("nav-latest-"+type);
      if(link&&latest)link.href=root+latest.path;
    });
  }).catch(function(){/* fallback hrefs remain usable */});
})();