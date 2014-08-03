var Q            = require("q");
var _            = require("lodash");
var cheerio      = require("cheerio");
var fs           = require("fs");
var utils        = require("./utils");
var wkApiWrapper = require("./wk");

var wk = wkApiWrapper({
  apiKey: "57a8b351b5b361b8d83d65f02ef07def"
});

function scraper() {

  utils.readFromFile("sentences.json").done(function(sentences) {

    var alreadyStored = pluckCharacters(sentences);

    wk.getKanji().done(function(kanjis) {

      var maps = createKanjiMaps(kanjis);
      var diff = _.difference(_.keys(maps.kanjiToSrs), alreadyStored);

      getSentences(diff).done(function(sentences) {

        // Don't save sentences that are null
        sentences = _.filter(sentences, function(sentence) { return !_.isNull(sentence); });
        fs.writeFile("sentences.json", JSON.stringify(sentences, null, 4), function(err) {
          if (err) {
            console.error(err)
            return;
          }
        });
      });
    });
  });
}

// Scrape sentences from tangorin for each kanji in the list and return an array of promises
function getSentences(kanjiList) {

  var promises = utils.mapSeries(kanjiList, function(kanji, index) {

    var random = _.random(2, 10) * 1000;

    var deferred = Q.defer(),
        sentence = {};

    sentence["character"] = kanji;
    sentence["sentences"] = [];

    Q.delay(utils.get("http://tangorin.com/examples/" + kanji), random).done(function(data) {

      var $ = cheerio.load(data);
      $(".entry").each(function(entry) {
        var japanese = $(this).find(".ex-dt").text().replace(/\(/g, "[").replace(/\)/g, "]"),
            english = $(this).find(".ex-en").text();

        sentence["sentences"].push({jp: japanese, en: english});
      });

      console.log("Sent request to http://tangorin.com/examples/" + kanji + "\n");
      console.log((index/kanjiList.length)*100 + "%");
      console.log("Approximately " + ((kanjiList.length - index) * 6) + "s remaining.");
      deferred.resolve(sentence);
    });

    return deferred.promise;

  });

  return promises;
}

function pluckCharacters(collection) {
  var arr = [];
  if (collection) {
    arr = _.pluck(collection, "character");
  }
  return arr;
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