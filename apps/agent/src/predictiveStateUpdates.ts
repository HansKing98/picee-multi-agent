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
      "Write a document. Use markdown formatting to format the document.",
      "It's good to format the document extensively so it's easy to read.",
      "You can use all kinds of markdown.",
      "However, do not use italic or strike-through formatting, it's reserved for another purpose.",
      "You MUST write the full document, even when changing only a few words.",
      "When making edits to the document, try to make them minimal - do not change every word.",
      "Keep stories SHORT!"
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        document: {
          type: "string",
          description: "The document to write"
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
    You are a helpful assistant for writing documents.
    To write the document, you MUST use the write_document tool.
    You MUST write the full document, even when changing only a few words.
    When you wrote the document, DO NOT repeat it as a message.
    Just briefly summarize the changes you made. 2 sentences max.
    This is the current state of the document: ----\n ${state.document || ''}\n-----
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
        content: "Document written.",
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