
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
        var link = true;
        for(i=0 ; i<list.length ; i++) {

          prop = list[i].p.value.replace(/.*prop\/direct\//g, '');
          prefix = '';
          link = true;

          switch( prop ) {
            case 'P18':       // 画像
            case 'P242':      // 位置地図画像
            case 'P856':      // 公式ウェブサイト
            case 'P948':      // ウィキボヤージュ用バナー
            case 'P973':      // 詳細情報URL
              break;
            case 'P373':      // コモンズのカテゴリ
              prefix = 'https://commons.wikimedia.org/wiki/Category:';
              break;
            case 'P1004':     // MusicBrainz place ID
              prefix = 'https://musicbrainz.org/place/';
              break;
            case 'P1305':     // Skyscraper Center ID
              prefix = 'http://www.skyscrapercenter.com/building.php?building_id=';
              break;
            case 'P2002':     // Twitterのユーザー名
              prefix = 'https://twitter.com/';
              break;
            case 'P2013':     // フェイスブックID
              prefix = 'https://www.facebook.com/';
              break;
            case 'P3225':     // 法人番号
              prefix = 'http://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=';
              break;
            default:
              link = false;
          }
          if(link) {
            content +=
              list[i].propLabel.value + '(' + prop + ') : ' + 
              '<a href="' + prefix + list[i].oLabel.value + '" target="_blank">' + 
              list[i].oLabel.value + '</a><br/>';
          } else {
            content += 
              list[i].propLabel.value + '(' + prop + ') : ' +
              list[i].oLabel.value + '<br/>';
          }
        }

        $('#wikidata').html(content);
        $('#popupdata').modal('show');

      });
    });

  });

});
  