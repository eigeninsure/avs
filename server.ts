import { contracts } from './operator/utils';
import cors from 'cors';
import { createNewTask } from './operator/createNewTasks';
import express from 'express';

const app = express();
app.use(express.json());
app.use(cors());

// Keep track of tasks and their indices
const taskNameToIndex: Map<string, number> = new Map();

// Add REST endpoints
app.post('/api/tasks', async (req: any, res: any) => {
  try {
    const { taskName, voteThreshold } = req.body;
    if (!taskName) {
      return res.status(400).json({ error: 'taskName is required' });
    }
    
    const txHash = await createNewTask(taskName, voteThreshold);
    // Store the task name and its index - convert BigInt to number
    const latestTaskNum = await contracts.helloWorldServiceManager.latestTaskNum();
    const taskIndex = Number(latestTaskNum) - 1;
    taskNameToIndex.set(taskName, taskIndex);
    
    res.json({ 
      success: true, 
      txHash,
      message: `Task created successfully with name: ${taskName}`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/claims/:taskName/approval-rate', async (req: any, res: any) => {
  const { taskName } = req.params;
  
  if (!taskNameToIndex.has(taskName)) {
    return res.json({ 
      status: 'pending',
      message: 'Task is not yet created or indexed'
    });
  }

  const taskIndex = taskNameToIndex.get(taskName)!;
  const approvalCount = await contracts.helloWorldServiceManager.taskApprovalCount(taskIndex);
  const responseCount = await contracts.helloWorldServiceManager.taskResponseCount(taskIndex);
  console.log(approvalCount, responseCount)
  if (responseCount === 0) {
    return res.json({ 
      status: 'pending',
      message: 'Task is created but waiting for responses'
    });
  }

  const approvalRate = (Number(approvalCount) * 100) / Number(responseCount);
  
  return res.json({
    status: 'completed',
    approvalRate,
    message: `Task has an approval rate of ${approvalRate}%`
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 