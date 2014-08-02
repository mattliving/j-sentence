var Q            = require("q");
var _            = require("lodash");
var cheerio      = require("cheerio");
var fs           = require("fs");
var utils        = require("./utils");
var wkApiWrapper = require("./wk");

var wk = wkApiWrapper({
  apiKey: "57a8b351b5b361b8d83d65f02ef07def"
});

// wk.getKanji().done(function(kanjis) {

//   var maps = createKanjiMaps(kanjis);
//   console.log(maps);
// });

getSentences(["高", "食"]).done(function(sentences) {

  // sentences.forEach(function(sentence) {
  //   console.log(sentence);
  // });
  fs.writeFile("sentences.json", JSON.stringify(sentences, null, 4), function(err) {
    if (err) console.error(err);
  });
});

// Scrape sentences from tangorin for each kanji in the list and return an array of promises
function getSentences(kanjiList) {

  var promises = utils.mapSeries(kanjiList, function(kanji) {

    var deferred = Q.defer(),
        sentence = {};
    sentence[kanji] = [];

    utils.get("http://tangorin.com/examples/" + kanji).done(function(data) {

      var $ = cheerio.load(data);
      $(".entry").each(function(entry) {
        var japanese = $(this).find(".ex-dt").text().replace(/\(/g, "[").replace(/\)/g, "]"),
            english = $(this).find(".ex-en").text();

        sentence[kanji].push({jp: japanese, en: english});
      });

      deferred.resolve(sentence);
    });

    return deferred.promise;
  });

  return promises;
}

function createKanjiMaps(kanjis) {
  var kanjiMaps = {
    kanjiToSrs: {},
    srsToKanji: {
      "apprentice": [],
      "guru": [],
      "master": [],
      "enlighten": [],
      "burned": []
    }
  };

  kanjis.forEach(function(kanji) {
    if (kanji.user_specific !== null) {
      kanjiMaps.kanjiToSrs[kanji.character] = kanji.user_specific.srs;
      kanjiMaps.srsToKanji[kanji.user_specific.srs].push(kanji.character);
    }
  });

  return kanjiMaps;
}

// Obtain from various sources...
var sentences = [
  "おご名前なまえと部屋へや番号ばんごうをお願いしますおねがいします。"
];

//var gurued = wanikani.api.get("gurued");
var gurued = {},
    filtered = [];

sentences.forEach(function(sentence) {

  var kanjis = [];
  for (var i = 0, len = sentence.length; i < len; i++) {
    // add unknown kanji
    if (typeof gurued[sentence[i]] === "undefined") {
      kanjis.push(sentence[i]);
    }
  }
  // only include sentences with 2 or less known kanji
  if (kanjis.length <= 2) {
    filtered.concat(kanjis);
  }
});