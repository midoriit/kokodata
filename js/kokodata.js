
$(function(){

  var server = 'https://query.wikidata.org/sparql';
  var map = L.map('mapdiv', {
    minZoom: 9,
    maxZoom: 18
  });
  map.setView([35.658099, 139.741357], 13); // 日本経緯度原点

  // 地理院地図
  var newLayer = L.tileLayer(
    'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
       opacity: 0.6,
       attribution: '<a href="http://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html" target="_blank">国土地理院</a>'
  });

  newLayer.addTo(map);

  var lc = L.control.locate({
    position: 'topright',
    drawCircle: false, 
    follow: false,
    setView: true,
    keepCurrentZoomLevel: true,
    stopFollowingOnDrag: true,
    remainActive: false,
    markerClass: L.circleMarker, // L.circleMarker or L.marker
    circleStyle: {},
    markerStyle: {},
    followCircleStyle: {},
    followMarkerStyle: {},
    icon: 'fa fa-location-arrow',
    iconLoading: 'fa fa-spinner fa-spin',
    showPopup: false,
    locateOptions: {enableHighAccuracy: true}
  }).addTo(map);
  lc.start();

  L.control.scale({imperial: false}).addTo(map);

  L.easyButton('fa fa-info fa-lg',
    function() {
      $('#about').modal('show');
    },
    'このサイトについて',
    null, {
      position:  'bottomright'
    }).addTo(map);

  var mc = new L.markerClusterGroup();   // dummy

  map.on('moveend', function(ev) {

    map.removeLayer(mc);
    mc = new L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyDistanceMultiplier: 2
    });
    map.addLayer(mc);

    var bounds = map.getBounds();
    var sparql = 
      'SELECT DISTINCT ?s ?sLabel ?lat ?lon ?wp WHERE { ' +
      '  ?wp schema:about ?s . ' +
      '  ?wp schema:inLanguage "ja" . ' +
      '  FILTER (SUBSTR(str(?wp), 1, 25) = "https://ja.wikipedia.org/") ' +
      '  SERVICE wikibase:box { ' +
      '    ?s wdt:P625 ?location . ' +
      '    bd:serviceParam wikibase:cornerSouthWest "Point(' +
             bounds.getWest() + ' ' +  bounds.getSouth() +
      '    )"^^geo:wktLiteral . ' +
      '    bd:serviceParam wikibase:cornerNorthEast "Point(' +
             bounds.getEast() + ' ' + bounds.getNorth() +
      '    )"^^geo:wktLiteral . ' +
      '  } ' +
      '  BIND(geof:latitude(?location) as ?lat) ' +
      '  BIND(geof:longitude(?location) as ?lon) ' +
      '  SERVICE wikibase:label { ' +
      '    bd:serviceParam wikibase:language "ja, en" . ' +
      '  } ' +
      '} ' +
      'LIMIT 300';
    var query = {
      query : sparql,
      format: 'json'
    };

    $.getJSON(server, query, function(data){
      var list = data.results.bindings;
      for(i=0 ; i<list.length ; i++) {
        var marker = L.marker(L.latLng(list[i].lat.value, list[i].lon.value), {
                   icon : L.VectorMarkers.icon({
                     icon: 'wikipedia-w',
                     markerColor: '#AAF'
                   }),
                   title: list[i].sLabel.value
        }).addTo(mc).bindPopup(list[i].s.value, {autoPan:false});
      }
    });
  });

  map.on('popupopen', function(e) {
    var s = e.popup.getContent();
    map.closePopup();

    if(!s.match(/www.wikidata.org\/entity/)) return;
    var subject = s.replace(/.*entity\//g, 'wd:');

    var sparql = 
      'SELECT DISTINCT ?sLabel ?wp WHERE { ' +
      '  ?wp schema:about ' + subject + ' . ' +
      '  ?wp schema:about ?s . ' +
      '  ?wp schema:inLanguage "ja" . ' +
      '  FILTER (SUBSTR(str(?wp), 1, 25) = "https://ja.wikipedia.org/") ' +
      '  SERVICE wikibase:label { ' +
      '    bd:serviceParam wikibase:language "ja,en". ' +
      '  } ' +
      '}';
    var query = {
      query : sparql,
      format: 'json'
    };
    $.getJSON(server, query, function(data){
      var list = data.results.bindings;
      var header = '<a href="' + list[0].wp.value + '" target="_blank">' +
                    list[0].sLabel.value + '</a>';
      $('#wikilink').html(header);

      var sparql = 
        'select ?p ?propLabel ?oLabel WHERE { ' +
        '  hint:Query hint:optimizer "None" . ' +
           subject + ' ?p ?o . ' +
        '  ?prop wikibase:directClaim ?p . ' +
        '  SERVICE wikibase:label { ' +
        '    bd:serviceParam wikibase:language "ja,en". ' +
        '  } ' +
        '}';
      var query = {
        query : sparql,
        format: 'json'
      };
      $.getJSON(server, query, function(data){
        var list = data.results.bindings;
        var content = '';
        var prop;
        var prefix;
        var suffix;
        var isDate;
        var link;
        for(i=0 ; i<list.length ; i++) {

          prop = list[i].p.value.replace(/.*prop\/direct\//g, '');
          prefix = '';
          suffix = '';
          link = true;
          isDate = false;

          switch( prop ) {

            // URL
            case 'P18':       // 画像
            case 'P242':      // 位置地図画像
            case 'P856':      // 公式ウェブサイト
            case 'P948':      // ウィキボヤージュ用バナー
            case 'P973':      // 詳細情報URL
              break;

            // 識別子
            case 'P213':      // ISNI
              prefix = 'http://www.isni.org/';
              break;
            case 'P214':      // VIAF識別子
              prefix = 'http://viaf.org/viaf/';
              break;
            case 'P227':      // GND識別子
              prefix = 'http://d-nb.info/gnd/';
              break;
            case 'P244':      // LCNAF識別子
              prefix = 'http://id.loc.gov/authorities/';
              break;
            case 'P245':      // ULAN
              prefix = 'http://vocab.getty.edu/page/ulan/';
              break;
            case 'P268':      // BNF
              prefix = 'http://catalogue.bnf.fr/ark:/12148/cb';
              break;
            case 'P269':      // SUDOC
              prefix = 'https://www.idref.fr/';
              break;
            case 'P271':      // CiNii著者識別子
              prefix = 'http://ci.nii.ac.jp/author/';
              break;
            case 'P345':      // IMDb識別子
              prefix = 'http://www.imdb.com/company/';
              break;
            case 'P349':      // 国立国会図書館典拠ID
              prefix = 'http://id.ndl.go.jp/auth/ndlna/';
              break;
            case 'P373':      // コモンズのカテゴリ
              prefix = 'https://commons.wikimedia.org/wiki/Category:';
              break;
            case 'P409':      // NLA
              prefix = 'http://nla.gov.au/anbd.aut-an';
              break;
            case 'P454':      // Structurae
              prefix = 'https://structurae.net/structures/';
              break;
            case 'P455':     // Emporis
              prefix = 'https://www.emporis.com/buildings/';
              break;
            case 'P691':     // NKC識別子
              prefix = 'http://aut.nkp.cz/';
              break;
            case 'P757':      // 世界遺産識別子
              prefix = 'http://whc.unesco.org/en/list/';
              break;
            case 'P935':      // コモンズのギャラリー
              prefix = 'https://commons.wikimedia.org/wiki/';
              break;
            case 'P950':      // BNE識別子
              prefix = 'http://datos.bne.es/resource/';
              break;
            case 'P982':     // MusicBrainz地域ID
              prefix = 'https://musicbrainz.org/area/';
              break;
            case 'P1004':     // MusicBrainz place ID
              prefix = 'https://musicbrainz.org/place/';
              break;
            case 'P1005':     // PTBNP識別子
              prefix = 'http://urn.bn.pt/nca/unimarc-authorities/txt?id=';
              break;
            case 'P1017':     // BAV識別子
              prefix = 'https://viaf.org/viaf/sourceID/BAV|';
              break;
            case 'P1207':     // NUKAT
              prefix = 'https://viaf.org/processed/NUKAT|';
              break;
            case 'P1296':     // カタルーニャ大百科事典識別子
              prefix = 'http://www.enciclopedia.cat/EC-GEC-';
              suffix = '.xml';
              break;
            case 'P1305':     // Skyscraper Center ID
              prefix = 'http://www.skyscrapercenter.com/building.php?building_id=';
              break;
            case 'P1417':     // Encyclopaedia Britannica Online ID
              prefix = 'https://www.britannica.com/';
              break;
            case 'P1566':     // GeoNames ID
              prefix = 'http://www.geonames.org/';
              break;
            case 'P1612':     // Commons Institution page
              prefix = 'https://commons.wikimedia.org/wiki/Institution:';
              break;
            case 'P1669':     // CONA ID
              prefix = 'http://vocab.getty.edu/cona/';
              break;
            case 'P1699':     // SkyscraperPage building id
              prefix = 'http://skyscraperpage.com/cities/?buildingID=';
              break;
            case 'P2002':     // Twitterのユーザー名
              prefix = 'https://twitter.com/';
              break;
            case 'P2003':     // インスタグラムのユーザー名
              prefix = 'https://www.instagram.com/';
              break;
            case 'P2013':     // フェイスブックID
              prefix = 'https://www.facebook.com/';
              break;
            case 'P2270':     // Emporis building complex ID
              prefix = 'https://www.emporis.com/complex/';
              break;
            case 'P2427':     // GRID ID
              prefix = 'https://www.grid.ac/institutes/';
              break;
            case 'P2762':     // Skyscraper Center building complex ID
              prefix = 'https://www.skyscrapercenter.com/complex/';
              break;
            case 'P2765':     // blue-style.com ID
              prefix = 'http://www.blue-style.com/building/';
              break;
            case 'P3222':     // NE.se ID
              prefix = 'https://www.ne.se/uppslagsverk/encyklopedi/l%C3%A5ng/';
              break;
            case 'P3225':     // 法人番号
              prefix = 'http://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=';
              break;
            case 'P3348':     // National Library of Greece ID
              prefix = 'http://nlg.okfn.gr/resource/authority/record';
              break;
            case 'P3762':     // openMLOL author ID
              prefix = 'https://openmlol.it/autore/';
              break;
            case 'P3820':     // Flanders Arts Institute venue ID
              prefix = 'http://data.kunsten.be/venues/';
              break;

            // 日付
            case 'P571':      // 創立日
            case 'P580':      // 開始日
            case 'P1619':     // 開設年月日
              link = false;
              isDate = true;
              break;

            default:
              link = false;
          }
          if(link) {
            content +=
              list[i].propLabel.value + '<font color="#777">(' + prop + '):</font> ' + 
              '<a href="' + prefix + list[i].oLabel.value + suffix + 
              '" target="_blank">' + list[i].oLabel.value + '</a><br/>';
          } else if(isDate) {
            theDay = new Date(list[i].oLabel.value); 
            content += 
              list[i].propLabel.value + '<font color="#777">(' + prop + '):</font> ' +
              theDay.getFullYear() + '年' + (theDay.getMonth()+1) + '月' + 
              theDay.getDate() + '日<br/>';
          } else {
            content += 
              list[i].propLabel.value + '<font color="#777">(' + prop + '):</font> ' +
              list[i].oLabel.value + '<br/>';
          }
        }

        $('#wikidata').html(content);
        $('#popupdata').modal('show');

      });
    });

  });

});
  