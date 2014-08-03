var http = require("http");
var https = require("https");
var fs = require("fs");
var Q = require("q");

function get(url, options) {

  var options = options || {};
  var method = options.protocol === "https" ? https.get : http.get;
  var deferred = Q.defer();

  var req = method(url, function(res) {
    var buffer = "",
        data;

    res.on("data", function(chunk) {
      buffer += chunk;
    });

    res.on("end", function(err) {
      if (err) deferred.reject(err);
      if (!(/.*<!doctype html>.*/.test(buffer))) {
        data = JSON.parse(buffer);
        deferred.resolve(data);
      }
      else deferred.resolve(buffer);
    });
  });
  return deferred.promise;
}

/* Courtesy of http://strongloop.com/strongblog/how-to-compose-node-js-promises-with-q/ */
function mapSeries(arr, iterator) {
  // create an empty promise to start our series (so we can use `then`)
  var currentPromise = Q();
  var promises = arr.map(function(el, index) {
    return currentPromise = currentPromise.then(function() {
      // execute the next function after the previous has resolved successfully
      return iterator(el, index);
    });
  });
  // group the results and return the group promise
  return Q.all(promises);
}

function readFromFile(file) {

  var deferred = Q.defer();
  Q.nfcall(fs.readFile, file).then(function(result) {
    deferred.resolve(JSON.parse(result));
  });
  return deferred.promise;
}

var utils = {
  get: get,
  mapSeries: mapSeries,
  readFromFile: readFromFile
};

module.exports = utils;