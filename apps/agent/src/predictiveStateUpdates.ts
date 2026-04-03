/**
 * A demo of predictive state updates using LangGraph.
 */

import { v4 as uuidv4 } from "uuid";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { Command, Annotation, MessagesAnnotation, StateGraph, END, START } from "@langchain/langgraph";

const WRITE_DOCUMENT_TOOL = {
  type: "function",
  function: {
    name: "write_document",
    description: [
      "写文档。使用 markdown 格式对文档进行排版。",
      "最好对文档进行充分的排版，以便于阅读。",
      "你可以使用各种 markdown 格式。",
      "但是，不要使用斜体或删除线格式，它被保留用于其他目的。",
      "你必须输出完整的文档，即使只修改了几个字。",
      "在修改文档时，尽量做最小的改动 - 不要更改每一个字。",
      "故事要保持简短！"
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        document: {
          type: "string",
          description: "要编写的文档"
        },
      },
    }
  }
};

export const AgentStateAnnotation = Annotation.Root({
  document: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  tools: Annotation<any[]>(),
  ...MessagesAnnotation.spec,
});
export type AgentState = typeof AgentStateAnnotation.State;

async function chatNode(state: AgentState, config?: RunnableConfig): Promise<Command> {
  /**
   * Standard chat node.
   */

  const systemPrompt = `
    你是一个编写文档的得力助手。
    要写文档，你必须使用 write_document 工具。
    你必须输出完整的文档，即使只修改了几个字。
    当你写完文档后，不要在消息中重复文档内容。
    只需简要总结你所做的修改。最多 2 句话。
    这是文档的当前状态：----\n ${state.document || ''}\n-----
    `;

  // Define the model
  const model = new ChatOpenAI({
    temperature: 0,
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
    state_key: "document",
    tool: "write_document",
    tool_argument: "document"
  }];

  // Bind the tools to the model
  const modelWithTools = model.bindTools(
    [
      ...state.tools,
      WRITE_DOCUMENT_TOOL
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

  // Update messages with the response
  const messages = [...state.messages, response];

  // Extract any tool calls from the response
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolCall = response.tool_calls[0];

    if (toolCall.name === "write_document") {
      // Add the tool response to messages
      const toolResponse = {
        role: "tool" as const,
        content: "文档已写入。",
        tool_call_id: toolCall.id
      };

      // Add confirmation tool call
      const confirmToolCall = {
        role: "assistant" as const,
        content: "",
        tool_calls: [{
          id: uuidv4(),
          type: "function" as const,
          function: {
            name: "confirm_changes",
            arguments: "{}"
          }
        }]
      };

      // const updatedMessages = [...messages, toolResponse, confirmToolCall];
      const updatedMessages = [...messages];

      // Return Command to route to end
      // CopilotKit will detect the unfulfilled `write_document` tool call
      // and trigger the `useHumanInTheLoop` hook on the frontend.
      return new Command({
        goto: END,
        update: {
          messages: updatedMessages,
          document: toolCall.args.document
        }
      });
    }
  }

  // If no tool was called, go to end
  return new Command({
    goto: END,
    update: {
      messages: messages
    }
  });
}

// Define the graph
const workflow = new StateGraph(AgentStateAnnotation);

// Add nodes
workflow.addNode("chat_node", chatNode);

// Add edges
workflow.addEdge(START, "chat_node");
workflow.addEdge("chat_node", END);

// Compile the graph
export const predictiveStateUpdatesGraph = workflow.compile();