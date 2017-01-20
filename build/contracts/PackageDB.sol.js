var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("PackageDB error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("PackageDB error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("PackageDB contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of PackageDB: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to PackageDB.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: PackageDB not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "*": {
    "links": {},
    "events": {},
    "updated_at": 1481648228668
  },
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "major",
            "type": "uint32"
          },
          {
            "name": "minor",
            "type": "uint32"
          },
          {
            "name": "patch",
            "type": "uint32"
          },
          {
            "name": "releaseLockFileURI",
            "type": "string"
          }
        ],
        "name": "setRelease",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "newOwner",
            "type": "address"
          }
        ],
        "name": "setOwner",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "releaseLockFiles",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "major",
            "type": "uint32"
          },
          {
            "name": "minor",
            "type": "uint32"
          },
          {
            "name": "patch",
            "type": "uint32"
          }
        ],
        "name": "versionExists",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "newPackageOwner",
            "type": "address"
          }
        ],
        "name": "setPackageOwner",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "packageNames",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "packageOwner",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "name",
            "type": "string"
          }
        ],
        "name": "packageExists",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "latestMajor",
        "outputs": [
          {
            "name": "",
            "type": "uint32"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "packageVersionIds",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "packageVersions",
        "outputs": [
          {
            "name": "major",
            "type": "uint32"
          },
          {
            "name": "minor",
            "type": "uint32"
          },
          {
            "name": "patch",
            "type": "uint32"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "name",
            "type": "string"
          }
        ],
        "name": "numReleases",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "latestPatch",
        "outputs": [
          {
            "name": "",
            "type": "uint32"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "latestMinor",
        "outputs": [
          {
            "name": "",
            "type": "uint32"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "payable": false,
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b60008054600160a060020a0319166c01000000000000000000000000338102041790555b5b610f068061003d6000396000f3606060405236156100b95760e060020a60003504630523123c81146100be57806313af403514610172578063188c863a146101845780632cf63615146102025780633c26b98914610276578063535f2dee146102cd5780635f49d4d11461034b57806383ea06201461037757806385ddd4a0146103de57806389bbfc5f146104075780638da5cb5b14610429578063d11604a114610452578063e002a95f1461048d578063e0ee24cc146104f2578063f1eab0fc1461051b575b610000565b346100005761015e600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375050604080516020601f60608a01358b0180359182018390048302840183018552818452989a8a359a838101359a958101359950909750608001955091935091820191819084018382808284375094965061054495505050505050565b604080519115158252519081900360200190f35b3461000057610182600435610a4e565b005b3461000057610194600435610aa4565b60405180806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156101f45780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761015e600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505084359460208101359450604001359250610b3e915050565b604080519115158252519081900360200190f35b3461000057610182600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505093359350610c5692505050565b005b3461000057610194600435610cf2565b60405180806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156101f45780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761035b600435610d8b565b60408051600160a060020a039092168252519081900360200190f35b346100005761015e600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650610da695505050505050565b604080519115158252519081900360200190f35b34610000576103ee600435610dfc565b6040805163ffffffff9092168252519081900360200190f35b3461000057610417600435610e14565b60408051918252519081900360200190f35b346100005761035b610e26565b60408051600160a060020a039092168252519081900360200190f35b3461000057610465600435602435610e35565b6040805163ffffffff9485168152928416602084015292168183015290519081900360600190f35b3461000057610417600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650610e8495505050505050565b60408051918252519081900360200190f35b34610000576103ee600435610ed6565b6040805163ffffffff9092168252519081900360200190f35b34610000576103ee600435610eee565b6040805163ffffffff9092168252519081900360200190f35b600080548190819081908190819033600160a060020a03908116911614156100b9578a604051808280519060200190808383829060006004602084601f0104600302600f01f150905001915050604051809103902094508a8a8a8a604051808580519060200190808383829060006004602084601f0104600302600f01f1509050018463ffffffff1660e060020a0281526004018363ffffffff1660e060020a0281526004018263ffffffff1660e060020a028152600401945050505050604051809103902093506000925061061c8b8b8b8b610b3e565b151561068c5760008581526003602052604090208054600181018083559094509081858015829011610682576000838152602090206106829181019083015b8082111561067e5780546bffffffffffffffffffffffff1916815560010161065b565b5090565b5b5050505061069e565b60008481526004602052604090205492505b8660016000866000191681526020019081526020016000209080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106106ff57805160ff191683800117855561072c565b8280016001018555821561072c579182015b8281111561072c578251825591602001919060010190610711565b5b5061074d9291505b8082111561067e5760008155600101610735565b5090565b50508a60026000876000191681526020019081526020016000209080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106107b057805160ff19168380011785556107dd565b828001600101855582156107dd579182015b828111156107dd5782518255916020019190600101906107c2565b5b506107fe9291505b8082111561067e5760008155600101610735565b5090565b5050604080516060810182528b815260208082018c90528183018b905260008881526003909152919091208054859081101561000057906000526020600020900160005b508151815460208085015160409586015163ffffffff1990931660e060020a9485028590041767ffffffff00000000191664010000000091850285900491909102176bffffffff00000000000000001916680100000000000000009284029390930491909102919091179091556000868152600480835283822087905592518e518f948f94929384938781019392839286928492879291601f850104600302600f01f1509050018263ffffffff1660e060020a02815260040192505050604051809103902091508a8a8a604051808480519060200190808383829060006004602084601f0104600302600f01f15060e060020a63ffffffff9687168102939091019283529385169093026004820152604080519182900360080190912060008b8152600660205291909120549095508316928e16929092111592506109a8915050576000858152600660205260409020805463ffffffff191660e060020a8c8102041790555b60008281526007602052604090205463ffffffff908116908a1611156109ec576000828152600760205260409020805463ffffffff191660e060020a8b8102041790555b60008181526008602052604090205463ffffffff9081169089161115610a30576000818152600860205260409020805463ffffffff191660e060020a8a8102041790555b600195505b610a3f565b610000565b5b505050505095945050505050565b60005433600160a060020a03908116911614156100b9576000805473ffffffffffffffffffffffffffffffffffffffff19166c01000000000000000000000000838102041790555b610aa0565b610000565b5b50565b60016020818152600092835260409283902080548451600294821615610100026000190190911693909304601f8101839004830284018301909452838352919290830182828015610b365780601f10610b0b57610100808354040283529160200191610b36565b820191906000526020600020905b815481529060010190602001808311610b1957829003601f168201915b505050505081565b6000600085858585604051808580519060200190808383829060006004602084601f0104600302600f01f15060e060020a63ffffffff97881681029390910192835294861685026004830152509190931690910260088201526040805191829003600c01822060008181526001602081905292902080549196507fc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a4709550935082918491600261010092821615929092026000190116048015610c375780601f10610c15576101008083540402835291820191610c37565b820191906000526020600020905b815481529060010190602001808311610c23575b5050915050604051809103902060001916141591505b50949350505050565b6000805433600160a060020a03908116911614156100b95782604051808280519060200190808383829060006004602084601f0104600302600f01f150604080519190930181900390206000818152600560205292909220805473ffffffffffffffffffffffffffffffffffffffff19166c010000000000000000000000008881020417905550925050505b610cec565b610000565b5b505050565b600260208181526000928352604092839020805484516001821615610100026000190190911693909304601f8101839004830284018301909452838352919290830182828015610b365780601f10610b0b57610100808354040283529160200191610b36565b820191906000526020600020905b815481529060010190602001808311610b1957829003601f168201915b505050505081565b600560205260009081526040902054600160a060020a031681565b6000600082604051808280519060200190808383829060006004602084601f0104600302600f01f15060408051919093018190039020600081815260036020529290922054151595509093505050505b50919050565b60066020526000908152604090205463ffffffff1681565b60046020526000908152604090205481565b600054600160a060020a031681565b600360205281600052604060002081815481101561000057906000526020600020900160005b505463ffffffff8082169350640100000000820481169250680100000000000000009091041683565b60006003600083604051808280519060200190808383829060006004602084601f0104600302600f01f1506040805191909301819003902085525060208401949094525050016000205490505b919050565b60086020526000908152604090205463ffffffff1681565b60076020526000908152604090205463ffffffff168156",
    "events": {},
    "updated_at": 1481666090366
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "PackageDB";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.PackageDB = Contract;
  }
})();
