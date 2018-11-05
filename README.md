#Prerequisites
We need one address with small amount of ETH (0.2). We will refer to this address as a “Main Private Key”. We will use this address to send ETH to the addresses that we detect tokens at.

We presume that this private key is in JSON format, and locked with a password. So the script will asks us to provide the password of Main Private Key to it.

After that we need to provide the path of the keystore and password for those files. 

After we provide that 4 main parameters, the script will go over the keyfiles in that folder, clearing them of tokens and sending the tokens back to the main account.

## Running
```
$ npm install
$ node index.js
```
