// Generated by CoffeeScript 1.3.3
(function() {
  var Hem, Package, argv, compilers, css, fs, help, httpProxy, optimist, path, spawn, strata;

  path = require('path');

  fs = require('fs');

  optimist = require('optimist');

  strata = require('strata');

  compilers = require('./compilers');

  Package = require('./package');

  css = require('./css');

  spawn = require('child_process').spawn;

  httpProxy = require('http-proxy');

  argv = optimist.usage(['  usage: hem COMMAND', '    server  start a dynamic development server', '    build   serialize application to disk', '    watch   build & watch disk for changes', '    test    build and run tests'].join("\n")).alias('p', 'port').alias('d', 'debug').alias('t', 'tests').argv;

  help = function() {
    optimist.showHelp();
    return process.exit();
  };

  Hem = (function() {

    Hem.exec = function(command, options) {
      return (new this(options)).exec(command);
    };

    Hem.include = function(props) {
      var key, value, _results;
      _results = [];
      for (key in props) {
        value = props[key];
        _results.push(this.prototype[key] = value);
      }
      return _results;
    };

    Hem.prototype.compilers = compilers;

    Hem.prototype.options = {
      slug: './slug.json',
      paths: ['./app'],
      port: process.env.PORT || argv.port || 9294,
      host: argv.host || 'localhost',
      useProxy: argv.useProxy || false,
      apiHost: argv.apiHost || 'localhost',
      apiPort: argv.apiPort || 8080,
      proxyPort: argv.proxyPort || 8001,
      "public": './public',
      css: './css',
      cssPath: '/application.css',
      libs: [],
      dependencies: [],
      jsPath: '/application.js',
      testPublic: './test/public',
      testPath: '/test',
      specs: './test/specs',
      specsPath: '/specs.js'
    };

    function Hem(options) {
      var key, value, _ref;
      if (options == null) {
        options = {};
      }
      for (key in options) {
        value = options[key];
        this.options[key] = value;
      }
      if (fs.existsSync(this.options.slug)) {
        _ref = this.readSlug();
        for (key in _ref) {
          value = _ref[key];
          this.options[key] = value;
        }
      } else {
        throw new Error("Unable to find " + this.options.slug + " file.");
      }
    }

    Hem.prototype.server = function() {
      var startsWithSpinePath,
        _this = this;
      this.removeOldBuilds();
      strata.use(strata.contentLength);
      strata.get(this.options.cssPath, this.cssPackage().createServer());
      strata.get(this.options.jsPath, this.hemPackage().createServer());
      if (fs.existsSync(this.options["public"])) {
        strata.use(strata.file, this.options["public"], ['index.html', 'index.htm']);
      }
      if (fs.existsSync(this.options.testPublic)) {
        strata.map(this.options.testPath, function(app) {
          app.get(_this.options.specsPath, _this.specsPackage().createServer());
          return app.use(strata.file, _this.options.testPublic, ['index.html', 'index.htm']);
        });
      }
      strata.run({
        port: this.options.port,
        host: this.options.host
      });
      if (this.options.useProxy) {
        console.log("proxy server @ http://localhost:" + this.options.proxyPort);
        startsWithSpinePath = new RegExp("^" + this.options.baseSpinePath);
        return httpProxy.createServer(function(req, res, proxy) {
          if (startsWithSpinePath.test(req.url)) {
            req.url = req.url.replace(_this.options.baseSpinePath, '/');
            return proxy.proxyRequest(req, res, {
              host: _this.options.host,
              port: _this.options.port
            });
          } else {
            return proxy.proxyRequest(req, res, {
              host: _this.options.apiHost,
              port: _this.options.apiPort
            });
          }
        }).listen(this.options.proxyPort);
      }
    };

    Hem.prototype.removeOldBuilds = function() {
      var packages, pkg, _i, _len, _results;
      packages = [this.hemPackage(), this.cssPackage(), this.specsPackage()];
      _results = [];
      for (_i = 0, _len = packages.length; _i < _len; _i++) {
        pkg = packages[_i];
        _results.push(pkg.unlink());
      }
      return _results;
    };

    Hem.prototype.build = function(options) {
      var source;
      if (options == null) {
        options = {
          hem: true,
          css: true,
          specs: true
        };
      }
      if (options.hem) {
        console.log("Building hem target: " + (this.hemPackage().target));
        source = this.hemPackage().compile(!argv.debug);
        fs.writeFileSync(this.hemPackage().target, source);
      }
      if (options.css) {
        console.log("Building css target: " + (this.cssPackage().target));
        source = this.cssPackage().compile();
        fs.writeFileSync(this.cssPackage().target, source);
      }
      if (options.specs) {
        console.log("Building specs target: " + (this.specsPackage().target));
        source = this.specsPackage().compile();
        return fs.writeFileSync(this.specsPackage().target, source);
      }
    };

    Hem.prototype.watch = function() {
      var dir, lib, _i, _len, _ref, _results,
        _this = this;
      this.build();
      if (argv.tests) {
        this.executeTestacular();
      }
      _ref = ((function() {
        var _j, _len, _ref, _results1;
        _ref = this.options.libs;
        _results1 = [];
        for (_j = 0, _len = _ref.length; _j < _len; _j++) {
          lib = _ref[_j];
          _results1.push(path.dirname(lib));
        }
        return _results1;
      }).call(this)).concat(this.options.css, this.options.paths, this.options.specs);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        dir = _ref[_i];
        if (!fs.existsSync(dir)) {
          continue;
        }
        _results.push(require('watch').watchTree(dir, {
          persistent: true,
          interval: 1000
        }, function(file, curr, prev) {
          var hemBuild, specsBuild;
          if (curr && (curr.nlink === 0 || +curr.mtime !== +(prev != null ? prev.mtime : void 0))) {
            console.log("" + file + " changed.  Rebuilding.");
            specsBuild = ("./" + file).indexOf(_this.options.specs) === 0;
            hemBuild = !specsBuild;
            return _this.build({
              specs: specsBuild,
              hem: hemBuild
            });
          }
        }));
      }
      return _results;
    };

    Hem.prototype.test = function() {
      this.build();
      return this.executeTestacular(true);
    };

    Hem.prototype.executeTestacular = function(singleRun) {
      var testConfig;
      if (singleRun == null) {
        singleRun = false;
      }
      if (!this.testactular) {
        this.testacular = require('testacular').server;
        testConfig = {
          configFile: require.resolve("../assets/testacular.conf.js"),
          basePath: process.cwd(),
          singleRun: singleRun,
          browsers: ['PhantomJS'],
          logLevel: 2,
          reporters: ['progress']
        };
        return this.testacular.start(testConfig);
      }
    };

    Hem.prototype.exec = function(command) {
      if (command == null) {
        command = argv._[0];
      }
      if (!this[command]) {
        return help();
      }
      switch (command) {
        case 'build':
          console.log('Build application');
          break;
        case 'watch':
          console.log('Watching application');
          break;
        case 'test':
          console.log('Test application');
      }
      return this[command]();
    };

    Hem.prototype.readSlug = function(slug) {
      if (slug == null) {
        slug = this.options.slug;
      }
      if (!(slug && fs.existsSync(slug))) {
        return {};
      }
      return JSON.parse(fs.readFileSync(slug, 'utf-8'));
    };

    Hem.prototype.cssPackage = function() {
      return css.createPackage({
        path: this.options.css,
        target: path.join(this.options["public"], this.options.cssPath)
      });
    };

    Hem.prototype.hemPackage = function() {
      return Package.createPackage({
        dependencies: this.options.dependencies,
        paths: this.options.paths,
        libs: this.options.libs,
        target: path.join(this.options["public"], this.options.jsPath)
      });
    };

    Hem.prototype.specsPackage = function() {
      return Package.createPackage({
        identifier: 'specs',
        paths: this.options.specs,
        target: path.join(this.options.testPublic, this.options.specsPath),
        extraJS: "require('lib/setup'); for (var key in specs.modules) specs(key);",
        test: true
      });
    };

    return Hem;

  })();

  module.exports = Hem;

}).call(this);
