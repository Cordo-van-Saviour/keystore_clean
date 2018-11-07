'use strict';

const inquirer = require('inquirer');
const fs = require('fs');

function getInformation() {
  const questions = [
    {
      name: 'privateKeysPath',
      type: 'input',
      message: 'Enter the path of your private keys folder: ',
      default: '/home/ubuntu/parity/keys/',
      
      validate: function(value) {
        if (value.length && fs.existsSync(value)) {
          return true;
        } else {
          return 'Please enter the path of your private keys folder.';
        }
      }
    },
    {
      name: 'mainPrivateKeyPath',
      type: 'input',
      message: 'Enter the path of your Main Private Key file: ',
      default: '/home/ubuntu/MasterKey.json',
      validate: function(value) {
        if (value.length) {
          
          try {
            fs.accessSync(value, fs.constants.R_OK | fs.constants.W_OK);
            return true;
          } catch (err) {
            console.error(chalk.red('Please enter the path of your Main Private Key file.'));
            return 'Please enter the path of your Master Key file.';
          }
        } else {
          return 'Please enter the path of your Master Key file.';
        }
      }
    },
    {
      name: 'masterPassword',
      type: 'password',
      message: 'Enter your Master Key password:',
      default: '1234567890',
      validate: function(value) {
        if (value.length) {
          return true;
        } else {
          return 'Please enter your Master Key password.';
        }
      }
    },
    {
      name: 'keysPassword',
      type: 'password',
      message: 'Enter your Slave Keys password:',
      default: '',
      validate: function(value) {
        if (value.length) {
          return true;
        } else {
          return 'Please enter your Slave Keys password.';
        }
      }
    }
  ];
  return inquirer.prompt(questions);
}

module.exports = {
  getInformation: getInformation
};


