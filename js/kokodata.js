
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
        'select ?p ?propLabel ?oLabel ?formatter ?wp WHERE { ' +
        '  hint:Query hint:optimizer "None" . ' +
           subject + ' ?p ?o . ' +
        '  ?prop wikibase:directClaim ?p . ' +
        '  OPTIONAL { ' +
        '    ?prop wdt:P1630 ?formatter . ' +
        '  } ' +
        '  OPTIONAL { ' +
        '    ?wp schema:about ?o . ' +
        '    ?wp schema:inLanguage "ja" . ' +
        '    FILTER (SUBSTR(str(?wp), 1, 25) = "https://ja.wikipedia.org/") ' +
        '  } ' +
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
        var isDate;
        var isDirect;
        var isSpecial;
        var ignoreFormatter;
        var link;
        var theDay;
        for(i=0 ; i<list.length ; i++) {

          prop = list[i].p.value.replace(/.*prop\/direct\//g, '');
          isDirect = false;
          isDate = false;
          isSpecial = false;
          ignoreFormatter = false;

          switch( prop ) {

            // 日付
            case 'P571':      // 創立日
            case 'P576':      // 解散日
            case 'P580':      // 開始日
            case 'P582':      // 終了日
            case 'P585':      // 時点
            case 'P729':      // 運用開始日
            case 'P730':      // 退役日
            case 'P1619':     // 開設年月日
              isDate = true;
              break;

            // URL直接リンク
            case 'P10':       // 映像
            case 'P18':       // 画像
            case 'P41':       // 旗の画像
            case 'P94':       // 紋章の画像
            case 'P154':      // ロゴ画像
            case 'P158':      // 印章の画像
            case 'P242':      // 位置地図画像
            case 'P856':      // 公式ウェブサイト
            case 'P948':      // ウィキボヤージュ用バナー
            case 'P968':      // Eメール
            case 'P973':      // 詳細情報URL
            case 'P989':      // 話し言葉の音声
            case 'P1325':     // 外部データURL
            case 'P2699':     // URL
            case 'P3451':     // nighttime view
              isDirect = true;
              break;

            // formatter URLの値を使わず個別対応
            case 'P3225':     // 法人番号
              link = 'http://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=$1';
              isSpecial = true;
              break;

            // third-party formatterを使い個別対応
            case 'P238':     // IATA空港コード
              link = 'https://www.flightradar24.com/data/airports/$1';
              isSpecial = true;
              break;
            case 'P239':     // ICAO空港コード
              link = 'http://uk.flightaware.com/live/airport/$1';
              isSpecial = true;
              break;

            // formatterによるリンク抑止
            case 'P625':      // 位置座標
            case 'P791':      // ISIL識別子
              ignoreFormatter = true;
              break;

          }
          if(isDirect) {
            // 直接リンク
            content +=
              list[i].propLabel.value + '<font color="#777">(' + prop + '):</font> ' + 
              '<a href="' + list[i].oLabel.value + 
              '" target="_blank">' + list[i].oLabel.value + '</a><br/>';
          } else if(isDate) {
            // 日付
            theDay = new Date(list[i].oLabel.value); 
            content += 
              list[i].propLabel.value + '<font color="#777">(' + prop + '):</font> ' +
              theDay.getFullYear() + '年' + (theDay.getMonth()+1) + '月' + 
              theDay.getDate() + '日<br/>';
          } else if(isSpecial) {
            // 個別対応リンク
            content += 
              list[i].propLabel.value + '<font color="#777">(' + prop + '):</font> ' +
              '<a href="' + link.replace('$1', list[i].oLabel.value) + 
              '" target="_blank">' + list[i].oLabel.value + '</a><br/>';
          } else if(list[i].formatter && !ignoreFormatter) {
            // formatter利用リンク
            link = list[i].formatter.value;
            content += 
              list[i].propLabel.value + '<font color="#777">(' + prop + '):</font> ' +
              '<a href="' + link.replace('$1', list[i].oLabel.value) + 
              '" target="_blank">' + list[i].oLabel.value + '</a><br/>';
          } else if(list[i].wp) {
            // Wikipediaリンク
            content += 
              list[i].propLabel.value + '<font color="#777">(' + prop + '):</font> ' +
              '<a href="' + list[i].wp.value + 
              '" target="_blank">' + list[i].oLabel.value + '</a><br/>';
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
  