var WhitelistAuthority = artifacts.require("WhitelistAuthority.sol");
var ReleaseValidator = artifacts.require("ReleaseValidator.sol");
var SemVersionLib = artifacts.require("SemVersionLib.sol");
var IndexedOrderedSetLib = artifacts.require("IndexedOrderedSetLib.sol");
var PackageDB = artifacts.require("PackageDB.sol");
var ReleaseDB = artifacts.require("ReleaseDB.sol");
var PackageIndex = artifacts.require("PackageIndex.sol");

// Rememver, web3 is given to us. Probably magic that needs to be removed.
// TODO: Remove hardcoding of signatures and have a function like this one search abis
// looking for the function by name, and error if a function is not found.
function four_byte_sig(signature) {
  return web3.sha3(signature).substring(0, 10);
}

module.exports = function(deployer) {
  deployer.deploy([
    WhitelistAuthority,
    ReleaseValidator,
    SemVersionLib,
    IndexedOrderedSetLib
  ]);
  deployer.link(SemVersionLib, [PackageDB, ReleaseDB]);
  deployer.link(IndexedOrderedSetLib, [PackageDB, ReleaseDB]);
  deployer.deploy([
    PackageDB,
    ReleaseDB,
    PackageIndex
  ]).then(function() {
    return Promise.all([
      PackageIndex.deployed().setPackageDb(PackageDB.address),
      PackageIndex.deployed().setReleaseDb(ReleaseDB.address),
      PackageIndex.deployed().setReleaseValidator(ReleaseValidator.address)
    ]);
  }).then(function() {
    return Promise.all([
      PackageDB.deployed().setAuthority(WhitelistAuthority.address),
      ReleaseDB.deployed().setAuthority(WhitelistAuthority.address),
      PackageIndex.deployed().setAuthority(WhitelistAuthority.address)
    ]);
  }).then(function() {
    return Promise.all([
      // ReleaseDB
      WhitelistAuthority.deployed().setCanCall(PackageIndex.address, ReleaseDB.address, four_byte_sig("setRelease(bytes32,bytes32,string)"), true),
      WhitelistAuthority.deployed().setAnyoneCanCall(ReleaseDB.address, four_byte_sig("setVersion(uint32,uint32,uint32,string,string)"), true),
      WhitelistAuthority.deployed().setAnyoneCanCall(ReleaseDB.address, four_byte_sig("updateLatestTree(bytes32)"), true),

      // PackageDB
      WhitelistAuthority.deployed().setCanCall(PackageIndex.address, PackageDB.address, four_byte_sig("setPackage(string)"), true),
      WhitelistAuthority.deployed().setCanCall(PackageIndex.address, PackageDB.address, four_byte_sig("setPackageOwner(bytes32,address)"), true),

      // PackageIndex
      WhitelistAuthority.deployed().setAnyoneCanCall(PackageIndex.address, four_byte_sig("release(string,uint32,uint32,uint32,string,string,string)"), true),
      WhitelistAuthority.deployed().setAnyoneCanCall(PackageIndex.address, four_byte_sig("transferPackageOwner(string,address)"), true)
    ]);
  });
};
