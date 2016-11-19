var assert = require("assert");
var EthPM = require("ethpm");
var Registry = require("../lib/registry");
var temp = require("temp").track();
var fs = require("fs-extra");
var path = require("path");
var ipfsd = require("ipfsd-ctl");
var TestRPC = require("ethereumjs-testrpc");
var EPMR = require("../index");
var Web3 = require("web3");

describe("EthPM integration", function() {
  var package_path;
  var config;
  var ipfs_host;
  var ipfs_port;
  var host;
  var registry;
  var registry_address;
  var provider = TestRPC.provider({
    seed: "keep it deterministic",
    // logger: console,
    // verbose: true
  });
  var web3 = new Web3(provider);
  var accounts;

  before("get accounts", function(done) {
    web3.eth.getAccounts(function(err, accs) {
      if (err) return done(err);
      accounts = accs;
      done();
    });
  });

  before("deploy registry", function() {
    return EPMR.deploy(provider, accounts[0]).then(function(registry) {
      registry_address = registry.address;
    });
  });

  before("set up IPFS server", function(done) {
    this.timeout(5000);

    ipfsd.disposableApi(function (err, ipfs) {
      if (err) return done(err);

      ipfs_host = ipfs.apiHost;
      ipfs_port = ipfs.apiPort;

      done(err);
    });
  });

  before("set up test package", function(done) {
    var temp_package_path = temp.mkdirSync("eth-registry-test-package-");
    var example_package = path.resolve(path.join(__dirname, "./owned-example"));

    fs.copy(example_package, temp_package_path, function(err) {
      if (err) return done(err);

      package_path = temp_package_path;
      done();
    });
  });

  before("set up ethpm config", function() {
    this.timeout(5000);
    host = new EthPM.hosts.IPFS(ipfs_host, ipfs_port);
    registry = new Registry(registry_address, accounts[0], provider);
    config = EthPM.configure(package_path, host, registry);
  });

  it("registers the package correctly", function(done) {
    // Note we cheat a little bit here so we don't have to add more dependencies
    // or do any compiling.
    var contract_metadata = {owned: {}, mortal: {}, transferable: {}};
    EthPM.publishPackage(config, contract_metadata).then(function() {
      return registry.getAllVersions("owned");
    }).then(function(versions) {
      assert.equal(versions.length, 1);
      assert.equal(versions[0], "1.0.0");

      return registry.getLockfileURI("owned", versions[0]);
    }).then(function(lockfileURI) {
      assert.notEqual(lockfileURI, null);

      return host.get(lockfileURI);
    }).then(function(lockfile_contents) {
      var lockfile = JSON.parse(lockfile_contents);

      return host.get(lockfile.package_manifest);
    }).then(function(manifest_file_contents) {
      var manifest = JSON.parse(manifest_file_contents);

      fs.readFile(path.resolve(path.join(package_path, "epm.json")), "utf8", function(err, contents) {
        if (err) return done(err);
        var expected_manifest = JSON.parse(contents);

        assert.deepEqual(manifest, expected_manifest);

        done();
      });
    }).catch(done);
  });

  it("registers a second version correctly", function(done) {
    done();
  });


});
