import cors from 'cors';
import { createNewTask } from './operator/createNewTasks';
import express from 'express';

const app = express();
app.use(express.json());
app.use(cors());

// Add REST endpoint
app.post('/api/tasks', async (req: any, res: any) => {
  try {
    const { taskName } = req.body;
    if (!taskName) {
      return res.status(400).json({ error: 'taskName is required' });
    }
    
    const txHash = await createNewTask(taskName);
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 