var Q = require("q");
var _ = require("lodash");
var utils = require("./utils");

// Promise-based API wrapper for Wanikani
var wkApiWrapper = function(options) {

  var endpoint = "https://www.wanikani.com/api/user/";
  var apiKey = options.apiKey || "";

  var createUrl = function() {
    var args = [].slice.call(arguments);
    return (endpoint + apiKey + args.join(""));
  };

  return {

    /*
      Example levels:
      "1" - returns kanji for level 1
      "1,2,5,9" - returns kanji for levels 1, 2, 5 and 9
      "" - returns all kanji
    */
    getKanji: function(level) {
      if (typeof level === "undefined") level = "";
      var deferred = Q.defer();
      var url = createUrl("/kanji", "/" + level);

      utils.get(url, {protocol: "https"}).done(function(data) {
        if (data && data.requested_information) {
          deferred.resolve(data.requested_information);
        }
        else deferred.reject("Failed to get kanji from Wanikani API.");
      });

      return deferred.promise;
    }
  }
};

module.exports = wkApiWrapper;