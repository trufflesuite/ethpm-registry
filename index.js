var VersionUtils = require("./build/contracts/VersionUtils.sol.js");
var PackageRegistry = require("./build/contracts/PackageRegistry.sol.js");
var Registry = require("./lib/registry.js");
var Web3 = require("web3");

var EPMRegistry = {
  deploy: function(provider, from_address) {
    if (typeof provider == "string") {
      from_address = provider;
      provider = null;
    }

    if (provider == null) {
      provider = new Web3.providers.HttpProvider("http://localhost:8545");
    }

    VersionUtils.defaults({
      from: from_address,
      gas: 3141592
    });

    PackageRegistry.defaults({
      from: from_address,
      gas: 3141592
    });

    VersionUtils.setProvider(provider);
    PackageRegistry.setProvider(provider);

    return VersionUtils.new().then(function(version_utils) {
      // This line is a little gross.
      VersionUtils.address = version_utils.address;

      PackageRegistry.link(VersionUtils);

      return PackageRegistry.new();
    });
  },

  use: function(address, from_address, provider) {
    return new Registry(address, from_address, provider);
  }
};

module.exports = EPMRegistry;
