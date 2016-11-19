pragma solidity ^0.4.0;

import "./VersionRegistry.sol";
import "./VersionUtils.sol";

// Warning: This is probably a terrible registry. However, it's enough to get started.

contract PackageRegistry {
  mapping (bytes32 => VersionRegistry) public packages;

  function PackageRegistry() {

  }

  function packageExists(bytes32 name) constant returns (bool) {
    return address(packages[name]) != 0x0;
  }

  function registerPackage(bytes32 name) returns (bool) {
    if (packageExists(name)) {
      return false;
    } else {
      packages[name] = new VersionRegistry(msg.sender);
      return true;
    }
  }

  function getVersionRegistry(bytes32 name) constant returns (address) {
    VersionRegistry registry = packages[name];
    return address(registry);
  }

}
