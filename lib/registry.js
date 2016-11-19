var PackageRegistry = require("../build/contracts/PackageRegistry.sol");
var VersionRegistry = require("../build/contracts/VersionRegistry.sol");
var semver = require("semver");

function Registry(registry_address, from_address, provider) {
  PackageRegistry.setProvider(provider);
  VersionRegistry.setProvider(provider);

  PackageRegistry.defaults({
    from: from_address,
    gas: 3141592
  });

  VersionRegistry.defaults({
    from: from_address,
    gas: 3141592
  });

  this.package_registry = PackageRegistry.at(registry_address);
};

Registry.prototype.getAllVersions = function(package_name) {
  var version_registry;

  return this.package_registry.getVersionRegistry(package_name).then(function(address) {
    version_registry = VersionRegistry.at(address);
    return version_registry.getAllVersions();
  }).then(function(versions) {
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
    version = v;
    return self.package_registry.getVersionRegistry(package_name);
  }).then(function(address) {
    var version_registry = VersionRegistry.at(address);
    var version_array = self.convertToArray(version);

    return version_registry.getLockfile(version_array);
  });
};

Registry.prototype.register = function(package_name, version, lockfileURI) {
  var self = this;

  return this.package_registry.packageExists(package_name).then(function(exists) {
    if (exists) return true;

    return self.package_registry.registerPackage(package_name);
  }).then(function(success) {
    if (!success) {
      throw new Error("Could not register package.");
    }

    return self.package_registry.getVersionRegistry(package_name);
  }).then(function(address) {
    var version_registry = VersionRegistry.at(address);
    var version_array = self.convertToArray(version);

    return version_registry.register(version_array, lockfileURI);
  }).then(function(success) {
    if (success == false) {
      throw new Error("Could not register package. Does the version already exist?");
    }
  });
};

Registry.prototype.convertToArray = function(version) {
  return version.split(".").map(function(num) {
    return parseInt(num);
  });
}

module.exports = Registry;
