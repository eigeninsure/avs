import * as dotenv from "dotenv";

import { ethers } from "ethers";

const fs = require('fs');
const path = require('path');
dotenv.config();

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
/// TODO: Hack
let chainId = 31337;

const avsDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/hello-world/${chainId}.json`), 'utf8'));
const helloWorldServiceManagerAddress = avsDeploymentData.addresses.helloWorldServiceManager;
const helloWorldServiceManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/HelloWorldServiceManager.json'), 'utf8'));
// Initialize contract objects from ABIs
const helloWorldServiceManager = new ethers.Contract(helloWorldServiceManagerAddress, helloWorldServiceManagerABI, wallet);


// Function to generate random names
function generateRandomIpfsCIDs(): string {
    const ipfsCIDs = ['bafkreibqyjlpctjtbyn5gzgndpjeh3vynuyct55pwtizgmk5z655j6zbdy','bafkreiepinbumzepnoln7co5vea4kf3lcctnqolb3u6bvsellgznymt2uq'];
    const ipfsCID = ipfsCIDs[Math.floor(Math.random() * ipfsCIDs.length)];
    return ipfsCID;
  }

export async function createNewTask(taskName: string, voteThreshold: number = 1) {
  try {
    // Send a transaction to the createNewTask function
    const tx = await helloWorldServiceManager.createNewTask(taskName, voteThreshold);
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    
    console.log(`Transaction successful with hash: ${receipt.hash}`);
    return receipt.hash;
  } catch (error) {
    console.error('Error sending transaction:', error);
  }
}

// Function to create a new task with a random name every 15 seconds
function startCreatingTasks() {
  setInterval(() => {
    const ipfsCID = generateRandomIpfsCIDs();
    console.log(`Creating new task with IPFS CID: ${ipfsCID}`);
    createNewTask(ipfsCID);
  }, 5000);
}

// Start the process
// startCreatingTasks();