import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Trigger a Gitea workflow dispatch event to manually run a workflow",
  args: {
    owner: tool.schema.string().describe("Repository owner username or organization"),
    repo: tool.schema.string().describe("Repository name"),
    workflow: tool.schema.string().describe("Workflow filename (e.g., build-speaches-cuda.yml)"),
    ref: tool.schema.string().optional().describe("Git reference (branch, tag, or commit SHA). Defaults to 'main'"),
    inputs: tool.schema.record(tool.schema.string(), tool.schema.string()).optional().describe("Workflow input parameters as key-value pairs"),
    wait: tool.schema.boolean().optional().describe("Wait for the workflow to finish and return logs (polls every 5 seconds)"),
    timeout: tool.schema.number().optional().describe("Timeout in seconds when waiting (default: 300 seconds / 5 minutes)"),
  },
  async execute(args) {
    const giteaHost = process.env.GITEA_HOST || "https://git.holdenitdown.net"
    const giteaToken = process.env.GITEA_ACCESS_TOKEN
    
    if (!giteaToken) {
      return "Error: GITEA_ACCESS_TOKEN environment variable is not set"
    }

    const ref = args.ref || "main"
    const url = `${giteaHost}/api/v1/repos/${args.owner}/${args.repo}/actions/workflows/${args.workflow}/dispatches`
    
    const body: { ref: string; inputs?: Record<string, string> } = { ref }
    if (args.inputs && Object.keys(args.inputs).length > 0) {
      body.inputs = args.inputs as Record<string, string>
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `token ${giteaToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return `Error: ${response.status} ${response.statusText} - ${errorText}`
      }

      if (!args.wait) {
        return JSON.stringify({
          success: true,
          message: `Workflow '${args.workflow}' triggered successfully on ref '${ref}'`,
          owner: args.owner,
          repo: args.repo,
          workflow: args.workflow,
          ref: ref,
          inputs: args.inputs || {}
        }, null, 2)
      }

      const tasksUrl = `${giteaHost}/api/v1/repos/${args.owner}/${args.repo}/actions/tasks?limit=50`
      const timeoutMs = (args.timeout ?? 300) * 1000
      const dispatchTime = Date.now()
      const startTime = Date.now()

      await new Promise(resolve => setTimeout(resolve, 8000))

      let targetRun: any = null
      let runStatus = "pending"

      while (targetRun === null && Date.now() - startTime < timeoutMs) {
        const tasksResponse = await fetch(tasksUrl, {
          headers: {
            "Authorization": `token ${giteaToken}`,
            "Accept": "application/json"
          }
        })

        if (!tasksResponse.ok) {
          return `Error fetching workflow run: ${tasksResponse.status} ${tasksResponse.statusText}`
        }

        const tasksData = await tasksResponse.json()
        const runs = tasksData.workflow_runs || []
        const workflowRuns = runs
          .filter((r: any) => r.workflow_id === args.workflow)
          .filter((r: any) => {
            const createdAt = new Date(r.created_at).getTime()
            return createdAt >= dispatchTime - 5000
          })
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        if (workflowRuns.length > 0) {
          targetRun = workflowRuns[0]
          runStatus = targetRun.status
          break
        }

        await new Promise(resolve => setTimeout(resolve, 3000))
      }

      if (!targetRun) {
        return `Error: Workflow run not found after triggering. It may have started but API did not return it yet.`
      }

      const runNumber = targetRun.run_number

      while (runStatus === "running" || runStatus === "waiting" || runStatus === "pending") {
        if (Date.now() - startTime >= timeoutMs) {
          return `Error: Timeout waiting for workflow to complete after ${args.timeout ?? 300} seconds. Current status: ${runStatus}. Run number: ${runNumber}`
        }

        await new Promise(resolve => setTimeout(resolve, 5000))

        const statusResponse = await fetch(tasksUrl, {
          headers: {
            "Authorization": `token ${giteaToken}`,
            "Accept": "application/json"
          }
        })

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          const updatedRun = (statusData.workflow_runs || []).find((r: any) =>
            r.workflow_id === args.workflow && r.run_number === runNumber
          )
          if (updatedRun) {
            runStatus = updatedRun.status
          }
        }
      }

      const jobsForRun = (await fetch(tasksUrl, {
        headers: {
          "Authorization": `token ${giteaToken}`,
          "Accept": "application/json"
        }
      }).then(r => r.json())).workflow_runs.filter((r: any) => r.run_number === runNumber)

      let allLogs = `=== Workflow '${args.workflow}' triggered successfully ===\n`
      allLogs += `=== Run #${runNumber}, Status: ${runStatus} ===\n\n`

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
      return `Error triggering workflow: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
