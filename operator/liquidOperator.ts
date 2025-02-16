import { createContracts, getIPFSContent, provider, registerOperator, signAndRespondToTask } from './utils';

import {Mistral} from '@mistralai/mistralai';
import OpenAI from 'openai';
import { ethers } from 'ethers';

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const contracts = createContracts(wallet);

const openai_api_key = process.env.LFM_API_KEY;
const openai_api_base = "https://api.lambdalabs.com/v1";

const client = new OpenAI({
  apiKey: openai_api_key,
  baseURL: openai_api_base,
});
const model = "lfm-40b";


async function claimDecision(ipfsCid: string): Promise<boolean> {
  try {
    const ipfsContent = await getIPFSContent(ipfsCid);
    console.log(ipfsContent)
    const chatResponse = await client.completions.create({
      prompt: `Analyze the following insurance claim. Respond with either approved, or denied. Deny if the claim content is not an insurance claim, or if the claim amount is much higher the expected amount for the accident. Otherwise, approve.
            Insurance claim details: ${ipfsContent}`,
      temperature: 0,
      model: model,
    });

    // console.log(chatResponse);

    if (chatResponse.choices && chatResponse.choices.length > 0) {
      const response = chatResponse.choices[0].text;
      if (response && response.toLowerCase().includes('approve')) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error analyzing insurance claim:', error);
    return false;
  }
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