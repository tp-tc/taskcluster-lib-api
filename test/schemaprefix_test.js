suite("api/schemaPrefix", function() {
  require('superagent-hawk')(require('superagent'));
  var request         = require('superagent-promise');
  var assert          = require('assert');
  var Promise         = require('promise');
  var testing         = require('taskcluster-lib-testing');
  var validator       = require('taskcluster-lib-validate');
  var subject         = require('../');
  var express         = require('express');
  var path            = require('path');

  // Create test api
  var api = new subject({
    title:        "Test Api",
    description:  "Another test api",
    schemaPrefix: 'http://localhost:4321/'
  });

  // Declare a method we can test input with
  api.declare({
    method:   'get',
    route:    '/test-input',
    name:     'testInput',
    input:    'test-schema.json',
    title:    "Test End-Point",
    description:  "Place we can call to test something",
  }, function(req, res) {
    res.status(200).send("Hello World");
  });

  // Declare a method we can use to test valid output
  api.declare({
    method:   'get',
    route:    '/test-output',
    name:     'testInput',
    output:   'test-schema.json',
    title:    "Test End-Point",
    description:  "Place we can call to test something",
  }, function(req, res) {
    res.reply({value: 4});
  });

  // Reference for test api server
  var _apiServer = null;

  // Create a mock authentication server
  setup(function(){
    testing.fakeauth.start();
    assert(_apiServer === null,       "_apiServer must be null");
    // Create validator
    var validatorCreated = validator({
      folder:         path.join(__dirname, 'schemas'),
      baseUrl:        'http://localhost:4321/'
    });

    // Create server for api
    return validatorCreated.then(function(validator) {
      // Create router
      var router = api.router({
        validator:      validator,
        authBaseUrl:    'http://localhost:61243'
      });

      // Create application
      var app = express();

      // Use router
      app.use(router);

      return new Promise(function(accept, reject) {
        var server = app.listen(61515);
        server.once('listening', function() {
          accept(server)
        });
        server.once('error', reject);
        _apiServer = server;
      });
    });
  });

  // Close server
  teardown(function() {
    testing.fakeauth.stop();
    assert(_apiServer,      "_apiServer doesn't exist");
    return new Promise(function(accept) {
      _apiServer.once('close', function() {
        _apiServer = null;
        accept();
      });
      _apiServer.close();
    });
  });

  // Test valid input
  test("input (valid)", function() {
    var url = 'http://localhost:61515/test-input';
    return request
      .get(url)
      .send({value: 5})
      .end()
      .then(function(res) {
        assert(res.ok, "Request failed");
        assert(res.text === "Hello World", "Got wrong value");
      });
  });

  // Test invalid input
  test("input (invalid)", function() {
    var url = 'http://localhost:61515/test-input';
    return request
      .get(url)
      .send({value: 11})
      .end()
      .then(function(res) {
        assert(res.status === 400, "Request wasn't rejected");
      });
  });

  // Test valid output
  test("output (valid)", function() {
    var url = 'http://localhost:61515/test-output';
    return request
      .get(url)
      .end()
      .then(function(res) {
        assert(res.ok, "Request okay");
        assert(res.body.value === 4, "Got wrong value");
      });
  });
});
