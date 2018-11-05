'use strict';

require('dotenv').config();

const fs = require('fs');
const _ = require('lodash');
const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');
const CLI = require('clui');
const Spinner = CLI.Spinner;

const {getInformation} = require('./src/info');

const ethTx = require('ethereumjs-tx');
const Web3 = require('web3');

const web3 = new Web3(Web3.givenProvider || 'https://mainnet.infura.io/v3/767fe855a77643f39d4db1e343bb769f');
const contractData = require('./contract');

const TokenContract = new web3.eth.Contract(contractData, process.env.CONTRACT_ADDRESS);

clear();

console.log(chalk.yellow(
  figlet.textSync('Clean Vault', {horizontalLayout: 'full'}))
);
console.log(chalk.green(`Created by ${chalk.blue('ookie @ https://crowd.sale')}`));

// Spinners
const ethereumConnectionSpinner = new Spinner('Checking Ethereum blockchain connection...');
const dataValidationSpinner = new Spinner('Gathering the data...');
const dumpingDataToFileSpinner = new Spinner('Dumping data to file...');
const decyptingAccountsSpinner = new Spinner('Decrypting accounts...');
const sendingEtherToAccounts = new Spinner('Sending Ether to accounts...');
const sendingTokensToAccounts = new Spinner('Sending Tokens to accounts...');

ethereumConnectionSpinner.start();

web3.eth.getBlockNumber().then(data => {
  ethereumConnectionSpinner.stop();
  console.log(chalk.yellow('Checking connection...'));
  console.log(chalk.green(`Connected to Ethereum blockchain! Latest Block: ${chalk.blue(`${data}`)}`));
  
  web3.eth.net.getNetworkType().then(data => {
    console.log(chalk.green(`Network type: ${chalk.blue(`${data}`)}`));
    clearVault();
    
  }).catch(err => {
    throw err;
  });
  
}).catch(err => {
  console.log(chalk.red('Something went wrong while connecting to Ethereum blockchain'));
  console.log(chalk.red('Exiting process...'));
  ethereumConnectionSpinner.stop();
  process.exit();
});

let paidAccounts = [];
let iterator = 0;

async function clearVault() {
  try {
    const info = await getInformation();
    // now we need to check whether the information is correct
    dataValidationSpinner.start();
    
    if (info.privateKeysPath.substr(-1, 1) !== '/') {
      info.privateKeysPath += '/';
    }
    
    const masterKey = JSON.parse(fs.readFileSync(info.mainPrivateKeyPath).toString());
    
    const addressesWithTokens = await readFiles(info.privateKeysPath, masterKey);
    dataValidationSpinner.stop();
    
    await dumpToFile(addressesWithTokens);
    
    const unlockedAccounts = decryptAccounts(addressesWithTokens, info.keysPassword);
    const unlockedAccountsList = _.map(unlockedAccounts, 'address');
    const fullAmount = _.reduce(unlockedAccounts, 'amount');
    
    if (unlockedAccounts.length > 0) {
      console.log(chalk.green(`\nFound ${chalk.blue(unlockedAccounts.length)} accounts with Tokens!`));
      console.log(chalk.green(`\nThose accounts have ${chalk.blue(fullAmount)} tokens!`));
      
      const paidAcc = await initiateEtherSending(unlockedAccountsList, info, masterKey);
      
      fs.writeFileSync(__dirname + '/PAID_ACCOUNTS_ETHER.json', JSON.stringify(paidAcc));
      
      let tokenPaidAccounts = await initiateTokenSending(unlockedAccounts, masterKey.address);
      
      fs.writeFileSync(__dirname + '/PAID_ACCOUNTS_TOKEN.json', JSON.stringify(tokenPaidAccounts));
      
      console.log(chalk.blue('\nFINISHED SENDING TRANSACTIONS'));
      console.log(chalk.blue('\nExiting....'));
      process.exit(1);
    }
    
    console.log(chalk.red('\nThere were no Tokens in supplied folder. Check whether you input the correct folder'));
    process.exit(1);
    
  } catch (e) {
    throw e;
  }
  
}

function decryptAccounts(accounts, password) {
  decyptingAccountsSpinner.start();
  let lockedAccounts = [];
  accounts = _.map(accounts, e => {
    if (e.hasOwnProperty('Crypto')) {
      e.crypto = e.Crypto;
    }
    try {
      
      let acc = web3.eth.accounts.decrypt(e, password);
      acc.amount = e.amount;
      
      return acc;
    } catch (err) {
      lockedAccounts.push(e);
      console.error(err);
      return false;
    }
  });
  
  fs.writeFileSync(__dirname + '/FAILED_ACCOUNTS.json', JSON.stringify(lockedAccounts));
  
  decyptingAccountsSpinner.stop();
  return accounts;
}

async function readFiles(dirname, masterKey) {
  try {
    const fileNames = fs.readdirSync(dirname);
    
    let data = await Promise.all(_.map(fileNames, async fileName => {
        const object = JSON.parse(fs.readFileSync(dirname + fileName, 'utf-8'));
        
        const address = object.address;
        
        if (address) {
          let amount = await TokenContract.methods.balanceOf(`0x${address}`).call();
          if (amount > 0) {
            object.amount = amount;
            return object;
          }
        }
      })
    );
    
    // if there is any undefined objects or one of the addresses
    // in the array is Master Key's, we don't want them in array
    return _.reject(data, e => {
      if (e) {
        return e.address === masterKey.address;
      }
      
      return true;
    });
    
  } catch (e) {
    throw e;
  }
}

