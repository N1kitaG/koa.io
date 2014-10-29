/*!
 * koa.io - test/application.test.js
 * Copyright(c) 2014 dead_horse <dead_horse@qq.com>
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */

var ioc = require('socket.io-client');
var request = require('supertest');
var pedding = require('pedding');
var should = require('should');
var koa = require('..');

describe('application', function () {
  describe('app', function () {
    it('should be instance of koa', function () {
      var app = App();
      (app instanceof require('koa')).should.be.ok;
    });
  });

  describe('app.io', function () {
    it('should be instanceof of socket.io', function () {
      var app = App();
      (app.io instanceof require('socket.io')).should.be.ok;
    });
  });

  describe('session', function () {
    describe('when no session', function () {
      it('should emit forbidden', function (done) {
        var app = App();
        var server = app.listen();
        var socket = client(server);
        done = pedding(done, 2);
        socket.on('connect', done);
        socket.on('forbidden', done);
      });
    });

    describe('when with session', function () {
      it('should emit user join', function (done) {
        var app = App();
        var server = app.listen();

        request(server)
          .get('/')
          .expect(200)
          .expect('hello', function (err, res) {
          should.not.exist(err);
          var cookie = encodeURIComponent(res.headers['set-cookie'].join(';'));
          var socket = client(server, {query: 'cookie=' + cookie});
          done = pedding(done, 3);
          socket.on('connect', done);
          socket.on('user join', function (name) {
            name.should.equal('foo');
            done();
            socket.disconnect();
            socket.on('user leave', function (name) {
              name.should.equal('foo');
              done();
            });
          });
        });
      });
    });
  });

  describe('app.keys=', function () {
    it('should set app.io.keys', function () {
      var app = koa();
      app.keys = ['foo'];
      app.io.keys.should.eql(['foo']);
      app._keys.should.eql(['foo']);
    });
  });

  describe('keys', function () {
    it('should get app._keys', function () {
      var app = koa();
      app.keys = ['foo'];
      app.keys.should.equal(app._keys);
    });
  });
});

function App() {
  var app = koa();
  app.keys = ['secrect'];

  app.io.use(function* (next) {
    // we can't send cookie in ioc
    this.header.cookie = this.query.cookie;
    yield *next;
  });

  app.session({
    namespace: '/'
  });

  app.use(function* () {
    this.session.user = { name: 'foo' };
    this.body = 'hello';
  });

  app.io.use(function* (next) {
    if (!this.session.user) {
      return this.socket.emit('forbidden');
    }
    this.emit('user join', this.session.user.name);
    yield next;
    this.emit('user leave', this.session.user.name);
  });

  app.io.route('message', function (next, message) {
    this.broadcase.emit('message', message);
  });

  return app;
}

// creates a socket.io client for the given server
function client(srv, nsp, opts){
  if ('object' == typeof nsp) {
    opts = nsp;
    nsp = null;
  }
  opts = opts || {};

  var addr = srv.address();
  if (!addr) addr = srv.listen().address();
  var url = 'ws://0.0.0.0:' + addr.port + (nsp || '');
  if (opts.query) {
    url += '?' + opts.query;
  }
  return ioc(url, opts);
}