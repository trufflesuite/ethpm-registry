var assert = require("assert");
var util = require("ethereumjs-util");
var sha3 = require("solidity-sha3").default;
var leftPad = require("left-pad");

var HEX_CHAR_SIZE = 4;

contract("PackageDB", function(accounts) {
  var packageDb;

  function createVersionHash(name, major, minor, patch) {
    // Pulled from solidity-sha3
    function encodeNum(value, size) {
      return leftPad(web3.toHex(value < 0 ? value >>> 0 : value).slice(2), size / HEX_CHAR_SIZE, value < 0 ? 'F' : '0')
    }

    name = web3.toHex(name);
    major = encodeNum(major, 32);
    minor = encodeNum(minor, 32);
    patch = encodeNum(patch, 32);

    return web3.sha3([name, major, minor, patch].join(''), { encoding: 'hex' })
  }

  before("set up packageDb", function() {
    return PackageDB.new({from: accounts[0]}).then(function(instance) {
      packageDb = instance;
    });
  });

  it("should allow me to set a new release", function() {
    var name = "package";
    var major = 1;
    var minor = 0;
    var patch = 0;
    var lockfileURI = "http://consensys.net";

    var nameHash = web3.sha3(name);
    var versionHash = createVersionHash(name, major, minor, patch);

    return packageDb.setRelease(name, major, minor, patch, lockfileURI, {from: accounts[0]}).then(function() {
      return packageDb.packageNames(nameHash);
    }).then(function(result) {
      assert.equal(result, name);
      return packageDb.releaseLockFiles(versionHash);
    }).then(function(result) {
      assert.equal(result, lockfileURI);
    });;
  });
});
