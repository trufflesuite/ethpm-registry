pragma solidity ^0.4.0;

import "./VersionRegistry.sol";
import "./VersionUtils.sol";

// Warning: This is probably a terrible registry. However, it's enough to get started.

contract PackageRegistry {
  mapping (bytes32 => VersionRegistry) public packages;

  function PackageRegistry() {

  }

  function register(bytes32 name, uint8[3] version, string lockfileURI) returns (bool) {
    if (address(packages[name]) == 0x0) {
      return registerNewPackageAndVersion(msg.sender, name, version, lockfileURI);
    } else {
      return registerNewVersion(msg.sender, name, version, lockfileURI);
    }
  }

  function registerNewPackageAndVersion(address owner, bytes32 name, uint8[3] version, string lockfileURI) internal returns (bool) {
    packages[name] = new VersionRegistry(owner, version, lockfileURI);
    return true;
  }

  function registerNewVersion(address owner, bytes32 name, uint8[3] version, string lockfileURI) internal returns (bool) {
    VersionRegistry registry = packages[name];
    return registry.register(version, lockfileURI);
  }

}
