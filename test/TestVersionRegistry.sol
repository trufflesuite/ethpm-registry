pragma solidity ^0.4.2;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/VersionRegistry.sol";
import "../contracts/VersionUtils.sol";

contract Proxy {
  function register(VersionRegistry registry, uint8[3] version, string lockfileURI) {
    registry.register(version, lockfileURI);
  }
}

contract TestVersionRegistry {
  VersionRegistry public registry;

  function beforeAll() {
    uint8[3] memory version = [0,0,1];

    registry = new VersionRegistry(this, version, "http://consensys.net");
  }

  function testInitialValues() {
    Assert.equal(registry.ownerCount(), 1, "There should be an initial owner.");
    Assert.equal(registry.owners(0), this, "Owner should be the test contract.");
    Assert.equal(registry.getNumVersions(), 1, "There should be one version registered.");
    Assert.equal(registry.getVersion(0), 1, "Expected the first version registered to be version 1.");
  }

  function testRegisterWithNewVersion() {
    uint8[3] memory version = [1,1,1];

    registry.register(version, "http://consensys.net");

    Assert.equal(registry.getNumVersions(), 2, "There should be two versions registered.");
    Assert.equal(registry.getVersion(1), 1001001, "Expected the 1.1.1 to have a normalized version of 1001001");
  }

  function testOnlyOwnerCanRegister() {
    uint8[3] memory version = [1,1,2];

    Proxy p = new Proxy();
    p.register(registry, version, "http://consensys.net");

    Assert.equal(registry.getNumVersions(), 2, "There should only be two versions registered.");
  }

  function testCannotRegisterSameVersionTwice() {
    uint8[3] memory version = [1,1,1];

    registry.register(version, "http://consensys.net");

    Assert.equal(registry.getNumVersions(), 2, "There should only be two versions registered.");
  }

}
