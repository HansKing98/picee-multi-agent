/**
 * An example demonstrating tool-based generative UI using LangGraph.
 */

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { Command, Annotation, MessagesAnnotation, StateGraph, END, START } from "@langchain/langgraph";


export const AgentStateAnnotation = Annotation.Root({
  tools: Annotation<any[]>(),
  ...MessagesAnnotation.spec,
});
export type AgentState = typeof AgentStateAnnotation.State;

async function chatNode(state: AgentState, config?: RunnableConfig): Promise<Command> {

  const model = new ChatOpenAI({
    temperature: 0,
    model: process.env.OPENAI_API_MODEL || 'gpt-4o',
    ...(process.env.OPENAI_API_KEY && { apiKey: process.env.OPENAI_API_KEY }),
    ...(process.env.OPENAI_API_BASE_URL && {
      configuration: { baseURL: process.env.OPENAI_API_BASE_URL },
    }),
  });

  const modelWithTools = model.bindTools(
    [
      ...state.tools || []
    ],
    { parallel_tool_calls: false }
  );

  const systemMessage = new SystemMessage({
    content: "协助用户创作俳句。若用户索要俳句，请使用 generate_haiku 工具将俳句展示给用户。"
  });

  const response = await modelWithTools.invoke([
    systemMessage,
    ...state.messages,
  ], config);

  return new Command({
    goto: END,
    update: {
      messages: [response]
    }
  });
}

const workflow = new StateGraph<AgentState>(AgentStateAnnotation);
workflow.addNode("chat_node", chatNode);

workflow.addEdge(START, "chat_node");

export const toolBasedGenerativeUiGraph = workflow.compile();