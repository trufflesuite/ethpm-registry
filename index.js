var PackageIndex = require("./build/contracts/PackageIndex.sol.js");
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

    PackageIndex.defaults({
      from: from_address,
      gas: 3141592
    });

    PackageIndex.setProvider(provider);

    return PackageIndex.new();
  },

  use: function(address, from_address, provider) {
    return new Registry(address, from_address, provider);
  }
};

module.exports = EPMRegistry;
