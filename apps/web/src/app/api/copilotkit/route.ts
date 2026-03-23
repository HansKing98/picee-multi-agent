import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";

// 1. You can use any service adapter here for multi-agent support. We use
//    the empty adapter since we're only using one agent.
const serviceAdapter = new ExperimentalEmptyAdapter();

// 2. Create the CopilotRuntime instance and utilize the LangGraph AG-UI
//    integration to setup the connection.
const runtime = new CopilotRuntime({
  agents: {
    starterAgent: new LangGraphAgent({
      deploymentUrl:
        process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "starterAgent",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
    predictive_state_updates: new LangGraphAgent({
      deploymentUrl: "http://localhost:8123",
      graphId: "predictive_state_updates",
    }),
    human_in_the_loop: new LangGraphAgent({
      deploymentUrl:"http://localhost:8123",
      graphId: "human_in_the_loop",
    }),
    agentic_generative_ui: new LangGraphAgent({
      deploymentUrl: "http://localhost:8123",
      graphId: "agentic_generative_ui",
    }),
    tool_based_generative_ui: new LangGraphAgent({
      deploymentUrl: "http://localhost:8123",
      graphId: "tool_based_generative_ui",
    }),
    shared_state: new LangGraphAgent({
      deploymentUrl: "http://localhost:8123",
      graphId: "shared_state",
    }),
  },
});

// 3. Build a Next.js API route that handles the CopilotKit runtime requests.
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
