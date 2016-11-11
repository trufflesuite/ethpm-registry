pragma solidity ^0.4.0;

library VersionUtils {
  function normalize(uint8[3] version) returns (uint) {
    return (uint256(version[0]) * 1000000) + (uint256(version[1]) * 1000) + uint256(version[2]);
  }

  // If base is equal to comparator
  function isEqual(uint8[3] base, uint8[3] comparator) returns (bool) {
    return normalize(base) == normalize(comparator);
  }

  // If base is greather than comparator
  function isGreaterThan(uint8[3] base, uint8[3] comparator) returns (bool) {
    return normalize(base) > normalize(comparator);
  }

  // If base is less than comparator
  function isLessThan(uint8[3] base, uint8[3] comparator) returns (bool) {
    return normalize(base) < normalize(comparator);
  }
}
