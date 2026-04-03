/**
 * An example demonstrating agentic generative UI using LangGraph.
 */

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { Annotation, Command, MessagesAnnotation, StateGraph, END } from "@langchain/langgraph";

// This tool simulates performing a task on the server.
// The tool call will be streamed to the frontend as it is being generated.
const PERFORM_TASK_TOOL = {
  type: "function",
  function: {
    name: "generate_task_steps_generative_ui",
    description: "为任务编造 10 个步骤（每步仅两三个词）。步骤使用动名词形式（例如：挖洞、开门……）",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "步骤文字，动名词形式"
              },
              status: {
                type: "string",
                enum: ["pending"],
                description: "步骤状态，始终为 'pending'"
              }
            },
            required: ["description", "status"]
          },
          description: "包含 10 个步骤对象的数组，每项含 description 与 status"
        }
      },
      required: ["steps"]
    }
  }
};

const AgentStateAnnotation = Annotation.Root({
  steps: Annotation<Array<{ description: string; status: string }>>({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  tools: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),
  ...MessagesAnnotation.spec,
});

type AgentState = typeof AgentStateAnnotation.State;

async function startFlow(state: AgentState, config?: RunnableConfig) {
  /**
   * This is the entry point for the flow.
   * Always clear steps so old steps from previous runs don't persist.
   */
  return {
    steps: []
  };
}

async function chatNode(state: AgentState, config?: RunnableConfig) {
  /**
   * Standard chat node.
   */
  const systemPrompt = `
    你是一个可协助完成各类任务的助手。
    当用户请你做事时，必须调用已提供的 \`generate_task_steps_generative_ui\` 函数。
    若已调用该函数，请勿在下一轮回复中重复列出各步骤。
    仅用一句话并搭配少量 emoji，简要说明你完成了什么。
    语气上要体现你确实执行了这些步骤，而非仅「生成」了步骤列表。
    `;

  // Define the model
  const model = new ChatOpenAI({
    model: process.env.OPENAI_API_MODEL || 'gpt-4o',
    ...(process.env.OPENAI_API_KEY && { apiKey: process.env.OPENAI_API_KEY }),
    ...(process.env.OPENAI_API_BASE_URL && {
      configuration: { baseURL: process.env.OPENAI_API_BASE_URL },
    }),
  });
  
  // Define config for the model with emit_intermediate_state to stream tool calls to frontend
  if (!config) {
    config = { recursionLimit: 25 };
  }

  // Use "predict_state" metadata to set up streaming for the write_document tool
  if (!config.metadata) config.metadata = {};
  config.metadata.predict_state = [{
    state_key: "steps",
    tool: "generate_task_steps_generative_ui",
    tool_argument: "steps",
  }];

  // Bind the tools to the model
  const modelWithTools = model.bindTools(
    [
      ...state.tools,
      PERFORM_TASK_TOOL
    ],
    {
      // Disable parallel tool calls to avoid race conditions
      parallel_tool_calls: false,
    }
  );

  // Run the model to generate a response
  const response = await modelWithTools.invoke([
    new SystemMessage({ content: systemPrompt }),
    ...state.messages,
  ], config);

  const messages = [...state.messages, response];

  // Extract any tool calls from the response
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolCall = response.tool_calls[0];
    
    if (toolCall.name === "generate_task_steps_generative_ui") {
      const steps = toolCall.args.steps.map((step: any) => ({
        description: step.description,
        status: step.status
      }));
      
      // Add the tool response to messages
      const toolResponse = {
        role: "tool" as const,
        content: "步骤已执行。",
        tool_call_id: toolCall.id
      };

      const updatedMessages = [...messages, toolResponse];

      // Simulate executing the steps
      for (let i = 0; i < steps.length; i++) {
        // simulate executing the step
        await new Promise(resolve => setTimeout(resolve, 1000));
        steps[i].status = "completed";
        // Update the state with the completed step
        state.steps = steps;
        // Emit custom events to update the frontend
        await dispatchCustomEvent("manually_emit_state", state, config);
      }
      
      return new Command({
        goto: "chat_node",
        update: {
          messages: updatedMessages,
          steps: state.steps
        }
      });
    }
  }

  return new Command({
    goto: END,
    update: {
      messages: messages,
      steps: state.steps
    }
  });
}

// Define the graph
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("start_flow", startFlow)
  .addNode("chat_node", chatNode)
  .addEdge("__start__", "start_flow")
  .addEdge("start_flow", "chat_node")
  .addEdge("chat_node", "__end__");

// Compile the graph
export const agenticGenerativeUiGraph = workflow.compile();