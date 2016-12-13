var PackageIndex = require("../build/contracts/PackageIndex.sol");
var semver = require("semver");

function Registry(registry_address, from_address, provider) {
  PackageIndex.setProvider(provider);

  PackageIndex.defaults({
    from: from_address,
    gas: 3141592
  });

  this.package_index = PackageIndex.at(registry_address);
};

Registry.prototype.getAllVersions = function(package_name) {
  return this.package_index.getReleases(package_name).then(function(versions) {
    // Convert them to strings and sort
    return versions.map(function(version_array) {
      return version_array.join(".");
    }).sort();
  });
}

Registry.prototype.resolveVersion = function(package_name, version_range) {
  return this.getAllVersions(package_name).then(function(versions) {
    // This can be optimized.
    var max = null;

    versions.forEach(function(version) {
      if (semver.satisfies(version, version_range)) {
        if (max == null || semver.gte(version, max)) {
          max = version;
        }
      }
    });

    return max;
  });
};

Registry.prototype.getLockfileURI = function(package_name, version_range) {
  var self = this;
  var version_registry;
  var version;

  return this.resolveVersion(package_name, version_range).then(function(v) {
    version = self.convertToArray(v);
    return self.package_index.getReleaseLockFile(package_name, version[0], version[1], version[2]);
  });
};

Registry.prototype.register = function(package_name, version, lockfileURI) {
  var self = this;
  version = self.convertToArray(version);
  return this.package_index.release(package_name, version[0], version[1], version[2], lockfileURI);
};

Registry.prototype.convertToArray = function(version) {
  return version.split(".").map(function(num) {
    return parseInt(num);
  });
}

module.exports = Registry;
