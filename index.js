var Registry = require("./lib/registry.js");

var EPMRegistry = {
  use: function(address, from_address, provider) {
    return new Registry(address, from_address, provider);
  }
};

module.exports = EPMRegistry;
