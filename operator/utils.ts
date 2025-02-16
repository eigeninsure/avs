import * as dotenv from "dotenv";

import { Contract } from "ethers";
import { ethers } from "ethers";
const fs = require('fs');
const path = require('path');
dotenv.config();

// Constants
export const CHAIN_ID = 31337;

// Contract addresses and ABIs
const avsDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/hello-world/${CHAIN_ID}.json`), 'utf8'));
const coreDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/core/${CHAIN_ID}.json`), 'utf8'));

export const CONTRACT_ADDRESSES = {
    delegationManager: coreDeploymentData.addresses.delegation,
    avsDirectory: coreDeploymentData.addresses.avsDirectory,
    helloWorldServiceManager: avsDeploymentData.addresses.helloWorldServiceManager,
    ecdsaStakeRegistry: avsDeploymentData.addresses.stakeRegistry
};

export const ABIS = {
    delegationManager: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IDelegationManager.json'), 'utf8')),
    ecdsaRegistry: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/ECDSAStakeRegistry.json'), 'utf8')),
    helloWorldServiceManager: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/HelloWorldServiceManager.json'), 'utf8')),
    avsDirectory: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IAVSDirectory.json'), 'utf8'))
};

// Initialize provider
export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Helper function to create contract instances
export function createContracts(wallet: ethers.Wallet) {
    return {
        delegationManager: new Contract(CONTRACT_ADDRESSES.delegationManager, ABIS.delegationManager, wallet),
        helloWorldServiceManager: new Contract(CONTRACT_ADDRESSES.helloWorldServiceManager, ABIS.helloWorldServiceManager, wallet),
        ecdsaRegistryContract: new Contract(CONTRACT_ADDRESSES.ecdsaStakeRegistry, ABIS.ecdsaRegistry, wallet),
        avsDirectory: new Contract(CONTRACT_ADDRESSES.avsDirectory, ABIS.avsDirectory, wallet)
    };
}

// IPFS helper
export async function getIPFSContent(cid: string): Promise<string> {
    try {
        const response = await fetch(`https://ipfs.io/ipfs/${cid}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.text();
        return content;
    } catch (error: any) {
        console.error(`Failed to fetch IPFS content for CID ${cid}:`, error);
        return `Error fetching IPFS content: ${error.message}`;
    }
}

// Registration helper
export async function registerOperator(wallet: ethers.Wallet, contracts: ReturnType<typeof createContracts>) {
    const { delegationManager, helloWorldServiceManager, ecdsaRegistryContract, avsDirectory } = contracts;
    
    try {
        const tx1 = await delegationManager.registerAsOperator({
            __deprecated_earningsReceiver: wallet.address,
            delegationApprover: "0x0000000000000000000000000000000000000000",
            stakerOptOutWindowBlocks: 0
        }, "");
        await tx1.wait();
        console.log(`${wallet.address} registered to Core EigenLayer contracts`);
    } catch (error) {
        console.error(`Error registering operator ${wallet.address}:`, error);
        return;
    }

    const salt = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    const operatorSignatureWithSaltAndExpiry = {
        signature: "",
        salt: salt,
        expiry: expiry
    };

    const operatorDigestHash = await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
        wallet.address,
        await helloWorldServiceManager.getAddress(),
        salt,
        expiry
    );

    const operatorSigningKey = new ethers.SigningKey(wallet.privateKey);
    const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);
    operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(operatorSignedDigestHash).serialized;

    const isOperator = await delegationManager.isOperator(wallet.address);
    if (isOperator) {
        console.log(`${wallet.address} already registered as operator in EigenLayer`);
        return;
    }

    const tx2 = await ecdsaRegistryContract.registerOperatorWithSignature(
        operatorSignatureWithSaltAndExpiry,
        wallet.address
    );
    await tx2.wait();
    console.log(`${wallet.address} registered on AVS successfully`);
}

// Task response helper
export async function signAndRespondToTask(
    wallet: ethers.Wallet,
    contracts: ReturnType<typeof createContracts>,
    taskIndex: number,
    taskCreatedBlock: number,
    taskName: string,
    requiredValidatorResponses: number,
    result: boolean
) {
    const { helloWorldServiceManager } = contracts;
    const ipfsContent = await getIPFSContent(taskName);
    const contractApproved = result;

    const message = `Checking Claim #${taskIndex}. Block: ${taskCreatedBlock}.
    
IPFS CID: ${taskName} 

IPFS Information: ${ipfsContent.slice(0,100)}

Status: ${contractApproved}`;

    const messageHash = ethers.solidityPackedKeccak256(["string"], [message]);
    const messageBytes = ethers.getBytes(messageHash);
    const signature = await wallet.signMessage(messageBytes);

    console.log(`${wallet.address} signing task ${taskIndex} with result ${contractApproved}`);

    const operators = [wallet.address];
    const signatures = [signature];
    const signedTask = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "bytes[]", "uint32"],
        [operators, signatures, ethers.toBigInt(await provider.getBlockNumber()-1)]
    );

    const tx = await helloWorldServiceManager.respondToTask(
        { 
            name: taskName, 
            requiredValidatorResponses: requiredValidatorResponses,
            taskCreatedBlock: taskCreatedBlock 
        },
        taskIndex,
        signedTask,
        contractApproved,
    );
    await tx.wait();
    console.log(`${wallet.address} responded to task ${taskIndex}`);
}