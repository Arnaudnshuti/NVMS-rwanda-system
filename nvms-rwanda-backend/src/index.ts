import { createApp } from "./app.js";
import { config } from "./config.js";
import { startAutomationJobs } from "./jobs/automation.job.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`NVMS API listening on http://localhost:${config.port}`);
  console.log(`Health: http://localhost:${config.port}/api/health`);
  startAutomationJobs();
});
