import { createContracts, getIPFSContent, provider, registerOperator, signAndRespondToTask } from './utils';

import {Mistral} from '@mistralai/mistralai';
import { ethers } from 'ethers';

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const contracts = createContracts(wallet);

async function claimDecision(ipfsCid: string): Promise<boolean> {
    const ipfsContent = await getIPFSContent(ipfsCid);
    console.log(ipfsContent)
    try {
        const apiKey = process.env.MISTRAL_API_KEY;
        const client = new Mistral({ apiKey });
        const chatResponse = await client.chat.complete({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: `Analyze the following insurance claim. Respond with either approved, or denied. Deny if the claim content is not an insurance claim, or if the claim amount is much higher the expected amount for the accident. Otherwise, approve.
            Insurance claim details: ${ipfsContent}` }],
        });
        // console.log(chatResponse);
        if (chatResponse && chatResponse?.choices && chatResponse.choices.length > 0) {
          const response = chatResponse.choices[0].message.content as string;
          if (response.toLowerCase().includes('approve')) {
            return true
          }
        }
        return false
      } catch (error) {
        console.error('Error calling Mistral API:', error);
      }
      return false
    }


async function main() {
    // claimDecision("bafkreibniywoftv3ibh5zwv2f73pbeathbh4dzjg2pisqjlsicgzfomdby") // no description
    
    await registerOperator(wallet, contracts);

    contracts.helloWorldServiceManager.on("NewTaskCreated", async (taskIndex: number, task: any) => {
        console.log(`New task detected: ${task.name}`);
        
        const result = await claimDecision(task.name);
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