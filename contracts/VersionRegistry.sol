pragma solidity ^0.4.0;

import "./VersionUtils.sol";
import "./Version.sol";

contract VersionRegistry {
  // Map a normalized verison to a string.
  mapping (uint => string) public versionLockfiles;

  // Keep track of versions and noramlized versions
  uint8[3][] versions;
  uint256[] public normalized_versions;
  uint256 public versionCount;

  // Keep track of who owns this package
  address[] public owners;
  uint256 public ownerCount;

  modifier onlyOwner {
    for (uint i = 0; i < owners.length; i++) {
      if (msg.sender == owners[i]) {
        _;
        break;
      }
    }
  }

  function VersionRegistry(address owner) {
    ownerCount = 1;
    owners.length = 1;
    owners[0] = owner;

    versionCount = 0;
  }

  function register(uint8[3] version, string lockfileURI) onlyOwner returns (bool) {
    uint normalized = VersionUtils.normalize(version);
    string existingLockfileURI = versionLockfiles[normalized];

    // If this version already exists, return false.
    if (bytes(existingLockfileURI).length != 0) return false;

    versionLockfiles[normalized] = lockfileURI;
    versionCount += 1;

    versions.length = versionCount;
    versions[versionCount - 1] = version;

    normalized_versions.length = versionCount;
    normalized_versions[versionCount - 1] = normalized;

    return true;
  }

  function getLockfile(uint8[3] version) constant returns (string) {
    uint normalized = VersionUtils.normalize(version);
    return versionLockfiles[normalized];
  }

  function getAllVersions() constant returns (uint8[3][]) {
    return versions;
  }

  function getNumVersions() constant returns (uint) {
    return versions.length;
  }

  function getVersion(uint index) constant returns (uint8[3]) {
    return versions[index];
  }

  function getNormalizedVersion(uint index) constant returns (uint) {
    return normalized_versions[index];
  }
}
