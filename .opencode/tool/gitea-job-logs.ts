import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Fetch logs for a Gitea Actions workflow run. Automatically finds and retrieves logs for the specified workflow.",
  args: {
    owner: tool.schema.string().describe("Repository owner username or organization"),
    repo: tool.schema.string().describe("Repository name"),
    workflow: tool.schema.string().describe("Workflow filename (e.g., build-vllm-rocm.yml)"),
    run_selector: tool.schema.string().optional().describe("Which run to fetch: 'latest' (default), 'latest-failure', or a specific run number like '31'"),
    wait: tool.schema.boolean().optional().describe("Wait for the job to finish before returning logs (polls every 5 seconds)"),
    timeout: tool.schema.number().optional().describe("Timeout in seconds when waiting (default: 300 seconds / 5 minutes)"),
  },
  async execute(args) {
    const giteaHost = process.env.GITEA_HOST || "https://git.holdenitdown.net"
    const giteaToken = process.env.GITEA_ACCESS_TOKEN
    
    if (!giteaToken) {
      return "Error: GITEA_ACCESS_TOKEN environment variable is not set"
    }

    const tasksUrl = `${giteaHost}/api/v1/repos/${args.owner}/${args.repo}/actions/tasks?limit=50`

    try {
      const response = await fetch(tasksUrl, {
        headers: {
          "Authorization": `token ${giteaToken}`,
          "Accept": "application/json"
        }
      })

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const runs = data.workflow_runs || []
      
      const workflowRuns = runs.filter((r: any) => r.workflow_id === args.workflow)
      
      if (workflowRuns.length === 0) {
        return `Error: No runs found for workflow '${args.workflow}'. Available workflows: ${[...new Set(runs.map((r: any) => r.workflow_id))].join(', ')}`
      }
      
      let targetRun: any
      const selector = args.run_selector || 'latest'
      
      if (selector === 'latest') {
        targetRun = workflowRuns[0]
      } else if (selector === 'latest-failure') {
        targetRun = workflowRuns.find((r: any) => r.status === 'failure')
        if (!targetRun) {
          return `No failed runs found for workflow '${args.workflow}'`
        }
      } else {
        const runNum = parseInt(selector, 10)
        if (isNaN(runNum)) {
          return `Error: Invalid run_selector '${selector}'. Use 'latest', 'latest-failure', or a specific run number.`
        }
        targetRun = workflowRuns.find((r: any) => r.run_number === runNum)
        if (!targetRun) {
          return `Error: Run #${runNum} not found for workflow '${args.workflow}'. Available runs: ${workflowRuns.map((r: any) => `#${r.run_number}`).join(', ')}`
        }
      }
      
      const runNumber = targetRun.run_number
      let runStatus = targetRun.status
      
      if (args.wait && (runStatus === "running" || runStatus === "waiting" || runStatus === "pending")) {
        const timeoutMs = (args.timeout ?? 300) * 1000
        const startTime = Date.now()
        
        while (runStatus === "running" || runStatus === "waiting" || runStatus === "pending") {
          if (Date.now() - startTime >= timeoutMs) {
            return `Error: Timeout waiting for job to complete after ${args.timeout ?? 300} seconds. Current status: ${runStatus}`
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          const statusResponse = await fetch(tasksUrl, {
            headers: {
              "Authorization": `token ${giteaToken}`,
              "Accept": "application/json"
            }
          })
          const statusData = await statusResponse.json()
          const updatedRun = (statusData.workflow_runs || []).find((r: any) => 
            r.workflow_id === args.workflow && r.run_number === runNumber
          )
          if (updatedRun) {
            runStatus = updatedRun.status
          }
        }
      }
      
      const jobsForRun = workflowRuns.filter((r: any) => r.run_number === runNumber)
      
      if (jobsForRun.length === 0) {
        return `No jobs found for ${args.workflow} run #${runNumber}`
      }
      
      let allLogs = `=== Logs for workflow: ${args.workflow}, run #${runNumber}, status: ${runStatus} ===\n\n`
      
      for (let jobIndex = 0; jobIndex < jobsForRun.length; jobIndex++) {
        const job = jobsForRun[jobIndex]
        const logsUrl = `${giteaHost}/${args.owner}/${args.repo}/actions/runs/${runNumber}/jobs/${jobIndex}/logs`
        
        try {
          const logsResponse = await fetch(logsUrl, {
            headers: {
              "Authorization": `token ${giteaToken}`,
              "Accept": "text/plain"
            }
          })

          if (!logsResponse.ok) {
            allLogs += `\n--- Job ${jobIndex}: ${job.name} (ID: ${job.id}) - Failed to fetch logs: ${logsResponse.status} ${logsResponse.statusText} ---\n\n`
            continue
          }

          const logs = await logsResponse.text()
          
          if (!logs || logs.trim() === "") {
            allLogs += `\n--- Job ${jobIndex}: ${job.name} (ID: ${job.id}) - No logs available ---\n\n`
          } else {
            allLogs += `\n--- Job ${jobIndex}: ${job.name} (ID: ${job.id}, Status: ${job.status}) ---\n\n${logs}\n`
          }
        } catch (error) {
          allLogs += `\n--- Job ${jobIndex}: ${job.name} (ID: ${job.id}) - Error fetching logs: ${error instanceof Error ? error.message : String(error)} ---\n\n`
        }
      }
      
      return allLogs
    } catch (error) {
      return `Error fetching job logs: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
