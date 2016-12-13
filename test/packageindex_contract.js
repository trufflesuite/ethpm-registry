var assert = require("assert");
var util = require("ethereumjs-util");
var sha3 = require("solidity-sha3").default;
var leftPad = require("left-pad");

var HEX_CHAR_SIZE = 4;

contract("PackageIndex", function(accounts) {
  var packageIndex;

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

  before("set up PackageIndex", function() {
    return PackageIndex.new({from: accounts[0]}).then(function(instance) {
      packageIndex = instance;
    });
  });

  it("should allow me to release a new package", function() {
    var name = "package";
    var major = 1;
    var minor = 0;
    var patch = 0;
    var lockfileURI = "ipfs://QmcEpDiMdVQ4BTszWKMe8KkdEyhx6XmsfDCCs5c78HUyyb";

    var nameHash = web3.sha3(name);
    var versionHash = createVersionHash(name, major, minor, patch);

    return packageIndex.release(name, major, minor, patch, lockfileURI, {from: accounts[0]}).then(function() {
      // This is a good test that everything else was set correctly given that
      // I also have tests for the PackageDB.
      return packageIndex.getReleaseLockFile(name, major, minor, patch);
    }).then(function(result) {
      assert.equal(result, lockfileURI);

      return packageIndex.getReleases(name);
    }).then(function(releases) {
      assert(releases[0][0].eq(major));
      assert(releases[0][1].eq(minor));
      assert(releases[0][2].eq(patch));
    });
  });
});
