import { createContracts, provider, registerOperator, signAndRespondToTask } from './utils';

import { ethers } from 'ethers';

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const contracts = createContracts(wallet);

async function main() {
    await registerOperator(wallet, contracts);

    contracts.helloWorldServiceManager.on("NewTaskCreated", async (taskIndex: number, task: any) => {
        console.log(`New task detected: ${task.name}`);
        const result = Math.random() < 0.5;
        await signAndRespondToTask(
            wallet,
            contracts,
            taskIndex,
            task.taskCreatedBlock,
            task.name,
            task.requiredValidatorResponses,
            result
        );
    });

    contracts.helloWorldServiceManager.on("TaskResponded", async (taskIndex: number, task: any, operator: string) => {
        console.log(`---Approval Rate: ${taskIndex}% for Task ${task.name} responded to by operator ${operator}---`);
    });

    console.log("Monitoring for new tasks...");
}

main().catch((error) => {
    console.error("Error in main function:", error);
});