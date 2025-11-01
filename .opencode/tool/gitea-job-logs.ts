import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Fetch logs for a specific Gitea Actions job",
  args: {
    owner: tool.schema.string().describe("Repository owner username or organization"),
    repo: tool.schema.string().describe("Repository name"),
    run_number: tool.schema.number().describe("Workflow run number (use this to fetch job logs)"),
    wait: tool.schema.boolean().optional().describe("Wait for the job to finish before returning logs (polls every 5 seconds)"),
    timeout: tool.schema.number().optional().describe("Timeout in seconds when waiting (default: 300 seconds / 5 minutes)"),
  },
  async execute(args) {
    const giteaHost = process.env.GITEA_HOST || "https://git.holdenitdown.net"
    const giteaToken = process.env.GITEA_ACCESS_TOKEN
    
    if (!giteaToken) {
      return "Error: GITEA_ACCESS_TOKEN environment variable is not set"
    }

    const logsUrl = `${giteaHost}/api/v1/repos/${args.owner}/${args.repo}/actions/jobs/${args.run_number}/logs`
    const tasksUrl = `${giteaHost}/api/v1/repos/${args.owner}/${args.repo}/actions/tasks?limit=50`

    const fetchLogs = async (): Promise<string> => {
      const response = await fetch(logsUrl, {
        headers: {
          "Authorization": `token ${giteaToken}`,
          "Accept": "text/plain"
        }
      })

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} - ${await response.text()}`)
      }

      return await response.text()
    }

    const checkRunStatus = async (): Promise<string> => {
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
      const run = runs.find((r: any) => r.run_number === args.run_number)
      
      if (!run) {
        throw new Error(`Workflow run with run_number ${args.run_number} not found`)
      }
      
      return run.status
    }

    try {
      if (args.wait) {
        const timeoutMs = (args.timeout ?? 300) * 1000
        const startTime = Date.now()
        let status = await checkRunStatus()
        
        while (status === "running" || status === "waiting" || status === "pending") {
          if (Date.now() - startTime >= timeoutMs) {
            return `Error: Timeout waiting for job to complete after ${args.timeout ?? 300} seconds. Current status: ${status}`
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000))
          status = await checkRunStatus()
        }
      }

      const logs = await fetchLogs()
      
      if (!logs || logs.trim() === "") {
        return "No logs available for this job (may not have started yet or logs were cleared)"
      }
      
      return logs
    } catch (error) {
      return `Error fetching job logs: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
