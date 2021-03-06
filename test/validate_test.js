suite("api/validate", function() {
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
    description:  "Another test api"
  });

  // Declare a method we can test input with
  api.declare({
    method:   'post',
    route:    '/test-input',
    name:     'testInput',
    input:    'http://localhost:4321/test-schema.json',
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
    output:   'http://localhost:4321/test-schema.json',
    title:    "Test End-Point",
    description:  "Place we can call to test something",
  }, function(req, res) {
    res.reply({value: 4});
  });

  // Declare a method we can use to test invalid output
  api.declare({
    method:   'get',
    route:    '/test-invalid-output',
    name:     'testInput',
    output:   'http://localhost:4321/test-schema.json',
    title:    "Test End-Point",
    description:  "Place we can call to test something",
  }, function(req, res) {
    res.reply({value: 12});
  });

  // Declare a method we can test input validation skipping on
  api.declare({
    method:   'post',
    route:    '/test-skip-input-validation',
    name:     'testInputSkipInputValidation',
    input:    'http://localhost:4321/test-schema.json',
    skipInputValidation: true,
    title:    "Test End-Point",
    description:  "Place we can call to test something",
  }, function(req, res) {
    res.status(200).send("Hello World");
  });

  // Declare a method we can test output validation skipping on
  api.declare({
    method:   'get',
    route:    '/test-skip-output-validation',
    name:     'testOutputSkipInputValidation',
    output:    'http://localhost:4321/test-schema.json',
    skipOutputValidation: true,
    title:    "Test End-Point",
    description:  "Place we can call to test something",
  }, function(req, res) {
    res.reply({value: 12});
  });

  // Declare a method we can test blob output on
  api.declare({
    method:   'get',
    route:    '/test-blob-output',
    name:     'testBlobOutput',
    output:   'blob',
    title:    "Test End-Point",
    description: "Place we can call to test something",
  }, function(req, res) {
    res.reply({value: 'Hello World'});
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
      .post(url)
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
      .post(url)
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

  // test invalid output
  test("output (invalid)", function() {
    var url = 'http://localhost:61515/test-invalid-output';
    return request
      .get(url)
      .end()
      .then(function(res) {
        assert(res.status === 500, "Request wasn't 500");
      });
  });

  // test skipping input validation
  test("skip input validation", function() {
    var url = 'http://localhost:61515/test-skip-input-validation';
    return request
      .post(url)
      .send({value: 100})
      .end()
      .then(function(res) {
        assert(res.ok, "Request failed");
        assert(res.text === "Hello World", "Got wrong value");
      });
  });

  // test skipping output validation
  test("skip output validation", function() {
    var url = 'http://localhost:61515/test-skip-output-validation';
    return request
      .get(url)
      .end()
      .then(function(res) {
        assert(res.ok, "Request failed");
        assert(res.body.value === 12, "Got wrong value");
      });
  });

  // test blob output
  test("blob output", function() {
    var url = 'http://localhost:61515/test-blob-output';
    return request
      .get(url)
      .end()
      .then(function(res) {
        assert(res.ok, "Request failed");
        assert(res.body.value === "Hello World", "Got wrong value");
      });
  });

  test("input (correct content-type)", function() {
    var url = 'http://localhost:61515/test-input';
    return request
      .post(url)
      .send(JSON.stringify({value: 5}))
      .set('content-type', 'application/json')
      .end()
      .then(function(res) {
        assert(res.status === 200, "Request rejected");
      });
  });

  test("input (wrong content-type)", function() {
    var url = 'http://localhost:61515/test-input';
    return request
      .post(url)
      .send(JSON.stringify({value: 5}))
      .set('content-type', 'text/x-json')
      .end()
      .then(function(res) {
        assert(res.status === 400, "Request wasn't rejected");
      });
  });
});
