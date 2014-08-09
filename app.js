var Q            = require("q");
var _            = require("lodash");
var cheerio      = require("cheerio");
var fs           = require("fs");
var readir       = require('recursive-readdir');
var path         = require("path");
var utils        = require("./utils");
var wanakana     = require("./wanakana.min");
var wkApiWrapper = require("./wk");

var wk = wkApiWrapper({
  apiKey: "57a8b351b5b361b8d83d65f02ef07def"
});

utils.readFromFile("sentences.json").done(function(sentences) {
  // wk.getKanji().done(function(kanjis) {
  //   findSentences(sentences, createKanjiMaps(kanjis));
  // });
  utils.readFromFile("kanjis.json").done(function(kanjis) {
    // var sentencesByLevelMap = findSentences(sentences, createKanjiMaps(kanjis));
    // var allSentences = _.reduce(sentencesByLevelMap, function(result, array, key) {
    //   return result.concat(array);
    // }, []);

    // createAnkiTextFile(allSentences);

    readir('jdic_audio', function (err, files) {
      var map = mapAudioFiles(files);
      fs.writeFile("audio.json", JSON.stringify(map, null, 4), function(err) {
        if (err) {
          console.error(err);
          return;
        }
      });
    });
  });
});

function mapAudioFiles(files) {

  // files = files.map(function(file) {
  //   return file.replace(".mp3", "").split(" - ");
  // });

  var map = {};
  _.map(files, function(file) {

    file = file.replace(/jdic_audio\/jdic_audio_\d{1,2}\//, "").replace(".mp3", "").split(" - ");
    if (!_.isUndefined(map[file[0]])) {
      map[file[0]].push(file[1]);
    }
    else {
      map[file[0]] = [file[1]];
    }
  });

  return map;
}

/* One file per level, or one file for all levels
   Needs option to include multiple sentences per character or only the first/best one */
function createAnkiTextFile(sentenceObjects, fields) {

  var fields = {
    kanjiOne: "",
    kanjiTwo: "",
    furigana: "", // furigana for the kanji
    expression: "", // sentence in japanese without furigana
    reading: "", // sentence in japanese with furigana
    meaning: "", // meaning of this individual kanji
    sentenceEnglish: "" // the english translation of the sentence
  };

  // Blank the file
  fs.writeFile("anki-sentences.txt", "", function(err) {
    if (err) {
      console.error(err)
      return;
    }
  });

  _.map(sentenceObjects, function(sentenceObject) {

    fields.kanjiOne = sentenceObject.character;
    fields.meaning  = sentenceObject.meaning;
    fields.furigana = sentenceObject.furigana || "";

    _.each(sentenceObject.sentences, function(sentence) {

      fields.expression      = stripFurigana(sentence.jp);
      fields.reading         = sentence.jp;
      fields.sentenceEnglish = sentence.en;
      writeLineToAnkiFile("anki-sentences.txt", fields);
    });
  });
}

function writeLineToAnkiFile(fileName, fields) {

  fields = _.mapValues(fields, function(field) {
    return field.length ? field + ";" : "";
  });
  var string = [fields.kanjiOne, fields.kanjiTwo, fields.furigana, fields.expression, fields.reading, fields.meaning, fields.sentenceEnglish].join("");
  if (string.substring(string.length - 1) === ";") string = string.slice(0, -1);
  fs.appendFile(fileName, string + "\n", function(err) {
    if (err) {
      console.error(err)
      return;
    }
  });
}

// Sentences is a map from character to array of sentences containing that character
function findSentences(sentences, kanjiMap) {

  var sentenceTotal = 0;
  // For each kanji that this user has learned so far
  _.each(kanjiMap.srsToKanji, function(kanjis, srs) {
    // For each kanji in this srs level
    _.each(kanjis, function(kanji) {

      var matchedSentences = [];

      // For each sentence in the list of sentences for this character, find all applicable sentences
      _.each(sentences[kanji.character], function(sentence) {

        var count = {
          apprentice: 0,
          guru: 0,
          master: 0,
          enlighten: 0,
          burned: 0,
          unknown: 0
        };
        var tempSentence = sentence.jp;
        tempSentence = stripNonKanji(tempSentence).split("");
        // For each character in this sentence...
        _.each(tempSentence, function(character) {
          // Ignore kana
          if (!wanakana.isKana(character)) {
            var srsLevel = kanjiMap.kanjiToSrs[character];
            if (_.isString(srsLevel)) {
              count[srsLevel]++;
            }
            else {
              count["unknown"]++;
            }
          }
        });
        if (count.apprentice <= 1 && count.guru <= 2 && count.enlighten <= 3 && count.unknown === 0) {
          sentence.counts = count;
          matchedSentences.push(sentence);
        }
      });

      sentenceTotal += matchedSentences.length;
      kanji.sentences = matchedSentences;
    });
  });

  return kanjiMap.srsToKanji;
}

function scraper() {

  utils.readFromFile("sentences.json").done(function(sentences) {

    var alreadyStored = pluckCharacters(sentences);

    wk.getKanji().done(function(kanjis) {

      var maps = createKanjiMaps(kanjis);
      var diff = _.difference(_.keys(maps.kanjiToSrs), alreadyStored);

      scrapeSentences(diff).done(function(sentences) {

        // Don't save sentences that are null
        sentences = _.filter(sentences, function(sentence) { return !_.isNull(sentence); });
        // var kanjiToSentence = {};
        // _.each(sentences, function(sentence) {
        //   kanjiToSentence[sentence.character] = sentence.sentences;
        // });
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
function scrapeSentences(kanjiList) {

  var promises = utils.mapSeries(kanjiList, function(kanji, index) {

    var random = _.random(2, 10) * 1000,
        deferred = Q.defer(),
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

function stripFurigana(sentence) {
  sentence = sentence.replace(/\[[^\].]*\]/g, "");
  return sentence;
}

function stripNonKanji(sentence) {
  sentence = sentence.replace(/\[[^\].]*\]/g, "");
  sentence = sentence.replace(/[。、？ー\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  return sentence;
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
      kanjiMaps.srsToKanji[kanji.user_specific.srs].push({
        "character": kanji.character,
        "meaning": kanji.meaning
      });
    }
  });

  return kanjiMaps;
}
