const utils = require("./utils").module;

const log = utils.log;
const logEvents = utils.logEvents;
const eth = utils.eth;
const wallets = utils.wallets;

const deployments = {
  TestERC20: require("../deployments/localhost/TestERC20.json"),
  TestERC721: require("../deployments/localhost/TestERC721.json"),
  TestERC1155: require("../deployments/localhost/TestERC1155.json"),
  Consideration: require("../deployments/localhost/Consideration.json"),
  AuthenticatedProxy: require("../deployments/localhost/AuthenticatedProxy.json"),
  TokenTransferProxy: require("../deployments/localhost/TokenTransferProxy.json"),
  WyvernProxyRegistry: require("../deployments/localhost/WyvernProxyRegistry.json"),
};

// Add stuff that we want easy access to the global object
for (const key of Object.keys(utils || {})) {
  global[key] = utils[key];
}

// Add all ethers utils & constants to the global scope for easy access
Object.keys(eth.utils || {}).forEach((key) => {
  global[key] = eth.utils[key];
});
Object.keys(eth.constants || {}).forEach((key) => {
  global[key] = eth.constants[key];
});

// Save deployments to global scope
for (const key of Object.keys(deployments || {})) {
  console.log(`Loading deployed ${key} contract`);
  const deployment = deployments[key];
  global[key] = new eth.Contract(
    deployment.address,
    deployment.abi,
    wallets[0]
  );
}

global.fulfillBasicOrder = () => {};
global.fulfillOrder = () => {};
global.fulfillAdvancedOrder = () => {};
global.fulfillAvailableAdvancedOrders = () => {};
global.matchOrders = () => {};
global.matchAdvancedOrders = () => {};
global.cancel = () => {};

// Only one offer & consideration supported (for now)
global.validateOrder = (order, signer = wallets[0]) => {
  const parameters = order?.parameters || {};
  const offer = {
    itemType: 2, // ERC271
    token: global.TestERC721.address,
    identifierOrCriteria: 0,
    startAmount: 1,
    endAmount: 1,
    ...(parameters.offer?.[0] || {}),
  };
  const consideration = {
    itemType: 1, // ERC20
    token: global.TestERC20.address,
    identifierOrCriteria: 0,
    startAmount: eth.utils.parseEther("2"), // start the sale at 2 eth
    endAmount: eth.utils.parseEther("1"), // finish the sale at 1 eth
    recipient: signer.address,
    ...(parameters.consideration?.[0] || {}),
  };
  const fullOrder = {
    parameters: {
      offerer: signer.address,
      zone: eth.constants.AddressZero,
      offer: [offer],
      consideration: [consideration],
      orderType: 1,
      startTime: Math.round(Date.now() / 1000), // seconds from epoch until now
      endTime: Math.round(Date.now() / 1000) + 60 * 60, // 1 hour from now
      zoneHash: eth.constants.HashZero,
      salt: eth.constants.HashZero,
      conduit: eth.constants.AddressZero,
      totalOriginalConsiderationItems: 1,
      ...parameters,
    },
    signature: order?.signature || eth.constants.HashZero,
  };
  log(`Validating order: ${JSON.stringify(fullOrder, null, 2)}`);
  global.Consideration.connect(signer)
    .validate([fullOrder])
    .then((tx) => {
      // Save the hash to the global scope to make it easier to investigate after
      global.hash = tx.hash;
      // Print formatted events
      logEvents(tx.hash, deployments.Consideration.abi);
    });
};

global.incrementNonce = (signer = wallets[0]) => {
  global.Consideration.connect(signer)
    .incrementNonce()
    .then((tx) => {
      global.hash = tx.hash;
      logEvents(tx.hash, deployments.Consideration.abi);
    });
};