function dumpToFile(addressesWithTokens) {
  try {
    dumpingDataToFileSpinner.start();
    fs.writeFileSync(__dirname + '/ADDRESSES_WITH_TOKENS.json', JSON.stringify(addressesWithTokens));
    dumpingDataToFileSpinner.stop();
  } catch (e) {
    console.error(e);
    throw new Error('An error occurred when trying to dump to the file');
  }
}

async function initiateEtherSending(unlockedAccountsList, info, masterKey) {
  try {
    sendingEtherToAccounts.start();
    
    if (masterKey.hasOwnProperty('Crypto')) {
      masterKey.crypto = masterKey.Crypto;
    }
    
    masterKey = web3.eth.accounts.decrypt(masterKey, info.masterPassword);
    
    // should be couple of accounts here
    await recursiveFunction(masterKey, unlockedAccountsList);
    
    sendingEtherToAccounts.stop();
    console.log(chalk.blue('Ether is sent to the accounts'));
    return paidAccounts;
  } catch (e) {
    console.error(e);
    throw new Error('An error occurred when trying to decrypt the main private key!');
  }
}

async function initiateTokenSending(unlockedAccounts, masterAddress) {
  try {
    sendingTokensToAccounts.start();
    
    paidAccounts = [];
    iterator = 0;
    
    // should be couple of accounts here
    await recursiveTokenFunction(unlockedAccounts, masterAddress);
    
    sendingTokensToAccounts.stop();
    console.log(chalk.blue('Tokens are sent to the accounts'));
    return paidAccounts;
  } catch (e) {
    console.error(chalk.red(e));
    throw new Error('An error occurred when trying to decrypt the main private key!');
  }
}

async function recursiveFunction(masterKey, unlockedAccountsList) {
  try {
    const nonce = await web3.eth.getTransactionCount(masterKey.address);
    const txParams = {
      nonce: nonce,
      gasPrice: '0x12a05f200', // 5 GWei
      gasLimit: '0x5208', // Maybe we should remove this
      to: unlockedAccountsList[iterator],
      value: '0x11c37937e08000' // 0.005 ETH in Wei
    };
    
    // Transaction is created
    const tx = new ethTx(txParams);
    const privKey = Buffer.from(masterKey.privateKey.substring(2), 'hex');
    
    // Transaction is signed
    tx.sign(privKey);
    const serializedTx = tx.serialize();
    const rawTx = '0x' + serializedTx.toString('hex');
    console.log(chalk.green(`\nTrying to send Ether to account: ${chalk.blue('0x' + unlockedAccountsList[iterator])}`));
    const data = await web3.eth.sendSignedTransaction(rawTx);
    
    paidAccounts.push(data);
    iterator++;
    
    if (iterator >= unlockedAccountsList.length) {
      iterator = 0;
      return paidAccounts;
    }
    
    return recursiveFunction(masterKey, unlockedAccountsList, iterator);
  } catch (e) {
    console.error(chalk.bgRed(`\nFailed to send to account: ${chalk.blue('0x' + unlockedAccountsList[iterator])}`));
    throw e;
  }
}

async function recursiveTokenFunction(unlockedAccounts, masterAddress) {
  try {
    const nonce = await web3.eth.getTransactionCount(unlockedAccounts[iterator].address);
    
    const functionHash = '0xa9059cbb';
    let amountHash = hashAmount(unlockedAccounts[iterator].amount);
    
    let toAddress = '0'.repeat(64 - masterAddress.length) + masterAddress;
    
    amountHash = '0'.repeat(64 - amountHash.length) + amountHash;
    
    let txParams = {
      nonce: nonce,
      gasPrice: '0x12a05f200', // 5 GWei
      to: process.env.CONTRACT_ADDRESS,
      value: '0x00',
      data: `${functionHash}${toAddress}${amountHash}`,
      gasLimit: 910000
    };
    
    // Transaction is created
    const tx = new ethTx(txParams);
    
    const privKey = Buffer.from(unlockedAccounts[iterator].privateKey.substring(2), 'hex');
    
    // Transaction is signed
    tx.sign(privKey);
    const serializedTx = tx.serialize();
    const rawTx = '0x' + serializedTx.toString('hex');
    console.log(chalk.green(`\nTrying to send Tokens from account: ${unlockedAccounts[iterator].address}`));
    const data = await web3.eth.sendSignedTransaction(rawTx);
    
    paidAccounts.push(data);
    
    iterator++;
    
    if (iterator >= unlockedAccounts.length) {
      iterator = 0;
      return paidAccounts;
    }
    
    return recursiveTokenFunction(unlockedAccounts, masterAddress);
  } catch (e) {
    console.error(chalk.bgRed(`\nFailed to send from account: ${unlockedAccounts[iterator].address}`));
    throw e;
  }
}

function hashAmount(amount) {
  let result = parseInt(amount).toString(16);
  return '0'.repeat(64 - result.length) + result;
}
