import { tool } from "@opencode-ai/plugin"
import { promises as fs } from "fs"
import * as path from "path"

export default tool({
  description: "Export a Grafana dashboard to JSON format using its UID. Retrieves the complete dashboard definition including panels, variables, and settings. Use when you need to backup, version control, or migrate Grafana dashboards. Can export directly to a file or return JSON string.",
  args: {
    dashboardUid: tool.schema.string().describe("The unique identifier of the dashboard to export (e.g., 'node-exporter-full', 'kubernetes-cluster')"),
    includeMetadata: tool.schema.boolean().optional().describe("Whether to include metadata (version, folder, permissions) in the JSON string response. Only applies when outputPath is not provided. Default: false"),
    outputPath: tool.schema.string().optional().describe("File path where the dashboard JSON should be written (e.g., './dashboards/my-dashboard.json'). Must have .json extension. If provided, writes the dashboard configuration to file and returns a success message instead of JSON string. If not provided, returns JSON string as before."),
  },
  async execute(args, context) {
    const grafanaUrl = process.env.GRAFANA_URL
    const grafanaUsername = process.env.GRAFANA_USERNAME
    const grafanaPassword = process.env.GRAFANA_PASSWORD

    if (!grafanaUrl) {
      return "Error: GRAFANA_URL environment variable is not set"
    }

    if (!grafanaUsername) {
      return "Error: GRAFANA_USERNAME environment variable is not set"
    }

    if (!grafanaPassword) {
      return "Error: GRAFANA_PASSWORD environment variable is not set"
    }

    if (args.outputPath && !args.outputPath.endsWith('.json')) {
      return "Error: outputPath must have .json extension"
    }

    const endpoint = `${grafanaUrl}/api/dashboards/uid/${args.dashboardUid}`
    const credentials = `${grafanaUsername}:${grafanaPassword}`
    const encodedCredentials = btoa(credentials)

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${encodedCredentials}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          return "Error: Unauthorized - Invalid Grafana credentials. Check GRAFANA_USERNAME and GRAFANA_PASSWORD."
        }
        if (response.status === 403) {
          return "Error: Forbidden - You do not have permission to access this dashboard."
        }
        if (response.status === 404) {
          return `Error: Dashboard with UID '${args.dashboardUid}' not found.`
        }
        return `Error: ${response.status} ${response.statusText} - ${await response.text()}`
      }

      const data = await response.json()

      if (args.outputPath) {
        try {
          await fs.writeFile(args.outputPath, JSON.stringify(data.dashboard, null, 2), 'utf-8')
          const title = data.dashboard?.title || "Unknown"
          return `Dashboard '${title}' exported to ${args.outputPath}`
        } catch (error) {
          return `Error writing dashboard to file: ${error instanceof Error ? error.message : String(error)}`
        }
      }

      const result = {
        success: true,
        dashboardUid: args.dashboardUid,
        title: data.dashboard?.title || "Unknown",
        dashboard: data.dashboard
      }

      if (args.includeMetadata) {
        return JSON.stringify({
          ...result,
          meta: data.meta
        }, null, 2)
      }

      return JSON.stringify(result, null, 2)
    } catch (error) {
      return `Error exporting dashboard: ${error instanceof Error ? error.message : String(error)}`
    }
  },
})
