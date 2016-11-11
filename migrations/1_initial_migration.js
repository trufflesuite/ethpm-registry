module.exports = function(deployer) {
  deployer.deploy(Migrations);
  deployer.deploy(VersionUtils);
  deployer.autolink();
  deployer.deploy(PackageRegistry);
};
