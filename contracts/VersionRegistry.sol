pragma solidity ^0.4.0;

import "./VersionUtils.sol";
import "./Version.sol";

contract VersionRegistry {
  uint8[3] public latestVersion;
  mapping (uint => string) public versionLockfiles;
  uint[] public versions;
  uint public versionCount;

  address[] public owners;
  uint public ownerCount;

  modifier onlyOwner {
    for (uint i = 0; i < owners.length; i++) {
      if (msg.sender == owners[i]) {
        _;
        break;
      }
    }
  }

  function VersionRegistry(address owner, uint8[3] version, string lockfileURI) {
    ownerCount = 1;
    owners.length = 1;
    owners[0] = owner;

    versionCount = 0;

    bool registered = register(version, lockfileURI);

    if (!registered) {
      throw;
    }
  }

  function register(uint8[3] version, string lockfileURI) onlyOwner returns (bool) {
    uint normalized = VersionUtils.normalize(version);
    string existingLockfileURI = versionLockfiles[normalized];

    if (bytes(existingLockfileURI).length != 0) return false;

    versionLockfiles[normalized] = lockfileURI;
    versionCount += 1;
    versions.length = versionCount;
    versions[versionCount - 1] = normalized;

    return true;
  }

  function getLockfile(uint8[3] version) returns (string) {
    uint normalized = VersionUtils.normalize(version);
    return versionLockfiles[normalized];
  }

  function getNumVersions() returns (uint) {
    return versions.length;
  }

  function getVersion(uint index) returns (uint) {
    return versions[index];
  }
}
